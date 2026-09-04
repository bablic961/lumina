import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireMember, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** Bookmarks a message ("Сохранённые"). Idempotent: saving twice is not an error. */
export async function POST(_req: Request, { params }: { params: { messageId: string } }) {
  try {
    const me = await requireUser();
    const message = await prisma.message.findUnique({
      where: { id: params.messageId },
      select: { id: true, chatId: true, deletedForAll: true },
    });
    if (!message || message.deletedForAll) throw new HttpError(404, 'Сообщение не найдено');
    await requireMember(message.chatId, me.id);

    const saved = await prisma.savedMessage.upsert({
      where: { userId_messageId: { userId: me.id, messageId: message.id } },
      create: { userId: me.id, messageId: message.id },
      update: {},
    });
    return Response.json({ saved: true, id: saved.id }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { messageId: string } }) {
  try {
    const me = await requireUser();
    await prisma.savedMessage.deleteMany({ where: { userId: me.id, messageId: params.messageId } });
    return Response.json({ saved: false });
  } catch (err) {
    return jsonError(err);
  }
}
