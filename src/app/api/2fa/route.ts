import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';
import { generateSecret, otpauthUrl, verifyTotp } from '@/lib/totp';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** Current state; the secret is only ever returned while setup is pending. */
export async function GET() {
  try {
    const me = await requireUser();
    return Response.json({
      enabled: me.twoFactorEnabled,
      pending: Boolean(me.twoFactorSecret) && !me.twoFactorEnabled,
    });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Start enrolment: mint a secret and hand back the otpauth:// URI for the QR.
 * The secret is stored immediately but stays inert until a code confirms it.
 */
export async function POST() {
  try {
    const me = await requireUser();
    if (me.twoFactorEnabled) throw new HttpError(400, 'Двухфакторная защита уже включена');

    const secret = generateSecret();
    await prisma.user.update({ where: { id: me.id }, data: { twoFactorSecret: secret } });
    return Response.json({ secret, otpauthUrl: otpauthUrl(secret, me.email) });
  } catch (err) {
    return jsonError(err);
  }
}

/** Confirm enrolment with the first code from the authenticator app. */
export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const { code } = (await req.json()) as { code?: string };
    if (!me.twoFactorSecret) throw new HttpError(400, 'Сначала запросите QR-код');
    if (!code || !verifyTotp(me.twoFactorSecret, code)) throw new HttpError(422, 'Неверный код');

    await prisma.user.update({ where: { id: me.id }, data: { twoFactorEnabled: true } });
    await prisma.auditLog.create({ data: { actorId: me.id, action: '2fa.enable', target: me.id } });
    return Response.json({ enabled: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** Turn it off — a valid code is required, so a stolen session cannot do it. */
export async function DELETE(req: Request) {
  try {
    const me = await requireUser();
    const code = new URL(req.url).searchParams.get('code') ?? '';
    if (!me.twoFactorEnabled) {
      await prisma.user.update({ where: { id: me.id }, data: { twoFactorSecret: null } });
      return Response.json({ enabled: false });
    }
    if (!me.twoFactorSecret || !verifyTotp(me.twoFactorSecret, code)) throw new HttpError(422, 'Неверный код');

    await prisma.user.update({
      where: { id: me.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await prisma.auditLog.create({ data: { actorId: me.id, action: '2fa.disable', target: me.id } });
    return Response.json({ enabled: false });
  } catch (err) {
    return jsonError(err);
  }
}
