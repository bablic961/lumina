import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireMember, requireUser } from '@/lib/guards';
import { consumeRateLimit } from '@/lib/rateLimit';
import { askLumina } from '@/lib/ai';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const PLACEHOLDER: Record<string, string> = {
  VOICE: '[голосовое сообщение]',
  FILE: '[файл]',
  IMAGE: '[изображение]',
  VIDEO: '[видео]',
  STICKER: '[стикер]',
  POLL: '[опрос]',
  CALL: '[звонок]',
  LOCATION: '[геопозиция]',
};

/** The last few turns, oldest first, so the assistant can resolve "а он что ответил?". */
async function chatContext(chatId: string) {
  const rows = await prisma.message.findMany({
    where: { chatId, deletedAt: null, contentType: { not: 'SYSTEM' } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { content: true, contentType: true, sender: { select: { name: true } } },
  });
  return rows
    .reverse()
    .map((row) => {
      const body = PLACEHOLDER[row.contentType] ?? row.content.slice(0, 400);
      return `${row.sender?.name ?? 'Кто-то'}: ${body}`;
    })
    .join('\n');
}

/** `/ai <вопрос>` and `@lumina` mentions: answer with the chat as context. */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = (await req.json()) as { chatId?: string; prompt?: string };
    const prompt = (body.prompt ?? '').trim().slice(0, 4000);
    if (!body.chatId) throw new HttpError(400, 'Не указан чат');
    if (!prompt) throw new HttpError(400, 'Задайте вопрос: /ai как дела?');

    await requireMember(body.chatId, me.id);
    await consumeRateLimit('integrations.ai', me.id);

    const text = await askLumina(prompt, await chatContext(body.chatId));
    return Response.json({ text });
  } catch (err) {
    return jsonError(err);
  }
}
