import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireMember, requireUser } from '@/lib/guards';
import { askLumina } from '@/lib/ai';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;
const DEFAULT_WINDOW_SEC = 3600;

/**
 * Per-process throttle: AI calls cost money, so one user cannot loop `/ai`.
 * In-memory on purpose — the limit is per app instance and resets on restart,
 * which is enough for a single-server deployment. Admins tune it through the
 * `integrations.ai` RateLimitRule row.
 */
const hits = new Map<string, number[]>();

async function takeSlot(userId: string) {
  const rule = await prisma.rateLimitRule.findUnique({ where: { key: 'integrations.ai' } });
  const limit = rule?.limit ?? DEFAULT_LIMIT;
  const windowMs = (rule?.windowSec ?? DEFAULT_WINDOW_SEC) * 1000;
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    const retryMin = Math.max(1, Math.ceil((windowMs - (now - recent[0]!)) / 60000));
    throw new HttpError(429, `Лимит запросов к AI исчерпан, попробуйте через ${retryMin} мин`);
  }
  recent.push(now);
  hits.set(userId, recent);
}

const PLACEHOLDER: Record<string, string> = {
  VOICE: '[голосовое сообщение]',
  FILE: '[файл]',
  IMAGE: '[изображение]',
  VIDEO: '[видео]',
  STICKER: '[стикер]',
  POLL: '[опрос]',
  CALL: '[звонок]',
  LOCATION: '[геопозиция]',
};

/** The last few turns, oldest first, so the assistant can resolve "а он что ответил?". */
async function chatContext(chatId: string) {
  const rows = await prisma.message.findMany({
    where: { chatId, deletedAt: null, contentType: { not: 'SYSTEM' } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { content: true, contentType: true, sender: { select: { name: true } } },
  });
  return rows
    .reverse()
    .map((row) => {
      const body = PLACEHOLDER[row.contentType] ?? row.content.slice(0, 400);
      return `${row.sender?.name ?? 'Кто-то'}: ${body}`;
    })
    .join('\n');
}

/** `/ai <вопрос>` and `@lumina` mentions: answer with the chat as context. */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = (await req.json()) as { chatId?: string; prompt?: string };
    const prompt = (body.prompt ?? '').trim().slice(0, 4000);
    if (!body.chatId) throw new HttpError(400, 'Не указан чат');
    if (!prompt) throw new HttpError(400, 'Задайте вопрос: /ai как дела?');

    await requireMember(body.chatId, me.id);
    await takeSlot(me.id);

    const text = await askLumina(prompt, await chatContext(body.chatId));
    return Response.json({ text });
  } catch (err) {
    return jsonError(err);
  }
}
