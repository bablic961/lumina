/**
 * Sliding-window rate limits, shared by the HTTP routes and the socket layer.
 *
 * Both sides need the same counters, and webpack bundles its own copy of this
 * file for the Next side, so the state lives on globalThis — the same trick
 * server.js already uses for the Prisma client and the io instance.
 *
 * Limits come from the RateLimitRule table, so an admin retunes them from the
 * panel without a redeploy. Rows are cached for RULE_TTL_MS: `message.send`
 * must not add a query per message.
 */

/** Every key the app actually spends. The admin panel renders exactly these. */
const RATE_LIMIT_DEFAULTS = {
  // `label` titles the row in the admin panel, `tooMany` is what the user reads.
  'message.send': { limit: 30, windowSec: 10, label: 'Отправка сообщений', tooMany: 'Слишком много сообщений' },
  'integrations.ai': { limit: 20, windowSec: 3600, label: 'Запросы к AI', tooMany: 'Слишком много запросов к AI' },
  upload: { limit: 60, windowSec: 3600, label: 'Загрузка файлов', tooMany: 'Слишком много загрузок' },
  'invite.create': { limit: 20, windowSec: 3600, label: 'Создание инвайтов', tooMany: 'Слишком много новых ссылок' },
  'story.create': { limit: 20, windowSec: 86400, label: 'Публикация историй', tooMany: 'Слишком много историй за сутки' },
};

const RULE_TTL_MS = 30_000;
const MAX_BUCKETS = 20_000;

const store =
  globalThis.__luminaRateLimits ||
  (globalThis.__luminaRateLimits = { buckets: new Map(), rules: new Map() });

/** "через 8 с" / "через 4 мин" / "через 2 ч" — whichever unit reads naturally. */
function formatRetry(ms) {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return 'через ' + sec + ' с';
  const min = Math.ceil(sec / 60);
  if (min < 60) return 'через ' + min + ' мин';
  return 'через ' + Math.ceil(min / 60) + ' ч';
}

async function resolveRule(key, prisma) {
  const fallback = RATE_LIMIT_DEFAULTS[key];
  const cached = store.rules.get(key);
  if (cached && Date.now() - cached.at < RULE_TTL_MS) return cached.rule;

  let rule = { limit: fallback.limit, windowSec: fallback.windowSec };
  try {
    const row = await prisma.rateLimitRule.findUnique({ where: { key } });
    if (row) rule = { limit: row.limit, windowSec: row.windowSec };
  } catch {
    // A database hiccup must not turn every write into a 500 — keep the defaults.
  }
  store.rules.set(key, { rule, at: Date.now() });
  return rule;
}

/** Buckets are tiny, but an idle server should not hold them forever. */
function sweep(now) {
  for (const [id, bucket] of store.buckets) {
    if (bucket.expiresAt <= now) store.buckets.delete(id);
  }
}

/**
 * Take one slot for (key, userId). Never throws: returns { ok: true }, or
 * { ok: false, retryAfterSec, message } with a ready-to-show Russian message.
 */
async function checkRateLimit(key, userId, prisma) {
  const rule = await resolveRule(key, prisma);
  const windowMs = rule.windowSec * 1000;
  const now = Date.now();
  const id = key + ':' + userId;
  const kept = (store.buckets.get(id)?.hits || []).filter((at) => now - at < windowMs);

  if (kept.length >= rule.limit) {
    // The oldest hit in the window decides when a slot frees up.
    const retryMs = windowMs - (now - kept[0]);
    store.buckets.set(id, { hits: kept, expiresAt: now + retryMs });
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)),
      message: RATE_LIMIT_DEFAULTS[key].tooMany + '. Попробуйте ' + formatRetry(retryMs),
    };
  }

  kept.push(now);
  store.buckets.set(id, { hits: kept, expiresAt: now + windowMs });
  if (store.buckets.size > MAX_BUCKETS) sweep(now);
  return { ok: true };
}

/** Called after an admin PATCH so the new limit applies without waiting out the TTL. */
function invalidateRateLimitRule(key) {
  store.rules.delete(key);
}

module.exports = { RATE_LIMIT_DEFAULTS, checkRateLimit, invalidateRateLimitRule, formatRetry };
