import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { atLeast, HttpError, jsonError, requireMember, requireUser } from '@/lib/guards';
import { emitToChat } from '@/lib/io';
import { MESSAGE_INCLUDE, withReactionSummary } from '@/lib/message-dto';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const pollSchema = z.object({
  question: z.string().trim().min(1, 'Нужен вопрос').max(300),
  options: z.array(z.string().trim().min(1).max(120)).min(2, 'Минимум два варианта').max(10),
  multiple: z.boolean().optional().default(false),
  anonymous: z.boolean().optional().default(true),
  closesInHours: z.number().int().min(1).max(24 * 30).optional(),
});

/** Creates a POLL message; votes themselves travel over the socket (`poll:vote`). */
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);

    const readOnly = member.chat.type === 'CHANNEL' || member.chat.onlyAdminsCanPost;
    if (readOnly && !atLeast(member.role, 'MODERATOR')) {
      throw new HttpError(403, 'Опросы могут создавать только администраторы');
    }

    const body = pollSchema.parse(await req.json());
    const options = [...new Set(body.options)];
    if (options.length < 2) throw new HttpError(422, 'Варианты не должны повторяться');

    const message = await prisma.message.create({
      data: {
        chatId: params.chatId,
        senderId: me.id,
        content: body.question,
        contentType: 'POLL',
        poll: {
          create: {
            question: body.question,
            multiple: body.multiple,
            anonymous: body.anonymous,
            closesAt: body.closesInHours ? new Date(Date.now() + body.closesInHours * 3600_000) : null,
            options: { create: options.map((text, order) => ({ text, order })) },
          },
        },
      },
      include: MESSAGE_INCLUDE,
    });

    await prisma.chat.update({ where: { id: params.chatId }, data: { lastMessageAt: message.createdAt } });

    const payload = withReactionSummary(message);
    emitToChat(params.chatId, 'message:new', payload);
    return Response.json({ message: payload }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
