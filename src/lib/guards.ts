import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { MemberRole } from '@/types';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new HttpError(401, 'Требуется вход');
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new HttpError(401, 'Сессия недействительна');
  if (user.banned) throw new HttpError(403, user.banReason || 'Аккаунт заблокирован');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new HttpError(403, 'Только для администраторов');
  return user;
}

export async function requireMember(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
    include: { chat: true, customRole: true },
  });
  if (!member) throw new HttpError(403, 'Нет доступа к чату');
  return member;
}

const RANK: Record<MemberRole, number> = { MEMBER: 0, MODERATOR: 1, ADMIN: 2, OWNER: 3 };

export function atLeast(role: string, min: MemberRole) {
  return (RANK[role as MemberRole] ?? 0) >= RANK[min];
}

export function jsonError(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error('[lumina] route error', err);
  return Response.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
}
