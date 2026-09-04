import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { atLeast, HttpError, jsonError, requireMember, requireUser } from '@/lib/guards';
import { consumeRateLimit } from '@/lib/rateLimit';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

function baseUrl(req: Request) {
  return process.env.NEXTAUTH_URL || new URL(req.url).origin;
}

/** Create an invite link. Admins only; DMs cannot be invited into. */
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);
    if (member.chat.type === 'DM') throw new HttpError(400, 'Для личных чатов ссылок нет');
    if (!atLeast(member.role, 'ADMIN')) throw new HttpError(403, 'Недостаточно прав');

    await consumeRateLimit('invite.create', me.id);

    const body = (await req.json().catch(() => ({}))) as { maxUses?: number | null; ttlHours?: number | null };
    const ttl = body.ttlHours ?? null;

    const invite = await prisma.invite.create({
      data: {
        chatId: params.chatId,
        code: randomBytes(6).toString('base64url'),
        createdById: me.id,
        maxUses: body.maxUses ?? null,
        expiresAt: ttl ? new Date(Date.now() + ttl * 3_600_000) : null,
      },
    });

    return Response.json({ invite, url: `${baseUrl(req)}/join/${invite.code}` });
  } catch (err) {
    return jsonError(err);
  }
}

/** Revoke a link: `?code=…` */
export async function DELETE(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);
    if (!atLeast(member.role, 'ADMIN')) throw new HttpError(403, 'Недостаточно прав');

    const code = new URL(req.url).searchParams.get('code');
    if (!code) throw new HttpError(400, 'Не указан код');
    await prisma.invite.deleteMany({ where: { code, chatId: params.chatId } });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
