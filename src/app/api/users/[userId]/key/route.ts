import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/**
 * Public ECDH key of a peer, used to derive the shared AES key for E2E DMs.
 * Only readable by someone who already shares a chat with that user.
 */
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const me = await requireUser();
    const shared = await prisma.chatMember.findFirst({
      where: {
        userId: params.userId,
        chat: { members: { some: { userId: me.id } } },
      },
      select: { id: true },
    });
    if (!shared && params.userId !== me.id) throw new HttpError(403, 'Нет общих чатов');

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, e2ePublicKey: true },
    });
    if (!user) throw new HttpError(404, 'Пользователь не найден');
    return Response.json({ userId: user.id, publicKey: user.e2ePublicKey });
  } catch (err) {
    return jsonError(err);
  }
}
