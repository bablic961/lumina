import { prisma } from '@/lib/prisma';
import { jsonError, requireUser } from '@/lib/guards';
import { createChatSchema } from '@/lib/validators';
import { emitToUser, getIo } from '@/lib/io';
import type { ChatListItemDTO, ContentType } from '@/types';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** Chat list: newest activity first, pinned on top, with per-member unread counts. */
export async function GET() {
  try {
    const me = await requireUser();
    const memberships = await prisma.chatMember.findMany({
      where: { userId: me.id },
      include: {
        chat: {
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
                    statusEmoji: true,
                    statusText: true,
                    lastSeenAt: true,
                    showPresence: true,
                  },
                },
              },
            },
            messages: {
              where: { deletedForAll: false },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, name: true } } },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { chat: { lastMessageAt: 'desc' } },
    });

    const chats: ChatListItemDTO[] = await Promise.all(
      memberships.map(async (member) => {
        const { chat } = member;
        const peerMember = chat.type === 'DM' ? chat.members.find((m) => m.userId !== me.id) : null;
        const peer = peerMember
          ? {
              id: peerMember.user.id,
              name: peerMember.user.name,
              username: peerMember.user.username,
              avatarUrl: peerMember.user.avatarUrl,
              verified: peerMember.user.verified,
              presence: peerMember.user.showPresence ? peerMember.user.presence : 'OFFLINE',
              statusEmoji: peerMember.user.statusEmoji,
              statusText: peerMember.user.statusText,
              lastSeenAt: peerMember.user.showPresence ? peerMember.user.lastSeenAt : null,
            }
          : null;

        const unreadCount = await prisma.message.count({
          where: {
            chatId: chat.id,
            createdAt: { gt: member.lastReadAt },
            senderId: { not: me.id },
            deletedForAll: false,
          },
        });

        const last = chat.messages[0];
        return {
          id: chat.id,
          type: chat.type as ChatListItemDTO['type'],
          title: chat.type === 'DM' ? (peer?.name ?? 'Диалог') : (chat.title ?? 'Без названия'),
          avatarUrl: chat.type === 'DM' ? (peer?.avatarUrl ?? null) : chat.avatarUrl,
          description: chat.description,
          wallpaper: chat.wallpaper,
          e2eEnabled: chat.e2eEnabled,
          onlyAdminsCanPost: chat.onlyAdminsCanPost,
          memberCount: chat._count.members,
          role: member.role as ChatListItemDTO['role'],
          isPinned: member.isPinned,
          isArchived: member.isArchived,
          folderId: member.folderId,
          notificationsEnabled: member.notificationsEnabled,
          muteUntil: member.muteUntil?.toISOString() ?? null,
          draft: member.draft,
          unreadCount,
          lastMessageAt: chat.lastMessageAt.toISOString(),
          lastMessage: last
            ? {
                id: last.id,
                content: last.content,
                contentType: last.contentType as ContentType,
                createdAt: last.createdAt.toISOString(),
                senderId: last.senderId,
                senderName: last.sender?.name ?? null,
                deletedForAll: last.deletedForAll,
              }
            : null,
          peer,
        } as ChatListItemDTO;
      }),
    );

    chats.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return Response.json({ chats });
  } catch (err) {
    return jsonError(err);
  }
}

/** Creates a DM (idempotent — reuses the existing one), group or channel. */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = createChatSchema.parse(await req.json());
    const memberIds = [...new Set(body.memberIds.filter((id) => id !== me.id))];

    if (body.type === 'DM') {
      if (memberIds.length !== 1) {
        return Response.json({ error: 'Личный чат требует одного собеседника' }, { status: 422 });
      }
      const existing = await prisma.chat.findFirst({
        where: {
          type: 'DM',
          AND: [{ members: { some: { userId: me.id } } }, { members: { some: { userId: memberIds[0] } } }],
        },
      });
      if (existing) return Response.json({ chatId: existing.id, existing: true });
    }

    if (body.type !== 'DM' && !body.title) {
      return Response.json({ error: 'Укажите название' }, { status: 422 });
    }

    const chat = await prisma.chat.create({
      data: {
        type: body.type,
        title: body.title,
        description: body.description,
        avatarUrl: body.avatarUrl ?? null,
        e2eEnabled: body.type === 'DM' ? body.e2eEnabled : false,
        onlyAdminsCanPost: body.type === 'CHANNEL' ? true : body.onlyAdminsCanPost,
        createdById: me.id,
        members: {
          create: [
            { userId: me.id, role: body.type === 'DM' ? 'MEMBER' : 'OWNER' },
            ...memberIds.map((userId) => ({ userId, role: 'MEMBER' })),
          ],
        },
      },
    });

    if (body.type !== 'DM') {
      await prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: me.id,
          contentType: 'SYSTEM',
          content: `${me.name} создал${body.type === 'CHANNEL' ? ' канал' : ' группу'} «${body.title}»`,
        },
      });
    }

    const io = getIo();
    for (const userId of [me.id, ...memberIds]) {
      emitToUser(userId, 'chat:created', { chatId: chat.id });
      io?.in(`user:${userId}`).socketsJoin(`chat:${chat.id}`);
    }

    return Response.json({ chatId: chat.id }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
