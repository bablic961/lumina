import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/AppShell';
import type { PublicUser } from '@/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      verified: true,
      presence: true,
      statusEmoji: true,
      statusText: true,
      bio: true,
      role: true,
      banned: true,
    },
  });
  if (!user || user.banned) redirect('/login');

  const me: PublicUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    verified: user.verified,
    presence: user.presence as PublicUser['presence'],
    statusEmoji: user.statusEmoji,
    statusText: user.statusText,
    bio: user.bio,
  };

  return (
    <AppShell me={me} isAdmin={user.role === 'ADMIN'}>
      {children}
    </AppShell>
  );
}
