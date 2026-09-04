import { prisma } from '@/lib/prisma';
import { jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/**
 * People search for the new-chat and add-member flows.
 * Users who blocked me (or whom I blocked) are filtered out so they cannot be
 * pulled into a chat through the picker.
 */
export async function GET(req: Request) {
  try {
    const me = await requireUser();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim().replace(/^@/, '');
    const excludeChatId = url.searchParams.get('excludeChatId');
    if (q.length < 2) return Response.json({ users: [] });

    const blocks = await prisma.block.findMany({
      where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] },
      select: { blockerId: true, blockedId: true },
    });
    const hidden = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]));
    hidden.add(me.id);

    if (excludeChatId) {
      const members = await prisma.chatMember.findMany({
        where: { chatId: excludeChatId },
        select: { userId: true },
      });
      for (const m of members) hidden.add(m.userId);
    }

    const users = await prisma.user.findMany({
      where: {
        banned: false,
        id: { notIn: [...hidden] },
        OR: [{ username: { contains: q } }, { name: { contains: q } }],
      },
      orderBy: { name: 'asc' },
      take: 20,
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        verified: true,
        presence: true,
        showPresence: true,
        statusEmoji: true,
        statusText: true,
      },
    });

    return Response.json({
      users: users.map(({ showPresence, ...u }) => ({ ...u, presence: showPresence ? u.presence : 'OFFLINE' })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
