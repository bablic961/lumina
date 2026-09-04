import { prisma } from '@/lib/prisma';
import { atLeast, jsonError, requireMember, requireUser } from '@/lib/guards';
import { consumeRateLimit } from '@/lib/rateLimit';
import { messageSchema } from '@/lib/validators';
import { emitToChat } from '@/lib/io';
import { MESSAGE_INCLUDE, withReactionSummary } from '@/lib/message-dto';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/** Cursor pagination, newest page first; `cursor` is the oldest id already held. */
export async function GET(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    await requireMember(params.chatId, me.id);

    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const around = url.searchParams.get('around');

    if (around) {
      const anchor = await prisma.message.findUnique({ where: { id: around } });
      if (!anchor) return Response.json({ error: 'Сообщение не найдено' }, { status: 404 });
      const [before, after] = await Promise.all([
        prisma.message.findMany({
          where: { chatId: params.chatId, createdAt: { lt: anchor.createdAt } },
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: MESSAGE_INCLUDE,
        }),
        prisma.message.findMany({
          where: { chatId: params.chatId, createdAt: { gte: anchor.createdAt } },
          orderBy: { createdAt: 'asc' },
          take: 25,
          include: MESSAGE_INCLUDE,
        }),
      ]);
      return Response.json({
        messages: [...before.reverse(), ...after].map(withReactionSummary),
        hasMore: before.length === 25,
      });
    }

    const rows = await prisma.message.findMany({
      where: { chatId: params.chatId },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: MESSAGE_INCLUDE,
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return Response.json({
      messages: page.reverse().map(withReactionSummary),
      hasMore,
      nextCursor: hasMore ? page[0]?.id : null,
    });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * HTTP send path. The socket layer is the fast lane; this exists so a message
 * still lands when the websocket is down (flaky network, proxy stripping WS).
 */
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const me = await requireUser();
    const member = await requireMember(params.chatId, me.id);
    const body = messageSchema.parse(await req.json());

    const readOnly = member.chat.type === 'CHANNEL' || member.chat.onlyAdminsCanPost;
    if (readOnly && !atLeast(member.role, 'MODERATOR')) {
      return Response.json({ error: 'Писать могут только администраторы' }, { status: 403 });
    }
    if (!body.content.trim() && body.attachments.length === 0 && !body.stickerId) {
      return Response.json({ error: 'Пустое сообщение' }, { status: 422 });
    }

    await consumeRateLimit('message.send', me.id);

    const ttl = body.selfDestructSec ?? null;
    const message = await prisma.message.create({
      data: {
        chatId: params.chatId,
        senderId: me.id,
        content: body.content,
        contentType: body.contentType,
        codeLanguage: body.codeLanguage ?? null,
        replyToId: body.replyToId ?? null,
        forwardedFromId: body.forwardedFromId ?? null,
        stickerId: body.stickerId ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        locationName: body.locationName ?? null,
        selfDestructSec: ttl,
        expiresAt: ttl ? new Date(Date.now() + ttl * 1000) : null,
        attachments: body.attachments.length
          ? {
              create: body.attachments.map((a) => ({
                kind: a.kind,
                url: a.url,
                thumbUrl: a.thumbUrl ?? null,
                name: a.name,
                mime: a.mime,
                size: a.size,
                width: a.width ?? null,
                height: a.height ?? null,
                duration: a.duration ?? null,
                waveform: a.waveform ? JSON.stringify(a.waveform) : null,
                ocrText: a.ocrText ?? null,
              })),
            }
          : undefined,
      },
      include: MESSAGE_INCLUDE,
    });

    await prisma.chat.update({
      where: { id: params.chatId },
      data: { lastMessageAt: message.createdAt },
    });
    await prisma.chatMember.update({
      where: { chatId_userId: { chatId: params.chatId, userId: me.id } },
      data: { draft: null, lastReadAt: new Date(), lastReadMessageId: message.id },
    });

    const payload = withReactionSummary(message);
    emitToChat(params.chatId, 'message:new', payload);
    return Response.json({ message: payload }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
