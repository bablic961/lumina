'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Archive,
  BellOff,
  Check,
  CheckCheck,
  FileText,
  Hash,
  Image as ImageIcon,
  MapPin,
  Mic,
  Pin,
  Trash2,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';
import { toast } from '@/store/toast';
import { useMe } from '@/components/providers/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { ContextMenu } from '@/components/ui/Menu';
import type { ChatListItemDTO, ContentType } from '@/types';

const PREVIEW_ICON: Partial<Record<ContentType, React.ReactNode>> = {
  VOICE: <Mic className="h-3.5 w-3.5" aria-hidden />,
  FILE: <FileText className="h-3.5 w-3.5" aria-hidden />,
  LOCATION: <MapPin className="h-3.5 w-3.5" aria-hidden />,
  STICKER: <ImageIcon className="h-3.5 w-3.5" aria-hidden />,
};

/** Short relative stamp: time today, weekday this week, date beyond that. */
function timeLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function previewText(last: NonNullable<ChatListItemDTO['lastMessage']>) {
  if (last.deletedForAll) return 'Сообщение удалено';
  switch (last.contentType) {
    case 'VOICE':
      return 'Голосовое сообщение';
    case 'FILE':
      return 'Файл';
    case 'LOCATION':
      return 'Геолокация';
    case 'POLL':
      return 'Опрос';
    case 'STICKER':
      return last.content || 'Стикер';
    default:
      return last.content.startsWith('e2e:v1:') ? '🔒 Зашифрованное сообщение' : last.content;
  }
}

export function ChatListItem({ chat }: { chat: ChatListItemDTO }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useMe();
  const presence = useChatStore((s) => (chat.peer ? s.presence[chat.peer.id] : undefined));
  const typing = useChatStore((s) => s.typing[chat.id]);
  const patchChat = useChatStore((s) => s.patchChat);

  const active = pathname === `/app/chat/${chat.id}`;
  const typingNames = Object.values(typing ?? {}).map((t) => t.name);
  const last = chat.lastMessage;
  const outgoing = last?.senderId === me.id;
  const muted = !chat.notificationsEnabled || Boolean(chat.muteUntil && new Date(chat.muteUntil) > new Date());

  async function patch(body: Record<string, unknown>, message: string) {
    patchChat(chat.id, body as Partial<ChatListItemDTO>);
    try {
      await api.patch(`/api/chats/${chat.id}`, body);
      toast.success(message);
    } catch {
      toast.error('Не удалось сохранить');
    }
  }

  async function leave() {
    await api.del(`/api/chats/${chat.id}`);
    toast.success(chat.type === 'DM' ? 'Диалог удалён' : 'Вы покинули чат');
    if (active) router.push('/app');
  }

  const menuItems = [
    {
      label: chat.isPinned ? 'Открепить' : 'Закрепить',
      icon: <Pin className="h-4 w-4" aria-hidden />,
      onSelect: () => patch({ isPinned: !chat.isPinned }, chat.isPinned ? 'Откреплено' : 'Закреплено'),
    },
    {
      label: muted ? 'Включить уведомления' : 'Выключить уведомления',
      icon: <BellOff className="h-4 w-4" aria-hidden />,
      onSelect: () =>
        patch(
          { notificationsEnabled: !chat.notificationsEnabled, muteUntil: null },
          muted ? 'Уведомления включены' : 'Чат отключён',
        ),
    },
    {
      label: chat.isArchived ? 'Из архива' : 'В архив',
      icon: <Archive className="h-4 w-4" aria-hidden />,
      onSelect: () => patch({ isArchived: !chat.isArchived }, chat.isArchived ? 'Возвращено' : 'В архиве'),
    },
    {
      label: chat.type === 'DM' ? 'Удалить диалог' : 'Покинуть чат',
      icon: <Trash2 className="h-4 w-4" aria-hidden />,
      danger: true,
      onSelect: leave,
    },
  ];

  return (
    <li>
      <ContextMenu items={menuItems}>
          <Link
            href={`/app/chat/${chat.id}`}
            className={cn(
              'glass-hover group relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start transition-all duration-300',
              active && 'glass shadow-glow',
            )}
          >
            {chat.type === 'DM' && chat.peer ? (
              <Avatar
                name={chat.peer.name}
                src={chat.peer.avatarUrl}
                userId={chat.peer.id}
                presence={presence ?? chat.peer.presence}
                verified={chat.peer.verified}
                size="md"
              />
            ) : (
              <div className="relative">
                <Avatar name={chat.title} src={chat.avatarUrl} userId={chat.id} size="md" />
                <span className="glass absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full text-ink-soft">
                  {chat.type === 'CHANNEL' ? (
                    <Hash className="h-3 w-3" aria-hidden />
                  ) : (
                    <Users className="h-3 w-3" aria-hidden />
                  )}
                </span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="truncate text-sm font-bold text-ink">{chat.title}</span>
                {chat.peer?.statusEmoji ? <span className="text-xs">{chat.peer.statusEmoji}</span> : null}
                {chat.isPinned ? <Pin className="h-3 w-3 shrink-0 text-accent" aria-hidden /> : null}
                <span className="ms-auto shrink-0 text-[11px] font-medium text-ink-faint">
                  {timeLabel(chat.lastMessageAt)}
                </span>
              </div>

              <div className="mt-0.5 flex items-center gap-1.5">
                {typingNames.length > 0 ? (
                  <span className="truncate text-xs font-medium text-accent">
                    {chat.type === 'DM' ? 'печатает…' : `${typingNames[0]} печатает…`}
                  </span>
                ) : last ? (
                  <>
                    {outgoing && !last.deletedForAll ? (
                      chat.unreadCount === 0 ? (
                        <CheckCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                      ) : (
                        <Check className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
                      )
                    ) : null}
                    {chat.type !== 'DM' && last.senderName && !last.deletedForAll ? (
                      <span className="shrink-0 text-xs font-semibold text-ink-soft">
                        {outgoing ? 'Вы' : last.senderName.split(' ')[0]}:
                      </span>
                    ) : null}
                    <span className="flex min-w-0 items-center gap-1 text-xs text-ink-soft">
                      {PREVIEW_ICON[last.contentType] ?? null}
                      <span className="truncate">{previewText(last)}</span>
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-ink-faint">Нет сообщений</span>
                )}

                <span className="ms-auto flex shrink-0 items-center gap-1">
                  {muted ? <BellOff className="h-3 w-3 text-ink-faint" aria-hidden /> : null}
                  {chat.unreadCount > 0 ? (
                    <span
                      className={cn(
                        'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white',
                        muted ? 'bg-offline' : 'bg-accent-gradient shadow-glow',
                      )}
                    >
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          </Link>
      </ContextMenu>
    </li>
  );
}
