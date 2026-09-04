import { jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** `/giphy <запрос>` → one GIF url; `{ url: null }` when unset so the client can say so. */
export async function GET(req: Request) {
  try {
    await requireUser();
    const query = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100);
    const key = process.env.GIPHY_API_KEY;
    if (!key) return Response.json({ url: null });

    const url = new URL(query ? 'https://api.giphy.com/v1/gifs/search' : 'https://api.giphy.com/v1/gifs/trending');
    url.searchParams.set('api_key', key);
    url.searchParams.set('limit', '25');
    url.searchParams.set('rating', 'pg-13');
    if (query) {
      url.searchParams.set('q', query);
      url.searchParams.set('lang', 'ru');
    }

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return Response.json({ url: null });
    const data = (await res.json()) as {
      data?: { images?: { downsized_medium?: { url?: string }; original?: { url?: string } } }[];
    };
    const gifs = (data.data ?? [])
      .map((gif) => gif.images?.downsized_medium?.url || gif.images?.original?.url)
      .filter((value): value is string => Boolean(value));
    if (gifs.length === 0) return Response.json({ url: null });

    // A repeated `/giphy` on the same query should not return the same GIF.
    return Response.json({ url: gifs[Math.floor(Math.random() * gifs.length)] });
  } catch (err) {
    return jsonError(err);
  }
}
