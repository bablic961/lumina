'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bookmark,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Flame,
  Forward,
  MapPin,
  Pencil,
  Phone,
  Pin,
  Smile,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { decryptFrom } from '@/lib/e2e';
import { useChatStore } from '@/store/chat';
import { toast } from '@/store/toast';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { Avatar } from '@/components/ui/Avatar';
import { ContextMenu } from '@/components/ui/Menu';
import { CodeBlock } from '@/components/chat/CodeBlock';
import { MessageAttachments } from '@/components/chat/MessageAttachments';
import { PollCard } from '@/components/chat/PollCard';
import { ReactionBar } from '@/components/chat/ReactionBar';
import { RichText } from '@/components/chat/RichText';
import type { ChatDetailDTO, MessageDTO, PublicUser } from '@/types';

const QUICK = ['✨', '❤️', '😂', '👍', '🔥', '🙏'];

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Live countdown for self-destructing messages. */
function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState(() => (expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0));
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(new Date(expiresAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt || left <= 0) return null;
  const seconds = Math.ceil(left / 1000);
  if (seconds < 60) return `${seconds}с`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}м`;
  return `${Math.ceil(seconds / 3600)}ч`;
}

/**
 * Transparently decrypts `e2e:v1:` payloads with the peer's public key. Failure
 * is not fatal — the ciphertext marker is shown instead of throwing away the row.
 */
function useDecrypted(content: string, peerKey?: string | null) {
  const [plain, setPlain] = useState<string | null>(null);
  const encrypted = content.startsWith('e2e:v1:');

  useEffect(() => {
    if (!encrypted || !peerKey) return;
    let alive = true;
    decryptFrom(peerKey, content)
      .then((text) => alive && setPlain(text))
      .catch(() => alive && setPlain(null));
    return () => {
      alive = false;
    };
  }, [encrypted, peerKey, content]);

  if (!encrypted) return { text: content, locked: false };
  return { text: plain ?? '🔒 Зашифровано — ключ недоступен', locked: true };
}

export function MessageBubble({
  message,
  chat,
  me,
  grouped,
  lastOfGroup,
  showAuthor,
}: {
  message: MessageDTO;
  chat?: ChatDetailDTO;
  me: PublicUser;
  grouped: boolean;
  lastOfGroup: boolean;
  showAuthor: boolean;
}) {
  const { socket } = useSocketContext();
  const { setReplyTo, setEditing, setForwarding, removeMessage, setPinned, burst } = useChatStore();
  const [quickOpen, setQuickOpen] = useState(false);

  const outgoing = message.senderId === me.id;
  const peerKey = useMemo(() => {
    if (chat?.type !== 'DM') return null;
    const other = chat.members.find((m) => m.userId !== me.id);
    return other?.user.e2ePublicKey ?? null;
  }, [chat, me.id]);

  const { text, locked } = useDecrypted(message.content, peerKey);
  const countdown = useCountdown(message.expiresAt);
  const isPrivileged = ['OWNER', 'ADMIN', 'MODERATOR'].includes(
    chat?.members.find((m) => m.userId === me.id)?.role ?? 'MEMBER',
  );
  const readByOthers = (message.reads ?? []).some((r) => r.userId !== me.id);
  const bursting = burst?.messageId === message.id;

  if (message.deletedForAll || message.deletedAt) {
    return (
      <div className={cn('flex px-2 py-1', outgoing ? 'justify-end' : 'justify-start')}>
        <span className="glass rounded-2xl px-3 py-1.5 text-xs italic text-ink-faint">Сообщение удалено</span>
      </div>
    );
  }

  if (message.contentType === 'SYSTEM' || message.contentType === 'CALL') {
    return (
      <div className="flex justify-center py-2">
        <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-ink-soft">
          {message.contentType === 'CALL' ? <Phone className="h-3 w-3" aria-hidden /> : null}
          {text}
        </span>
      </div>
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    toast.success('Скопировано');
  }

  async function save() {
    await api.post(`/api/messages/${message.id}/save`);
    toast.success('Добавлено в избранное');
  }

  async function remove(forAll: boolean) {
    removeMessage(message.chatId, message.id, forAll);
    socket?.emit('message:delete', { messageId: message.id, forAll });
  }

  function pin() {
    setPinned(message.chatId, message.id, !message.isPinned);
    socket?.emit('message:pin', { messageId: message.id, pinned: !message.isPinned });
  }

  const menuItems = [
    { label: 'Ответить', icon: <CornerUpLeft className="h-4 w-4" aria-hidden />, onSelect: () => setReplyTo(message) },
    { label: 'Копировать', icon: <Copy className="h-4 w-4" aria-hidden />, onSelect: copy },
    { label: 'Переслать', icon: <Forward className="h-4 w-4" aria-hidden />, onSelect: () => setForwarding(message) },
    { label: 'В избранное', icon: <Bookmark className="h-4 w-4" aria-hidden />, onSelect: save },
    {
      label: message.isPinned ? 'Открепить' : 'Закрепить',
      icon: <Pin className="h-4 w-4" aria-hidden />,
      onSelect: pin,
      hidden: !isPrivileged && chat?.type !== 'DM',
    },
    {
      label: 'Изменить',
      icon: <Pencil className="h-4 w-4" aria-hidden />,
      onSelect: () => setEditing(message),
      hidden: !outgoing || message.contentType !== 'TEXT',
    },
    {
      label: 'Удалить у себя',
      icon: <Trash2 className="h-4 w-4" aria-hidden />,
      danger: true,
      onSelect: () => remove(false),
    },
    {
      label: 'Удалить у всех',
      icon: <Trash2 className="h-4 w-4" aria-hidden />,
      danger: true,
      onSelect: () => remove(true),
      hidden: !outgoing && !isPrivileged,
    },
  ];

  const sticker = message.contentType === 'STICKER' && message.sticker;

  return (
    <div
      id={`msg-${message.id}`}
      className={cn('group flex items-end gap-2 px-1 py-0.5', outgoing ? 'justify-end' : 'justify-start')}
    >
      {!outgoing ? (
        <div className="w-9 shrink-0">
          {!grouped && showAuthor && message.sender ? (
            <Avatar name={message.sender.name} src={message.sender.avatarUrl} userId={message.sender.id} size="sm" />
          ) : null}
        </div>
      ) : null}

      <ContextMenu items={menuItems} className={cn('relative max-w-[85%] sm:max-w-[70%]', outgoing && 'order-2')}>
        {!grouped && showAuthor && !outgoing && message.sender ? (
          <p className="mb-0.5 ps-1 text-[11px] font-bold text-accent">
            {message.sender.name}
            {message.sender.verified ? ' ✓' : ''}
          </p>
        ) : null}

        <div
          className={cn(
            'relative transition-shadow duration-300',
            sticker
              ? ''
              : cn(
                  outgoing ? 'bubble-out' : 'bubble-in',
                  grouped && (outgoing ? 'rounded-se-lg' : 'rounded-ss-lg'),
                  !lastOfGroup && (outgoing ? 'rounded-ee-lg' : 'rounded-es-lg'),
                ),
            message.failed && 'ring-1 ring-rose-400/70',
            message.pending && 'opacity-70',
          )}
        >
          {message.forwardedFrom ? (
            <p className={cn('mb-1 flex items-center gap-1 text-[11px] font-semibold', outgoing ? 'text-white/80' : 'text-accent')}>
              <Forward className="h-3 w-3" aria-hidden />
              Переслано от {message.forwardedFrom.sender?.name ?? 'неизвестного'}
            </p>
          ) : null}

          {message.replyTo ? (
            <button
              onClick={() =>
                document.getElementById(`msg-${message.replyTo!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
              className={cn(
                'mb-1.5 flex w-full flex-col rounded-xl border-s-2 px-2 py-1 text-start text-[11px]',
                outgoing ? 'border-white/70 bg-white/15' : 'border-accent-from bg-accent/10',
              )}
            >
              <span className="font-bold">{message.replyTo.sender?.name ?? 'Сообщение'}</span>
              <span className={cn('line-clamp-2', outgoing ? 'text-white/80' : 'text-ink-soft')}>
                {message.replyTo.contentType === 'TEXT'
                  ? message.replyTo.content.startsWith('e2e:v1:')
                    ? '🔒 Зашифровано'
                    : message.replyTo.content
                  : `[${message.replyTo.contentType.toLowerCase()}]`}
              </span>
            </button>
          ) : null}

          {sticker ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.sticker!.url} alt={message.sticker!.emoji} className="h-32 w-32 object-contain" />
          ) : null}

          {message.attachments.length > 0 ? (
            <MessageAttachments attachments={message.attachments} outgoing={outgoing} />
          ) : null}

          {message.poll ? <PollCard poll={message.poll} outgoing={outgoing} /> : null}

          {message.contentType === 'CODE' ? (
            <CodeBlock code={text} language={message.codeLanguage} />
          ) : message.contentType === 'LOCATION' ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${message.lat}&mlon=${message.lng}#map=16/${message.lat}/${message.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-semibold underline-offset-2 hover:underline"
            >
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {message.locationName || 'Геолокация'}
            </a>
          ) : text && message.contentType !== 'STICKER' ? (
            <div className={cn('text-sm leading-relaxed', locked && 'italic')}>
              <RichText text={text} outgoing={outgoing} />
            </div>
          ) : null}

          <div
            className={cn(
              'mt-0.5 flex items-center justify-end gap-1 text-[10px]',
              sticker ? 'text-ink-faint' : outgoing ? 'text-white/75' : 'text-ink-faint',
            )}
          >
            {countdown ? (
              <span className="flex items-center gap-0.5 font-semibold" title="Самоуничтожение">
                <Flame className="h-3 w-3" aria-hidden />
                {countdown}
              </span>
            ) : null}
            {message.editedAt ? <span className="italic">изменено</span> : null}
            <span className="font-mono">{clock(message.createdAt)}</span>
            {outgoing ? (
              message.failed ? (
                <AlertCircle className="h-3.5 w-3.5 text-rose-300" aria-label="Не отправлено" />
              ) : message.pending ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" aria-label="Отправка" />
              ) : readByOthers ? (
                <CheckCheck className="h-3.5 w-3.5" aria-label="Прочитано" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-label="Доставлено" />
              )
            ) : null}
          </div>

          {/* Light burst: a reaction lands and the bubble briefly blooms. */}
          <AnimatePresence>
            {bursting ? (
              <motion.span
                key={burst!.key}
                initial={{ opacity: 0.9, scale: 0.4 }}
                animate={{ opacity: 0, scale: 2.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-0 rounded-3xl bg-accent-gradient blur-xl"
                aria-hidden
              />
            ) : null}
          </AnimatePresence>
        </div>

        <ReactionBar messageId={message.id} summary={message.reactionSummary} align={outgoing ? 'end' : 'start'} />

        {message.failed ? (
          <button
            onClick={() => toast.info('Отправьте сообщение заново')}
            className="mt-0.5 text-[11px] font-semibold text-rose-500"
          >
            Не отправлено — нажмите, чтобы узнать больше
          </button>
        ) : null}
      </ContextMenu>

      <div className={cn('relative flex shrink-0 items-center self-center opacity-0 transition group-hover:opacity-100', outgoing && 'order-1')}>
        <button
          onClick={() => setQuickOpen((v) => !v)}
          className="press flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-glass/70 hover:text-ink"
          aria-label="Реакция"
        >
          <Smile className="h-4 w-4" aria-hidden />
        </button>
        <AnimatePresence>
          {quickOpen ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 6 }}
              className="glass-strong absolute bottom-full z-30 mb-1 flex gap-0.5 rounded-2xl p-1 shadow-glass-lg"
            >
              {QUICK.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    socket?.emit('reaction:toggle', { messageId: message.id, emoji });
                    setQuickOpen(false);
                  }}
                  className="press h-8 w-8 rounded-xl text-lg transition hover:scale-125 hover:bg-glass/70"
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
