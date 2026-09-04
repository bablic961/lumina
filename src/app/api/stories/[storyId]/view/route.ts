import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';
import { emitToUser } from '@/lib/io';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/**
 * Mark a story as seen, optionally with a reaction emoji. Idempotent: a second
 * view only updates the emoji, so the counter cannot be inflated by re-opening.
 */
export async function POST(req: Request, { params }: { params: { storyId: string } }) {
  try {
    const me = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { emoji?: string | null };
    const emoji = body.emoji?.slice(0, 8) || null;

    const story = await prisma.story.findUnique({ where: { id: params.storyId }, select: { userId: true, expiresAt: true } });
    if (!story || story.expiresAt < new Date()) throw new HttpError(404, 'История недоступна');
    if (story.userId === me.id) return Response.json({ ok: true, own: true });

    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: story.userId, blockedId: me.id },
          { blockerId: me.id, blockedId: story.userId },
        ],
      },
    });
    if (blocked) throw new HttpError(403, 'История недоступна');

    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId: params.storyId, userId: me.id } },
      create: { storyId: params.storyId, userId: me.id, emoji },
      update: emoji ? { emoji } : {},
    });

    emitToUser(story.userId, 'story:viewed', { storyId: params.storyId, userId: me.id, emoji });
    if (emoji) {
      await prisma.notification.create({
        data: {
          userId: story.userId,
          type: 'REACTION',
          title: `${me.name} отреагировал(а) на историю`,
          body: emoji,
        },
      });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
