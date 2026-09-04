import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireAdmin } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** Keys the app actually consults, shown even before a row exists. */
const KNOWN: { key: string; limit: number; windowSec: number; label: string }[] = [
  { key: 'message.send', limit: 30, windowSec: 10, label: 'Отправка сообщений' },
  { key: 'integrations.ai', limit: 20, windowSec: 3600, label: 'Запросы к AI' },
  { key: 'upload', limit: 60, windowSec: 3600, label: 'Загрузка файлов' },
  { key: 'invite.create', limit: 20, windowSec: 3600, label: 'Создание инвайтов' },
  { key: 'story.create', limit: 20, windowSec: 86400, label: 'Публикация историй' },
];

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.rateLimitRule.findMany();
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return Response.json({
      rules: KNOWN.map((known) => {
        const row = byKey.get(known.key);
        return {
          ...known,
          limit: row?.limit ?? known.limit,
          windowSec: row?.windowSec ?? known.windowSec,
          configured: Boolean(row),
          updatedAt: row?.updatedAt ?? null,
        };
      }),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as { key?: string; limit?: number; windowSec?: number };
    const known = KNOWN.find((rule) => rule.key === body.key);
    if (!known) throw new HttpError(400, 'Неизвестный ключ лимита');
    const limit = Number(body.limit);
    const windowSec = Number(body.windowSec);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100000) throw new HttpError(422, 'Лимит от 1 до 100000');
    if (!Number.isInteger(windowSec) || windowSec < 1 || windowSec > 604800) {
      throw new HttpError(422, 'Окно от 1 секунды до недели');
    }

    const rule = await prisma.rateLimitRule.upsert({
      where: { key: known.key },
      create: { key: known.key, limit, windowSec },
      update: { limit, windowSec },
    });
    await prisma.auditLog.create({
      data: { actorId: admin.id, action: 'ratelimit.update', target: known.key, meta: JSON.stringify({ limit, windowSec }) },
    });
    return Response.json({ rule });
  } catch (err) {
    return jsonError(err);
  }
}
