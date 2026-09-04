import Anthropic, { APIError, AuthenticationError, RateLimitError } from '@anthropic-ai/sdk';
import { HttpError } from '@/lib/guards';

/** Opus 5 unless the deployment pins something else. */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

let client: Anthropic | null = null;

/** null when no key is configured — every AI feature degrades to "unavailable". */
export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

export const LUMINA_SYSTEM = [
  'Ты — Lumina AI, встроенный помощник мессенджера Lumina.',
  'Отвечай кратко (до 4–5 предложений), по делу и на языке собеседника.',
  'Тебе показывают несколько последних сообщений чата только как контекст — не пересказывай их без просьбы.',
  'Ты не участник переписки: не выдумывай факты о людях и не притворяйся кем-то из них.',
  'Форматирование: обычный текст, эмодзи умеренно, код — в тройных обратных кавычках.',
].join(' ');

/** Concatenate the text blocks of a reply, ignoring thinking blocks. */
export function textOf(message: Anthropic.Message) {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** One-shot ask with the assistant persona; throws HttpError so routes can just rethrow. */
export async function askLumina(prompt: string, context?: string, maxTokens = 2048) {
  const anthropic = getAnthropic();
  if (!anthropic) throw new HttpError(503, 'AI-помощник не настроен (нет ANTHROPIC_API_KEY)');

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system: LUMINA_SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: context ? `Последние сообщения чата:\n${context}\n\nЗапрос: ${prompt}` : prompt,
        },
      ],
    });
    const text = textOf(message);
    if (!text) throw new HttpError(502, 'Пустой ответ помощника');
    return text;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof AuthenticationError) throw new HttpError(503, 'Ключ AI отклонён');
    if (err instanceof RateLimitError) throw new HttpError(429, 'Слишком много запросов к AI, попробуйте позже');
    if (err instanceof APIError) throw new HttpError(502, 'AI-сервис недоступен');
    throw err;
  }
}
