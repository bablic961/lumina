import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const folderSchema = z.object({
  name: z.string().trim().min(1, 'Нужно название').max(40),
  icon: z.string().trim().max(8).optional(),
});

/** Sidebar tabs. `icon` doubles as the emoji the client renders. */
export async function GET() {
  try {
    const me = await requireUser();
    const folders = await prisma.folder.findMany({
      where: { userId: me.id },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, icon: true, order: true },
    });
    return Response.json({
      folders: folders.map((folder) => ({ ...folder, emoji: folder.icon || null })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = folderSchema.parse(await req.json());
    const count = await prisma.folder.count({ where: { userId: me.id } });
    if (count >= 20) throw new HttpError(400, 'Больше 20 папок не поддерживается');

    const folder = await prisma.folder.create({
      data: { userId: me.id, name: body.name, icon: body.icon || 'folder', order: count },
      select: { id: true, name: true, icon: true, order: true },
    });
    return Response.json({ folder: { ...folder, emoji: folder.icon || null } }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

/** Rename/re-icon a folder, or reorder it. `?id=` identifies the folder. */
export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Не указана папка');
    const body = folderSchema.partial().extend({ order: z.number().int().min(0).max(99).optional() }).parse(await req.json());

    const { count } = await prisma.folder.updateMany({
      where: { id, userId: me.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.icon !== undefined ? { icon: body.icon || 'folder' } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
    });
    if (count === 0) throw new HttpError(404, 'Папка не найдена');
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await requireUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Не указана папка');
    const { count } = await prisma.folder.deleteMany({ where: { id, userId: me.id } });
    if (count === 0) throw new HttpError(404, 'Папка не найдена');
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
