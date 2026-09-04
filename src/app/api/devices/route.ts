import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';
import { emitToUser } from '@/lib/io';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** Device/session list (also embedded in `/api/users/me`). */
export async function GET() {
  try {
    const me = await requireUser();
    const devices = await prisma.device.findMany({
      where: { userId: me.id },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        label: true,
        userAgent: true,
        ip: true,
        trusted: true,
        lastActiveAt: true,
        createdAt: true,
        pushEndpoint: true,
      },
    });
    return Response.json({
      devices: devices.map(({ pushEndpoint, ...device }) => ({ ...device, pushEnabled: Boolean(pushEndpoint) })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

/** Mark a device trusted (skips the 2FA prompt on next sign-in). */
export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const body = (await req.json()) as { id?: string; trusted?: boolean };
    if (!body.id) throw new HttpError(400, 'Не указано устройство');
    const { count } = await prisma.device.updateMany({
      where: { id: body.id, userId: me.id },
      data: { trusted: Boolean(body.trusted) },
    });
    if (count === 0) throw new HttpError(404, 'Устройство не найдено');
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Revoke a session. JWT sessions cannot be invalidated server-side, so the
 * signed-out device also gets a socket nudge to drop its own credentials.
 */
export async function DELETE(req: Request) {
  try {
    const me = await requireUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Не указано устройство');
    const { count } = await prisma.device.deleteMany({ where: { id, userId: me.id } });
    if (count === 0) throw new HttpError(404, 'Устройство не найдено');
    emitToUser(me.id, 'device:revoked', { deviceId: id });
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
