import { prisma } from '@/lib/prisma';
import { atLeast, HttpError, jsonError, requireMember, requireUser } from '@/lib/guards';
import { emitToChat } from '@/lib/io';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** Full chat detail: members, pinned messages, invites, my membership settings. */
export async function GET(_req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);

    const [chat, pinned] = await Promise.all([
      prisma.chat.findUnique({
        where: { id: params.chatId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                  verified: true,
                  presence: true,
                  showPresence: true,
                  statusEmoji: true,
                  statusText: true,
                  lastSeenAt: true,
                  bio: true,
                  birthday: true,
                  e2ePublicKey: true,
                },
              },
              customRole: true,
            },
            orderBy: { joinedAt: 'asc' },
          },
          customRoles: true,
          invites: { orderBy: { createdAt: 'desc' }, take: 5 },
          _count: { select: { members: true, messages: true } },
        },
      }),
      prisma.message.findMany({
        where: { chatId: params.chatId, isPinned: true, deletedForAll: false },
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: { id: true, name: true, username: true } } },
      }),
    ]);

    if (!chat) throw new HttpError(404, 'Чат не найден');

    return Response.json({
      chat: {
        ...chat,
        members: chat.members.map((m) => ({
          ...m,
          user: { ...m.user, presence: m.user.showPresence ? m.user.presence : 'OFFLINE' },
        })),
      },
      pinned,
      me: {
        role: member.role,
        notificationsEnabled: member.notificationsEnabled,
        muteUntil: member.muteUntil,
        isArchived: member.isArchived,
        isPinned: member.isPinned,
        folderId: member.folderId,
        draft: member.draft,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * One endpoint for both scopes:
 *  · chat-wide settings (title, wallpaper, slow mode) — admins only
 *  · my own membership (mute, archive, pin, folder) — always allowed
 */
export async function PATCH(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);
    const body = (await req.json()) as Record<string, unknown>;

    const memberPatch: Record<string, unknown> = {};
    for (const key of ['notificationsEnabled', 'isArchived', 'isPinned', 'folderId'] as const) {
      if (key in body) memberPatch[key] = body[key];
    }
    if ('muteForMinutes' in body) {
      const minutes = Number(body.muteForMinutes);
      memberPatch.muteUntil = minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null;
      memberPatch.notificationsEnabled = !(minutes > 0);
    }
    if (Object.keys(memberPatch).length) {
      await prisma.chatMember.update({
        where: { chatId_userId: { chatId: params.chatId, userId: me.id } },
        data: memberPatch,
      });
    }

    const chatPatch: Record<string, unknown> = {};
    const CHAT_KEYS = [
      'title',
      'description',
      'avatarUrl',
      'wallpaper',
      'onlyAdminsCanPost',
      'slowModeSec',
      'e2eEnabled',
    ] as const;
    for (const key of CHAT_KEYS) {
      if (key in body) chatPatch[key] = body[key];
    }
    if (Object.keys(chatPatch).length) {
      if (member.chat.type !== 'DM' && !atLeast(member.role, 'ADMIN')) {
        throw new HttpError(403, 'Недостаточно прав');
      }
      const chat = await prisma.chat.update({ where: { id: params.chatId }, data: chatPatch });
      emitToChat(params.chatId, 'chat:updated', { chatId: chat.id, patch: chatPatch });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** Leave the chat; the last owner leaving deletes it. */
export async function DELETE(_req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);

    await prisma.chatMember.delete({
      where: { chatId_userId: { chatId: params.chatId, userId: me.id } },
    });

    const remaining = await prisma.chatMember.count({ where: { chatId: params.chatId } });
    const owners = await prisma.chatMember.count({ where: { chatId: params.chatId, role: 'OWNER' } });

    if (remaining === 0 || (member.role === 'OWNER' && owners === 0 && member.chat.type !== 'DM')) {
      await prisma.chat.delete({ where: { id: params.chatId } });
      emitToChat(params.chatId, 'chat:deleted', { chatId: params.chatId });
      return Response.json({ ok: true, deleted: true });
    }

    await prisma.message.create({
      data: {
        chatId: params.chatId,
        senderId: me.id,
        contentType: 'SYSTEM',
        content: `${me.name} покинул(а) чат`,
      },
    });
    emitToChat(params.chatId, 'chat:member-left', { chatId: params.chatId, userId: me.id });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
