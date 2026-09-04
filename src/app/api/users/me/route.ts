import { prisma } from '@/lib/prisma';
import { jsonError, requireUser } from '@/lib/guards';
import { preferencesSchema, profileSchema } from '@/lib/validators';
import { getIo } from '@/lib/io';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const me = await requireUser();
    const [badges, devices, blocked] = await Promise.all([
      prisma.badge.findMany({ where: { userId: me.id } }),
      prisma.device.findMany({ where: { userId: me.id }, orderBy: { lastActiveAt: 'desc' } }),
      prisma.block.findMany({
        where: { blockerId: me.id },
        include: { blocked: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      }),
    ]);
    const { passwordHash, twoFactorSecret, ...safe } = me;
    return Response.json({ user: safe, badges, devices, blocked: blocked.map((b) => b.blocked) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const raw = await req.json();
    const profile = profileSchema.partial().parse(raw);
    const prefs = preferencesSchema.partial().parse(raw);
    const extra: Record<string, unknown> = {};
    if (typeof raw.e2ePublicKey === 'string') extra.e2ePublicKey = raw.e2ePublicKey;
    if (typeof raw.twoFactorEnabled === 'boolean') extra.twoFactorEnabled = raw.twoFactorEnabled;

    const user = await prisma.user.update({
      where: { id: me.id },
      data: {
        ...profile,
        ...prefs,
        ...extra,
        ...(profile.birthday ? { birthday: new Date(profile.birthday) } : {}),
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
        statusEmoji: true,
        statusText: true,
        presence: true,
        theme: true,
        accent: true,
        density: true,
        fontScale: true,
        locale: true,
      },
    });

    if (profile.presence) {
      getIo()?.emit('presence:global', { userId: me.id, presence: profile.presence });
    }
    return Response.json({ user });
  } catch (err) {
    return jsonError(err);
  }
}
