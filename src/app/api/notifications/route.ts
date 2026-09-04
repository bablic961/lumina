import { prisma } from '@/lib/prisma';
import { jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

/** Notification centre: newest first, plus the unread badge count. */
export async function GET(req: Request) {
  try {
    const me = await requireUser();
    const cursor = new URL(req.url).searchParams.get('cursor');

    const rows = await prisma.notification.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const unread = await prisma.notification.count({ where: { userId: me.id, read: false } });

    return Response.json({ items, unread, nextCursor: hasMore ? items[items.length - 1]?.id : null });
  } catch (err) {
    return jsonError(err);
  }
}

/** Mark one (`{ id }`) or everything (`{ all: true }`) as read. */
export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
    await prisma.notification.updateMany({
      where: { userId: me.id, ...(body.id && !body.all ? { id: body.id } : { read: false }) },
      data: { read: true },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** Clear the list: everything, or only what has been read (`?readOnly=1`). */
export async function DELETE(req: Request) {
  try {
    const me = await requireUser();
    const readOnly = new URL(req.url).searchParams.get('readOnly') === '1';
    await prisma.notification.deleteMany({ where: { userId: me.id, ...(readOnly ? { read: true } : {}) } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
