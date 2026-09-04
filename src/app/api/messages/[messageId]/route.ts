import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { atLeast, HttpError, jsonError, requireMember, requireUser } from '@/lib/guards';
import { emitToChat, emitToUser } from '@/lib/io';
import { MESSAGE_INCLUDE, withReactionSummary } from '@/lib/message-dto';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  content: z.string().max(8000).optional(),
  isPinned: z.boolean().optional(),
});

async function loadMessage(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || (message.deletedForAll && message.deletedAt)) throw new HttpError(404, 'Сообщение не найдено');
  const member = await requireMember(message.chatId, userId);
  return { message, member };
}

/**
 * HTTP twin of the `message:edit` / `message:pin` socket events, used when the
 * websocket is unavailable. Same permissions: authors edit, moderators pin.
 */
export async function PATCH(req: Request, { params }: { params: { messageId: string } }) {
  try {
    const me = await requireUser();
    const { message, member } = await loadMessage(params.messageId, me.id);
    const body = patchSchema.parse(await req.json());

    if (body.content !== undefined) {
      if (message.senderId !== me.id) throw new HttpError(403, 'Редактировать можно только свои сообщения');
      if (!body.content.trim()) throw new HttpError(422, 'Пустое сообщение');
    }
    if (body.isPinned !== undefined && member.chat.type !== 'DM' && !atLeast(member.role, 'MODERATOR')) {
      throw new HttpError(403, 'Закреплять могут только администраторы');
    }

    const updated = await prisma.message.update({
      where: { id: params.messageId },
      data: {
        ...(body.content !== undefined ? { content: body.content, editedAt: new Date() } : {}),
        ...(body.isPinned !== undefined ? { isPinned: body.isPinned } : {}),
      },
      include: MESSAGE_INCLUDE,
    });

    const payload = withReactionSummary(updated);
    if (body.content !== undefined) emitToChat(message.chatId, 'message:edited', payload);
    if (body.isPinned !== undefined) {
      emitToChat(message.chatId, 'message:pinned', { messageId: message.id, pinned: body.isPinned });
    }
    return Response.json({ message: payload });
  } catch (err) {
    return jsonError(err);
  }
}

/** `?forAll=1` tombstones the message for everyone; otherwise it only leaves this account. */
export async function DELETE(req: Request, { params }: { params: { messageId: string } }) {
  try {
    const me = await requireUser();
    const { message, member } = await loadMessage(params.messageId, me.id);
    const forAll = new URL(req.url).searchParams.get('forAll') === '1';

    if (forAll) {
      if (message.senderId !== me.id && !atLeast(member.role, 'MODERATOR')) {
        throw new HttpError(403, 'Недостаточно прав');
      }
      await prisma.message.update({
        where: { id: message.id },
        data: { deletedAt: new Date(), deletedForAll: true, content: '', isPinned: false },
      });
      emitToChat(message.chatId, 'message:deleted', { messageId: message.id, chatId: message.chatId, forAll: true });
    } else {
      await prisma.savedMessage.deleteMany({ where: { userId: me.id, messageId: message.id } });
      emitToUser(me.id, 'message:deleted', { messageId: message.id, chatId: message.chatId, forAll: false });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
