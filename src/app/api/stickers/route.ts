import { prisma } from '@/lib/prisma';
import { jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/**
 * Packs available to this account: every global pack plus the ones it authored.
 * `emoji` is borrowed from the first sticker so the picker has a tab label even
 * when a pack has no cover image.
 */
export async function GET() {
  try {
    const me = await requireUser();
    const packs = await prisma.stickerPack.findMany({
      where: { OR: [{ isGlobal: true }, { authorId: me.id }] },
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
      include: { stickers: { orderBy: { id: 'asc' } } },
    });

    return Response.json({
      packs: packs.map((pack) => ({
        id: pack.id,
        name: pack.name,
        slug: pack.slug,
        coverUrl: pack.coverUrl,
        emoji: pack.stickers[0]?.emoji ?? null,
        stickers: pack.stickers.map((sticker) => ({
          id: sticker.id,
          url: sticker.url,
          emoji: sticker.emoji,
          animated: pack.animated,
        })),
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
