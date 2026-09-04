import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';
import { emitToUser } from '@/lib/io';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

const USER_FIELDS = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  verified: true,
  presence: true,
} as const;

/**
 * The 24-hour feed: my own stories first, then everyone I share a chat with.
 * Expired rows are left for the sweeper — the query filters by `expiresAt`.
 */
export async function GET() {
  try {
    const me = await requireUser();
    const now = new Date();

    const myChats = await prisma.chatMember.findMany({ where: { userId: me.id }, select: { chatId: true } });
    const peers = await prisma.chatMember.findMany({
      where: { chatId: { in: myChats.map((row) => row.chatId) }, userId: { not: me.id } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const blocked = await prisma.block.findMany({
      where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] },
      select: { blockerId: true, blockedId: true },
    });
    const hidden = new Set(blocked.flatMap((row) => [row.blockerId, row.blockedId]).filter((id) => id !== me.id));
    const authorIds = [me.id, ...peers.map((row) => row.userId).filter((id) => !hidden.has(id))];

    const stories = await prisma.story.findMany({
      where: { userId: { in: authorIds }, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: USER_FIELDS },
        views: { select: { userId: true, emoji: true, viewedAt: true } },
      },
    });

    const groups = new Map<string, { user: (typeof stories)[number]['user']; stories: unknown[]; unseen: number }>();
    for (const story of stories) {
      const mine = story.userId === me.id;
      const seen = story.views.some((view) => view.userId === me.id);
      const group = groups.get(story.userId) ?? { user: story.user, stories: [], unseen: 0 };
      group.stories.push({
        id: story.id,
        kind: story.kind,
        mediaUrl: story.mediaUrl,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        seen: mine || seen,
        viewCount: story.views.length,
        reactions: story.views.filter((view) => view.emoji).map((view) => view.emoji),
        // Only the author learns who watched.
        viewers: mine ? story.views : undefined,
      });
      if (!mine && !seen) group.unseen += 1;
      groups.set(story.userId, group);
    }

    const list = [...groups.values()].sort((a, b) => {
      if (a.user.id === me.id) return -1;
      if (b.user.id === me.id) return 1;
      return b.unseen - a.unseen;
    });
    return Response.json({ groups: list });
  } catch (err) {
    return jsonError(err);
  }
}

/** Publish a story; it disappears on its own 24 hours later. */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = (await req.json()) as { kind?: string; mediaUrl?: string; caption?: string | null };
    const kind = body.kind === 'VIDEO' ? 'VIDEO' : 'IMAGE';
    if (!body.mediaUrl) throw new HttpError(400, 'Не выбран файл');

    const active = await prisma.story.count({ where: { userId: me.id, expiresAt: { gt: new Date() } } });
    if (active >= 20) throw new HttpError(400, 'Не больше 20 активных историй');

    const story = await prisma.story.create({
      data: {
        userId: me.id,
        kind,
        mediaUrl: body.mediaUrl,
        caption: body.caption?.slice(0, 200) || null,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      },
      include: { user: { select: USER_FIELDS } },
    });

    const peers = await prisma.chatMember.findMany({
      where: { chat: { members: { some: { userId: me.id } } }, userId: { not: me.id } },
      select: { userId: true },
      distinct: ['userId'],
    });
    for (const peer of peers) emitToUser(peer.userId, 'story:new', { userId: me.id, storyId: story.id });

    return Response.json({ story }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await requireUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Не указана история');
    const { count } = await prisma.story.deleteMany({ where: { id, userId: me.id } });
    if (count === 0) throw new HttpError(404, 'История не найдена');
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
