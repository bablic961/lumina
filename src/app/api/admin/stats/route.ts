import { prisma } from '@/lib/prisma';
import { jsonError, requireAdmin } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dashboard numbers: totals, 14-day activity series and the busiest chats. */
export async function GET() {
  try {
    await requireAdmin();
    const now = Date.now();
    const dayAgo = new Date(now - DAY_MS);
    const weekAgo = new Date(now - 7 * DAY_MS);
    const seriesFrom = new Date(new Date(now - 13 * DAY_MS).setHours(0, 0, 0, 0));

    const [
      users,
      online,
      banned,
      newUsersWeek,
      chats,
      groups,
      channels,
      messages,
      messagesDay,
      attachments,
      calls,
      stories,
      openReports,
      recent,
      topChats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { presence: { not: 'OFFLINE' } } }),
      prisma.user.count({ where: { banned: true } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.chat.count(),
      prisma.chat.count({ where: { type: 'GROUP' } }),
      prisma.chat.count({ where: { type: 'CHANNEL' } }),
      prisma.message.count(),
      prisma.message.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.attachment.aggregate({ _count: true, _sum: { size: true } }),
      prisma.callSession.count(),
      prisma.story.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.message.findMany({
        where: { createdAt: { gte: seriesFrom } },
        select: { createdAt: true },
      }),
      prisma.chat.findMany({
        orderBy: { lastMessageAt: 'desc' },
        take: 8,
        select: {
          id: true,
          title: true,
          type: true,
          lastMessageAt: true,
          _count: { select: { members: true, messages: true } },
        },
      }),
    ]);

    // Bucket by local day so the chart lines up with the admin's calendar.
    const buckets = new Map<string, number>();
    for (let index = 0; index < 14; index += 1) {
      const day = new Date(seriesFrom.getTime() + index * DAY_MS);
      buckets.set(day.toISOString().slice(0, 10), 0);
    }
    for (const row of recent) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Response.json({
      totals: {
        users,
        online,
        banned,
        newUsersWeek,
        chats,
        groups,
        channels,
        messages,
        messagesDay,
        files: attachments._count,
        storageBytes: attachments._sum.size ?? 0,
        calls,
        stories,
        openReports,
      },
      series: [...buckets.entries()].map(([date, count]) => ({ date, count })),
      topChats,
    });
  } catch (err) {
    return jsonError(err);
  }
}
