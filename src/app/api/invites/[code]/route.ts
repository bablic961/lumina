import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';
import { emitToChat } from '@/lib/io';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

async function load(code: string) {
  const invite = await prisma.invite.findUnique({
    where: { code },
    include: {
      chat: {
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          avatarUrl: true,
          _count: { select: { members: true } },
        },
      },
    },
  });
  if (!invite) throw new HttpError(404, 'Ссылка недействительна');
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) throw new HttpError(410, 'Срок ссылки истёк');
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) throw new HttpError(410, 'Ссылка исчерпана');
  return invite;
}

/** Preview an invite before joining. */
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  try {
    const me = await requireUser();
    const invite = await load(params.code);
    const already = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: invite.chatId, userId: me.id } },
      select: { id: true },
    });
    return Response.json({ chat: invite.chat, alreadyMember: Boolean(already) });
  } catch (err) {
    return jsonError(err);
  }
}

/** Redeem the invite and join the chat. */
export async function POST(_req: Request, { params }: { params: { code: string } }) {
  try {
    const me = await requireUser();
    const invite = await load(params.code);

    const already = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: invite.chatId, userId: me.id } },
      select: { id: true },
    });
    if (already) return Response.json({ ok: true, chatId: invite.chatId, joined: false });

    const total = await prisma.chatMember.count({ where: { chatId: invite.chatId } });
    if (total >= 2000) throw new HttpError(400, 'В чате уже 2000 участников');

    await prisma.$transaction([
      prisma.chatMember.create({ data: { chatId: invite.chatId, userId: me.id, role: 'MEMBER' } }),
      prisma.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } }),
      prisma.message.create({
        data: {
          chatId: invite.chatId,
          senderId: me.id,
          contentType: 'SYSTEM',
          content: `${me.name} присоединился(ась) по ссылке`,
        },
      }),
    ]);

    emitToChat(invite.chatId, 'chat:members-added', { chatId: invite.chatId, userIds: [me.id] });
    return Response.json({ ok: true, chatId: invite.chatId, joined: true });
  } catch (err) {
    return jsonError(err);
  }
}
