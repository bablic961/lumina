import { prisma } from '@/lib/prisma';
import { atLeast, HttpError, jsonError, requireMember, requireUser } from '@/lib/guards';
import { emitToChat, emitToUser } from '@/lib/io';
import type { MemberRole } from '@/types';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'];

/** Invite existing users straight into a group/channel (admins and up). */
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);
    if (member.chat.type === 'DM') throw new HttpError(400, 'В личном чате нельзя добавлять участников');
    if (!atLeast(member.role, 'ADMIN')) throw new HttpError(403, 'Недостаточно прав');

    const { userIds } = (await req.json()) as { userIds?: string[] };
    const ids = (userIds ?? []).filter(Boolean).slice(0, 200);
    if (ids.length === 0) throw new HttpError(400, 'Не выбраны участники');

    const known = await prisma.chatMember.findMany({
      where: { chatId: params.chatId, userId: { in: ids } },
      select: { userId: true },
    });
    const already = new Set(known.map((existing) => existing.userId));
    const users = (
      await prisma.user.findMany({ where: { id: { in: ids }, banned: false }, select: { id: true, name: true } })
    ).filter((u) => !already.has(u.id));
    if (users.length === 0) throw new HttpError(400, 'Выбранные пользователи уже в чате');
    const total = await prisma.chatMember.count({ where: { chatId: params.chatId } });
    if (total + users.length > 2000) throw new HttpError(400, 'Достигнут предел 2000 участников');

    await prisma.chatMember.createMany({
      data: users.map((u) => ({ chatId: params.chatId, userId: u.id, role: 'MEMBER' })),
    });
    await prisma.message.create({
      data: {
        chatId: params.chatId,
        senderId: me.id,
        contentType: 'SYSTEM',
        content: `${me.name} добавил(а): ${users.map((u) => u.name).join(', ')}`,
      },
    });

    emitToChat(params.chatId, 'chat:members-added', { chatId: params.chatId, userIds: users.map((u) => u.id) });
    for (const user of users) emitToUser(user.id, 'chat:created', { chatId: params.chatId });
    return Response.json({ ok: true, added: users.length });
  } catch (err) {
    return jsonError(err);
  }
}

/** Change a member's role or custom role. Nobody may outrank themselves. */
export async function PATCH(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);
    const body = (await req.json()) as { userId?: string; role?: MemberRole; customRoleId?: string | null };
    if (!body.userId) throw new HttpError(400, 'Не указан участник');
    if (!atLeast(member.role, 'ADMIN')) throw new HttpError(403, 'Недостаточно прав');

    const target = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: params.chatId, userId: body.userId } },
    });
    if (!target) throw new HttpError(404, 'Участник не найден');
    if (atLeast(target.role, 'OWNER') && member.role !== 'OWNER') throw new HttpError(403, 'Владельца изменить нельзя');

    const data: Record<string, unknown> = {};
    if (body.role) {
      if (!ROLES.includes(body.role)) throw new HttpError(400, 'Неизвестная роль');
      // Only the owner may hand over ownership; everything else is admin-grade.
      if (body.role === 'OWNER' && member.role !== 'OWNER') throw new HttpError(403, 'Передать владение может только владелец');
      data.role = body.role;
    }
    if ('customRoleId' in body) data.customRoleId = body.customRoleId;
    if (!Object.keys(data).length) throw new HttpError(400, 'Нечего менять');

    await prisma.chatMember.update({
      where: { chatId_userId: { chatId: params.chatId, userId: body.userId } },
      data,
    });
    if (body.role === 'OWNER') {
      await prisma.chatMember.update({
        where: { chatId_userId: { chatId: params.chatId, userId: me.id } },
        data: { role: 'ADMIN' },
      });
    }

    emitToChat(params.chatId, 'chat:member-updated', { chatId: params.chatId, userId: body.userId, role: body.role });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** Kick a member: `?userId=…` (moderators and up, and never someone senior). */
export async function DELETE(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);
    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) throw new HttpError(400, 'Не указан участник');
    if (userId === me.id) throw new HttpError(400, 'Используйте выход из чата');
    if (!atLeast(member.role, 'MODERATOR')) throw new HttpError(403, 'Недостаточно прав');

    const target = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: params.chatId, userId } },
      include: { user: { select: { name: true } } },
    });
    if (!target) throw new HttpError(404, 'Участник не найден');
    if (atLeast(target.role, member.role as MemberRole)) throw new HttpError(403, 'Нельзя исключить равного или старшего');

    await prisma.chatMember.delete({ where: { chatId_userId: { chatId: params.chatId, userId } } });
    await prisma.message.create({
      data: {
        chatId: params.chatId,
        senderId: me.id,
        contentType: 'SYSTEM',
        content: `${me.name} исключил(а) ${target.user.name}`,
      },
    });

    emitToChat(params.chatId, 'chat:member-left', { chatId: params.chatId, userId });
    emitToUser(userId, 'chat:deleted', { chatId: params.chatId });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
