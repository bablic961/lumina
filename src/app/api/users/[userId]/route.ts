import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/**
 * Public profile card. The segment accepts either a cuid or a `@username`
 * (with or without the `@`), so `/app/u/<username>` can fetch it directly.
 * Presence and read receipts respect the owner's privacy switches.
 */
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const me = await requireUser();
    const raw = decodeURIComponent(params.userId);
    const handle = raw.startsWith('@') ? raw.slice(1) : raw;

    const user = await prisma.user.findFirst({
      where: { OR: [{ id: handle }, { username: handle }] },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
        verified: true,
        presence: true,
        statusEmoji: true,
        statusText: true,
        lastSeenAt: true,
        showPresence: true,
        whoCanMessage: true,
        birthday: true,
        createdAt: true,
        banned: true,
        badges: { select: { id: true, key: true, earnedAt: true }, orderBy: { earnedAt: 'asc' } },
        _count: { select: { messages: true } },
      },
    });
    if (!user || user.banned) throw new HttpError(404, 'Профиль не найден');

    const mine = user.id === me.id;

    const [blockedByMe, blockedMe, shared, dm, activeStories] = await Promise.all([
      prisma.block.findFirst({ where: { blockerId: me.id, blockedId: user.id }, select: { id: true } }),
      prisma.block.findFirst({ where: { blockerId: user.id, blockedId: me.id }, select: { id: true } }),
      mine
        ? Promise.resolve([])
        : prisma.chat.findMany({
            where: {
              type: { in: ['GROUP', 'CHANNEL'] },
              AND: [{ members: { some: { userId: me.id } } }, { members: { some: { userId: user.id } } }],
            },
            take: 12,
            select: { id: true, title: true, type: true, avatarUrl: true, _count: { select: { members: true } } },
          }),
      mine
        ? Promise.resolve(null)
        : prisma.chat.findFirst({
            where: {
              type: 'DM',
              AND: [{ members: { some: { userId: me.id } } }, { members: { some: { userId: user.id } } }],
            },
            select: { id: true },
          }),
      prisma.story.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
    ]);

    if (blockedMe && !mine) throw new HttpError(404, 'Профиль не найден');

    const visiblePresence = mine || user.showPresence;
    // `whoCanMessage` stays server-side; the client only needs the verdict below.
    const { showPresence, banned, birthday, whoCanMessage, ...rest } = user;

    return Response.json({
      user: {
        ...rest,
        presence: visiblePresence ? user.presence : 'OFFLINE',
        lastSeenAt: visiblePresence ? user.lastSeenAt : null,
        // Only the day and month; the year stays private.
        birthday: birthday ? `${String(birthday.getMonth() + 1).padStart(2, '0')}-${String(birthday.getDate()).padStart(2, '0')}` : null,
      },
      mine,
      blocked: Boolean(blockedByMe),
      sharedChats: shared,
      dmChatId: dm?.id ?? null,
      activeStories,
      canMessage: mine || whoCanMessage === 'EVERYONE' || (whoCanMessage === 'CONTACTS' && shared.length > 0),
    });
  } catch (err) {
    return jsonError(err);
  }
}
