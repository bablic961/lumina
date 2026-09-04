'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Focus,
  Hash,
  Images,
  Info,
  Lock,
  Phone,
  Search,
  Users,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { useChatStore } from '@/store/chat';
import { useCallStore } from '@/store/call';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { useMe } from '@/components/providers/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ChatDetailDTO } from '@/types';

function lastSeen(iso?: string | Date | null) {
  if (!iso) return 'не в сети';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `был(а) ${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `был(а) ${hours} ч назад`;
  return `был(а) ${new Date(iso).toLocaleDateString('ru-RU')}`;
}

export function ChatHeader({
  chat,
  chatId,
  loading,
}: {
  chat?: ChatDetailDTO;
  chatId: string;
  loading: boolean;
}) {
  const router = useRouter();
  const { me } = useMe();
  const { rightPanel, set, focusMode, toggleFocus } = useUi();
  const typing = useChatStore((s) => s.typing[chatId]);
  const presenceMap = useChatStore((s) => s.presence);
  const startCall = useCallStore((s) => s.start);
  const { socket } = useSocketContext();

  const peer = chat?.type === 'DM' ? chat.members.find((m) => m.userId !== me.id)?.user : undefined;
  const presence = peer ? (presenceMap[peer.id] ?? peer.presence) : undefined;
  const typingNames = Object.values(typing ?? {}).map((t) => t.name);
  const title = chat?.type === 'DM' ? (peer?.name ?? '…') : (chat?.title ?? '…');

  const subtitle = typingNames.length
    ? chat?.type === 'DM'
      ? 'печатает…'
      : `${typingNames.slice(0, 2).join(', ')} печатает…`
    : chat?.type === 'DM'
      ? presence === 'ONLINE'
        ? 'в сети'
        : presence === 'AWAY'
          ? 'отошёл'
          : presence === 'DND'
            ? 'не беспокоить'
            : lastSeen(peer?.lastSeenAt)
      : `${chat?._count.members ?? 0} участников${chat?.type === 'CHANNEL' ? ' · канал' : ''}`;

  function call(video: boolean) {
    if (!socket || !chat) return;
    startCall({ chatId, kind: video ? 'VIDEO' : 'AUDIO', title, peer: peer ?? null });
  }

  if (loading) {
    return (
      <header className="glass-strong flex h-16 shrink-0 items-center gap-3 border-b border-hairline px-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </header>
    );
  }

  const panelButton = (
    key: 'info' | 'media' | 'members' | 'search',
    label: string,
    icon: React.ReactNode,
  ) => (
    <button
      onClick={() => set('rightPanel', rightPanel === key ? 'none' : key)}
      title={label}
      aria-label={label}
      aria-pressed={rightPanel === key}
      className={cn(
        'press flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300',
        rightPanel === key ? 'bg-accent/15 text-accent shadow-glow' : 'text-ink-soft hover:bg-glass/70 hover:text-ink',
      )}
    >
      {icon}
    </button>
  );

  return (
    <header className="glass-strong flex h-16 shrink-0 items-center gap-2 border-b border-hairline px-2 sm:px-3">
      <button
        onClick={() => router.push('/app')}
        className="press flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-glass/70 md:hidden"
        aria-label="Назад"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </button>

      <button
        onClick={() => set('rightPanel', rightPanel === 'info' ? 'none' : 'info')}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1 text-start transition hover:bg-glass/40"
      >
        {chat?.type === 'DM' && peer ? (
          <Avatar name={peer.name} src={peer.avatarUrl} userId={peer.id} presence={presence} verified={peer.verified} />
        ) : (
          <div className="relative">
            <Avatar name={title} src={chat?.avatarUrl} userId={chatId} />
            <span className="glass absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full text-ink-soft">
              {chat?.type === 'CHANNEL' ? <Hash className="h-3 w-3" aria-hidden /> : <Users className="h-3 w-3" aria-hidden />}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold text-ink">{title}</span>
            {peer?.statusEmoji ? <span className="text-sm">{peer.statusEmoji}</span> : null}
            {chat?.e2eEnabled ? (
              <Lock className="h-3.5 w-3.5 text-emerald-500" aria-label="Сквозное шифрование" />
            ) : null}
          </div>
          <p className={cn('truncate text-xs', typingNames.length ? 'font-medium text-accent' : 'text-ink-soft')}>
            {subtitle}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-0.5">
        {chat?.type !== 'CHANNEL' ? (
          <>
            <button
              onClick={() => call(false)}
              title="Аудиозвонок"
              aria-label="Аудиозвонок"
              className="press flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition hover:bg-glass/70 hover:text-ink"
            >
              <Phone className="h-5 w-5" aria-hidden />
            </button>
            <button
              onClick={() => call(true)}
              title="Видеозвонок"
              aria-label="Видеозвонок"
              className="press flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition hover:bg-glass/70 hover:text-ink"
            >
              <Video className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}

        <span className="hidden sm:flex">{panelButton('search', 'Поиск в чате', <Search className="h-5 w-5" aria-hidden />)}</span>
        <span className="hidden lg:flex">{panelButton('media', 'Медиа', <Images className="h-5 w-5" aria-hidden />)}</span>
        {chat?.type !== 'DM' ? (
          <span className="hidden lg:flex">
            {panelButton('members', 'Участники', <Users className="h-5 w-5" aria-hidden />)}
          </span>
        ) : null}
        {panelButton('info', 'Информация', <Info className="h-5 w-5" aria-hidden />)}

        <button
          onClick={toggleFocus}
          title="Режим фокуса"
          aria-label="Режим фокуса"
          aria-pressed={focusMode}
          className={cn(
            'press hidden h-10 w-10 items-center justify-center rounded-xl transition sm:flex',
            focusMode ? 'bg-accent/15 text-accent shadow-glow' : 'text-ink-soft hover:bg-glass/70 hover:text-ink',
          )}
        >
          <Focus className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
