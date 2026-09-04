import { jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** Languages the UI ships with, plus the neighbours people actually ask for. */
const LANGS = new Set([
  'ru', 'en', 'es', 'de', 'fr', 'zh', 'ja', 'ko',
  'it', 'pt', 'pl', 'tr', 'uk', 'ar', 'he', 'nl', 'cs', 'sv', 'fi', 'kk', 'be', 'hi',
]);

/** Self-hosted LibreTranslate: preferred when configured, no rate limits of its own. */
async function viaLibre(base: string, text: string, target: string, source: string) {
  const res = await fetch(new URL('/translate', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'auto',
      target,
      format: 'text',
      ...(process.env.LIBRETRANSLATE_KEY ? { api_key: process.env.LIBRETRANSLATE_KEY } : {}),
    }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { translatedText?: string };
  void source;
  return data.translatedText?.trim() || null;
}

/** Keyless fallback. MyMemory needs an explicit pair, so guess the source by script. */
async function viaMyMemory(text: string, target: string, source: string) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${source}|${target}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
  if (data.responseStatus !== 200) return null;
  const out = data.responseData?.translatedText?.trim();
  // MyMemory echoes a shouty placeholder instead of failing on an unsupported pair.
  if (!out || /^(NO QUERY SPECIFIED|INVALID)/i.test(out)) return null;
  return out;
}

/** `/translate <lang> <текст>` → the translation, ready to send as a message. */
export async function POST(req: Request) {
  try {
    await requireUser();
    const body = (await req.json()) as { target?: string; text?: string };
    const target = (body.target ?? '').trim().toLowerCase().slice(0, 5);
    const text = (body.text ?? '').trim().slice(0, 2000);

    if (!LANGS.has(target)) {
      return Response.json({ error: 'Формат: /translate en текст (ru, en, es, de, fr, zh, ja, ko…)' }, { status: 400 });
    }
    if (!text) return Response.json({ error: 'Нечего переводить' }, { status: 400 });

    const cyrillic = /[Ѐ-ӿ]/.test(text);
    let source = cyrillic ? 'ru' : 'en';
    if (source === target) source = cyrillic ? 'en' : 'ru';

    const base = process.env.LIBRETRANSLATE_URL;
    const translated =
      (base ? await viaLibre(base, text, target, source).catch(() => null) : null) ??
      (await viaMyMemory(text, target, source).catch(() => null));

    if (!translated) return Response.json({ error: 'Переводчик недоступен' }, { status: 502 });
    return Response.json({ text: translated });
  } catch (err) {
    return jsonError(err);
  }
}
