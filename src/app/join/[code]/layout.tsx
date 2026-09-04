import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Invites are only readable by signed-in users, so bounce guests through the
 * login form and bring them straight back to the invite afterwards.
 */
export default async function JoinLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { code: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/join/${params.code}`)}`);
  }
  return <>{children}</>;
}
