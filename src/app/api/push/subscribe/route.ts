import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** Rough device label from the UA — enough to recognise a session in the list. */
function labelFor(userAgent: string) {
  const os =
    /Windows/.test(userAgent) ? 'Windows'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iOS/.test(userAgent) ? 'iOS'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : 'Неизвестная система';
  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /YaBrowser/.test(userAgent) ? 'Yandex'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'браузер';
  return `${browser} · ${os}`;
}

/** The public VAPID key the service worker needs; null when push is unconfigured. */
export async function GET() {
  try {
    await requireUser();
    return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  } catch (err) {
    return jsonError(err);
  }
}

/** Attach a browser push subscription to a Device row (one per endpoint). */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = (await req.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      label?: string;
    };
    if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
      throw new HttpError(400, 'Некорректная подписка');
    }

    const userAgent = req.headers.get('user-agent') ?? '';
    const label = body.label?.slice(0, 60) || labelFor(userAgent);
    const data = {
      label,
      userAgent: userAgent.slice(0, 300),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      pushEndpoint: body.endpoint,
      pushKeys: JSON.stringify({ p256dh: body.keys.p256dh, auth: body.keys.auth }),
      lastActiveAt: new Date(),
    };

    const existing = await prisma.device.findFirst({ where: { userId: me.id, pushEndpoint: body.endpoint } });
    const device = existing
      ? await prisma.device.update({ where: { id: existing.id }, data })
      : await prisma.device.create({ data: { ...data, userId: me.id } });

    return Response.json({ device: { id: device.id, label: device.label } }, { status: existing ? 200 : 201 });
  } catch (err) {
    return jsonError(err);
  }
}

/** Unsubscribe this browser (`?endpoint=…`) without dropping the device row. */
export async function DELETE(req: Request) {
  try {
    const me = await requireUser();
    const endpoint = new URL(req.url).searchParams.get('endpoint');
    if (!endpoint) throw new HttpError(400, 'Не указан endpoint');
    await prisma.device.updateMany({
      where: { userId: me.id, pushEndpoint: endpoint },
      data: { pushEndpoint: null, pushKeys: null },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
