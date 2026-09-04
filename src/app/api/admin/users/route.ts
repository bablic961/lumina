import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireAdmin } from '@/lib/guards';
import { emitToUser } from '@/lib/io';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

/** Searchable user list: `?q=` matches name, @username or email. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const filter = url.searchParams.get('filter');

    const where = {
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { username: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
      ...(filter === 'banned' ? { banned: true } : {}),
      ...(filter === 'admins' ? { role: 'ADMIN' } : {}),
      ...(filter === 'verified' ? { verified: true } : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatarUrl: true,
          role: true,
          verified: true,
          banned: true,
          banReason: true,
          presence: true,
          createdAt: true,
          lastSeenAt: true,
          _count: { select: { messages: true, memberships: true } },
        },
      }),
    ]);

    return Response.json({ users, total, page, pageSize: PAGE_SIZE });
  } catch (err) {
    return jsonError(err);
  }
}

/** Ban/unban, verify or promote. Admins cannot demote or ban themselves. */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as {
      userId?: string;
      banned?: boolean;
      banReason?: string | null;
      verified?: boolean;
      role?: 'USER' | 'ADMIN';
    };
    if (!body.userId) throw new HttpError(400, 'Не указан пользователь');
    if (body.userId === admin.id && (body.banned || body.role === 'USER')) {
      throw new HttpError(400, 'Нельзя понизить или заблокировать себя');
    }

    const target = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, name: true } });
    if (!target) throw new HttpError(404, 'Пользователь не найден');

    const data: Record<string, unknown> = {};
    if (typeof body.banned === 'boolean') {
      data.banned = body.banned;
      data.banReason = body.banned ? body.banReason?.slice(0, 200) || 'Нарушение правил' : null;
      if (body.banned) data.presence = 'OFFLINE';
    }
    if (typeof body.verified === 'boolean') data.verified = body.verified;
    if (body.role === 'USER' || body.role === 'ADMIN') data.role = body.role;
    if (!Object.keys(data).length) throw new HttpError(400, 'Нечего менять');

    const user = await prisma.user.update({
      where: { id: body.userId },
      data,
      select: { id: true, name: true, role: true, verified: true, banned: true, banReason: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'user.update',
        target: user.id,
        meta: JSON.stringify(data),
      },
    });
    if (data.banned) emitToUser(user.id, 'account:banned', { reason: user.banReason });

    return Response.json({ user });
  } catch (err) {
    return jsonError(err);
  }
}
