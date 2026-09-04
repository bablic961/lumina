import { prisma } from '@/lib/prisma';
import { jsonError, requireUser } from '@/lib/guards';
import { MESSAGE_INCLUDE, withReactionSummary } from '@/lib/message-dto';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 40;

/** The "Сохранённые" list: bookmarks newest first, with their source chat. */
export async function GET(req: Request) {
  try {
    const me = await requireUser();
    const cursor = new URL(req.url).searchParams.get('cursor');

    const rows = await prisma.savedMessage.findMany({
      where: { userId: me.id, message: { deletedForAll: false } },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        message: {
          include: {
            ...MESSAGE_INCLUDE,
            chat: { select: { id: true, title: true, type: true, avatarUrl: true } },
          },
        },
      },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return Response.json({
      items: page.map((row) => ({
        id: row.id,
        savedAt: row.createdAt,
        message: withReactionSummary(row.message),
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  } catch (err) {
    return jsonError(err);
  }
}
