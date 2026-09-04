import { prisma } from '@/lib/prisma';
import { jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/**
 * Global search across chats, messages and people.
 * `contains` on SQLite is case-insensitive for ASCII; on PostgreSQL add
 * `mode: 'insensitive'` (kept out here so the same code runs on both).
 */
export async function GET(req: Request) {
  try {
    const me = await requireUser();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const chatId = url.searchParams.get('chatId');
    const from = url.searchParams.get('from');
    const kind = url.searchParams.get('kind');
    const since = url.searchParams.get('since');

    if (q.length < 1 && !chatId) return Response.json({ chats: [], messages: [], users: [] });

    const myChatIds = (
      await prisma.chatMember.findMany({ where: { userId: me.id }, select: { chatId: true } })
    ).map((m) => m.chatId);

    const [messages, users, chats] = await Promise.all([
      prisma.message.findMany({
        where: {
          chatId: chatId ? chatId : { in: myChatIds },
          deletedForAll: false,
          ...(q ? { content: { contains: q } } : {}),
          ...(from ? { senderId: from } : {}),
          ...(kind && kind !== 'ALL' ? { contentType: kind } : {}),
          ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
          chat: { select: { id: true, title: true, type: true } },
        },
      }),
      q
        ? prisma.user.findMany({
            where: {
              banned: false,
              id: { not: me.id },
              OR: [{ username: { contains: q.replace(/^@/, '') } }, { name: { contains: q } }],
            },
            take: 12,
            select: { id: true, name: true, username: true, avatarUrl: true, verified: true, presence: true },
          })
        : Promise.resolve([]),
      q
        ? prisma.chat.findMany({
            where: {
              id: { in: myChatIds },
              OR: [{ title: { contains: q } }, { description: { contains: q } }],
            },
            take: 12,
            select: { id: true, title: true, type: true, avatarUrl: true },
          })
        : Promise.resolve([]),
    ]);

    return Response.json({ messages, users, chats });
  } catch (err) {
    return jsonError(err);
  }
}
