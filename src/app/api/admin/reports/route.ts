import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireAdmin } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED'] as const;
const PAGE_SIZE = 30;

const BRIEF_USER = { id: true, name: true, username: true, avatarUrl: true, banned: true } as const;

/** Moderation queue; `?status=` defaults to everything still open. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const status = new URL(req.url).searchParams.get('status');
    const where = status && STATUSES.includes(status as (typeof STATUSES)[number]) ? { status } : {};

    const [items, counts] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: PAGE_SIZE,
        include: {
          reporter: { select: BRIEF_USER },
          targetUser: { select: BRIEF_USER },
          targetMessage: {
            select: {
              id: true,
              chatId: true,
              content: true,
              contentType: true,
              createdAt: true,
              sender: { select: BRIEF_USER },
            },
          },
        },
      }),
      prisma.report.groupBy({ by: ['status'], _count: true }),
    ]);

    return Response.json({
      items,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count])),
    });
  } catch (err) {
    return jsonError(err);
  }
}

/** Move a report along, optionally deleting the reported message in one go. */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as { id?: string; status?: string; deleteMessage?: boolean };
    if (!body.id) throw new HttpError(400, 'Не указана жалоба');
    if (!body.status || !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      throw new HttpError(400, 'Неизвестный статус');
    }

    const report = await prisma.report.findUnique({ where: { id: body.id } });
    if (!report) throw new HttpError(404, 'Жалоба не найдена');

    await prisma.report.update({ where: { id: body.id }, data: { status: body.status } });
    if (body.deleteMessage && report.targetMessageId) {
      await prisma.message.update({
        where: { id: report.targetMessageId },
        data: { deletedAt: new Date(), deletedForAll: true, content: '', isPinned: false },
      });
    }
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'report.update',
        target: report.id,
        meta: JSON.stringify({ status: body.status, deletedMessage: Boolean(body.deleteMessage) }),
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
