import { prisma } from '@/lib/prisma';
import { jsonError, requireMember, requireUser } from '@/lib/guards';
import type { AttachmentKind } from '@/types';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const KINDS: Record<string, AttachmentKind[]> = {
  media: ['IMAGE', 'VIDEO'],
  files: ['DOC'],
  audio: ['AUDIO', 'VOICE'],
};

/** Attachments of a chat, grouped for the right-hand gallery. `?tab=media|files|audio` */
export async function GET(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    await requireMember(params.chatId, me.id);

    const url = new URL(req.url);
    const tab = url.searchParams.get('tab') || 'media';
    const cursor = url.searchParams.get('cursor');

    const attachments = await prisma.attachment.findMany({
      where: {
        kind: { in: KINDS[tab] ?? KINDS.media },
        message: { chatId: params.chatId, deletedForAll: false },
      },
      orderBy: { message: { createdAt: 'desc' } },
      take: 61,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        message: {
          select: {
            id: true,
            createdAt: true,
            sender: { select: { id: true, name: true, username: true } },
          },
        },
      },
    });

    const hasMore = attachments.length > 60;
    const page = hasMore ? attachments.slice(0, 60) : attachments;
    return Response.json({ attachments: page, nextCursor: hasMore ? page[page.length - 1].id : null });
  } catch (err) {
    return jsonError(err);
  }
}
