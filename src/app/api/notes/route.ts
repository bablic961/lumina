import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';
import { noteSchema } from '@/lib/validators';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/**
 * Encrypted personal notes. Everything here is ciphertext produced in the
 * browser (`sealNote`), so the server can store and list notes but never read
 * them — losing the passphrase means losing the note.
 */
export async function GET() {
  try {
    const me = await requireUser();
    const notes = await prisma.note.findMany({
      where: { userId: me.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, cipherText: true, iv: true, createdAt: true, updatedAt: true },
    });
    return Response.json({ notes });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = noteSchema.parse(await req.json());
    const count = await prisma.note.count({ where: { userId: me.id } });
    if (count >= 500) throw new HttpError(400, 'Достигнут предел 500 заметок');

    const note = await prisma.note.create({
      data: { userId: me.id, title: body.title, cipherText: body.cipherText, iv: body.iv },
      select: { id: true, title: true, cipherText: true, iv: true, createdAt: true, updatedAt: true },
    });
    return Response.json({ note }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Не указана заметка');
    const body = noteSchema.parse(await req.json());

    const { count } = await prisma.note.updateMany({
      where: { id, userId: me.id },
      data: { title: body.title, cipherText: body.cipherText, iv: body.iv },
    });
    if (count === 0) throw new HttpError(404, 'Заметка не найдена');
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await requireUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Не указана заметка');
    const { count } = await prisma.note.deleteMany({ where: { id, userId: me.id } });
    if (count === 0) throw new HttpError(404, 'Заметка не найдена');
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
