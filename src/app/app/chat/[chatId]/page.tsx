import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ChatView } from '@/components/chat/ChatView';

export default async function ChatPage({ params }: { params: { chatId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  // Membership is checked here so a wrong link 404s before any data loads.
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId: params.chatId, userId: session.user.id } },
    select: { chatId: true },
  });
  if (!member) notFound();

  return <ChatView chatId={params.chatId} />;
}
