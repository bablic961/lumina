import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireAdmin } from '@/lib/guards';
import { getIo } from '@/lib/io';
import type { Importance } from '@/types';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const CHUNK = 500;

/**
 * Platform announcement. Writes a Notification per active account and pings
 * connected clients; Web Push fan-out is intentionally left to the socket
 * server, which owns the VAPID keys.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as { title?: string; body?: string; importance?: Importance };
    const title = (body.title ?? '').trim().slice(0, 120);
    const text = (body.body ?? '').trim().slice(0, 1000) || null;
    const importance: Importance = body.importance === 'HIGH' || body.importance === 'LOW' ? body.importance : 'NORMAL';
    if (!title) throw new HttpError(400, 'Нужен заголовок рассылки');

    const users = await prisma.user.findMany({ where: { banned: false }, select: { id: true } });
    for (let index = 0; index < users.length; index += CHUNK) {
      await prisma.notification.createMany({
        data: users.slice(index, index + CHUNK).map((user) => ({
          userId: user.id,
          type: 'SYSTEM',
          title,
          body: text,
          importance,
        })),
      });
    }

    getIo()?.emit('notification:broadcast', { title, body: text, importance, at: new Date().toISOString() });
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'broadcast.send',
        target: `${users.length} получателей`,
        meta: JSON.stringify({ title, importance }),
      },
    });

    return Response.json({ ok: true, recipients: users.length }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
