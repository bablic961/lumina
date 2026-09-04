import { prisma } from '@/lib/prisma';
import { jsonError, requireAdmin } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/** Append-only moderation trail; `?cursor=` walks backwards in time. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const action = url.searchParams.get('action');

    const rows = await prisma.auditLog.findMany({
      where: action ? { action: { startsWith: action } } : {},
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { actor: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    return Response.json({ items, nextCursor: hasMore ? items[items.length - 1]?.id : null });
  } catch (err) {
    return jsonError(err);
  }
}
