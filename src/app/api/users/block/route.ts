import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** My block list. */
export async function GET() {
  try {
    const me = await requireUser();
    const blocks = await prisma.block.findMany({
      where: { blockerId: me.id },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: { select: { id: true, name: true, username: true, avatarUrl: true, verified: true } },
      },
    });
    return Response.json({ blocks });
  } catch (err) {
    return jsonError(err);
  }
}

/** Block a user (idempotent). */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const { userId } = (await req.json()) as { userId?: string };
    if (!userId) throw new HttpError(400, 'Не указан пользователь');
    if (userId === me.id) throw new HttpError(400, 'Нельзя заблокировать себя');

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) throw new HttpError(404, 'Пользователь не найден');

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: userId } },
      update: {},
      create: { blockerId: me.id, blockedId: userId },
    });
    return Response.json({ ok: true, blocked: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** Unblock: `?userId=…` */
export async function DELETE(req: Request) {
  try {
    const me = await requireUser();
    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) throw new HttpError(400, 'Не указан пользователь');
    await prisma.block.deleteMany({ where: { blockerId: me.id, blockedId: userId } });
    return Response.json({ ok: true, blocked: false });
  } catch (err) {
    return jsonError(err);
  }
}
