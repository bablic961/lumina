import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireAdmin } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'pack';

/** All packs with their stickers, newest first — the admin view sees non-global ones too. */
export async function GET() {
  try {
    await requireAdmin();
    const packs = await prisma.stickerPack.findMany({
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
      include: {
        stickers: { orderBy: { id: 'asc' } },
        author: { select: { id: true, name: true, username: true } },
      },
    });
    return Response.json({ packs });
  } catch (err) {
    return jsonError(err);
  }
}

/** Create a pack together with its stickers (urls come from `/api/upload`). */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as {
      name?: string;
      coverUrl?: string | null;
      isGlobal?: boolean;
      animated?: boolean;
      stickers?: { url?: string; emoji?: string; name?: string | null }[];
    };
    const name = (body.name ?? '').trim().slice(0, 60);
    const stickers = (body.stickers ?? []).filter((sticker) => sticker.url).slice(0, 120);
    if (!name) throw new HttpError(400, 'Нужно название набора');
    if (stickers.length === 0) throw new HttpError(400, 'Добавьте хотя бы один стикер');

    // Slugs are unique; suffix until we find a free one.
    const base = slugify(name);
    let slug = base;
    for (let attempt = 2; await prisma.stickerPack.findUnique({ where: { slug } }); attempt += 1) {
      slug = `${base}-${attempt}`;
    }

    const pack = await prisma.stickerPack.create({
      data: {
        name,
        slug,
        coverUrl: body.coverUrl || stickers[0]?.url || null,
        isGlobal: body.isGlobal !== false,
        animated: Boolean(body.animated),
        authorId: admin.id,
        stickers: {
          create: stickers.map((sticker) => ({
            url: sticker.url as string,
            emoji: sticker.emoji?.slice(0, 8) || '✨',
            name: sticker.name?.slice(0, 40) || null,
          })),
        },
      },
      include: { stickers: true },
    });
    await prisma.auditLog.create({
      data: { actorId: admin.id, action: 'stickerpack.create', target: pack.id, meta: JSON.stringify({ name, slug }) },
    });

    return Response.json({ pack }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

/** Rename a pack or flip its visibility. */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as { id?: string; name?: string; isGlobal?: boolean; animated?: boolean };
    if (!body.id) throw new HttpError(400, 'Не указан набор');

    const data: Record<string, unknown> = {};
    if (body.name?.trim()) data.name = body.name.trim().slice(0, 60);
    if (typeof body.isGlobal === 'boolean') data.isGlobal = body.isGlobal;
    if (typeof body.animated === 'boolean') data.animated = body.animated;
    if (!Object.keys(data).length) throw new HttpError(400, 'Нечего менять');

    const pack = await prisma.stickerPack.update({ where: { id: body.id }, data });
    await prisma.auditLog.create({
      data: { actorId: admin.id, action: 'stickerpack.update', target: pack.id, meta: JSON.stringify(data) },
    });
    return Response.json({ pack });
  } catch (err) {
    return jsonError(err);
  }
}

/** Delete a pack; stickers cascade and already-sent messages lose the link (SetNull). */
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Не указан набор');
    const { count } = await prisma.stickerPack.deleteMany({ where: { id } });
    if (count === 0) throw new HttpError(404, 'Набор не найден');
    await prisma.auditLog.create({ data: { actorId: admin.id, action: 'stickerpack.delete', target: id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
