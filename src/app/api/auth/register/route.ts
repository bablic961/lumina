import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validators';
import { jsonError } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());
    const email = body.email.toLowerCase();
    const username = body.username.toLowerCase();

    const clash = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (clash) {
      return Response.json(
        { error: clash.email === email ? 'Этот email уже занят' : 'Этот @username уже занят' },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        name: body.name,
        passwordHash: await bcrypt.hash(body.password, 12),
        locale: 'ru',
      },
      select: { id: true, email: true, username: true, name: true },
    });

    // Welcome badge + private notes space are created eagerly so the first
    // session already has something in it.
    await prisma.badge.create({ data: { userId: user.id, key: 'early-bird' } }).catch(() => {});

    return Response.json({ user }, { status: 201 });
  } catch (err) {
    if (err && typeof err === 'object' && 'issues' in err) {
      const issues = (err as { issues: { message: string }[] }).issues;
      return Response.json({ error: issues[0]?.message ?? 'Некорректные данные' }, { status: 422 });
    }
    return jsonError(err);
  }
}
