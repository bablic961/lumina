'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Circle,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Send,
  Sparkles,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { useCallStore } from '@/store/call';
import { useChatStore } from '@/store/chat';
import { useMe } from '@/components/providers/MeProvider';
import { useWebRTC, type RemotePeer } from '@/hooks/useWebRTC';
import { useSend } from '@/hooks/useSend';
import { Avatar } from '@/components/ui/Avatar';
import { IncomingCall } from '@/components/calls/IncomingCall';

const QUALITY: Record<'good' | 'fair' | 'poor', { label: string; className: string }> = {
  good: { label: 'Отличная связь', className: 'bg-online' },
  fair: { label: 'Связь нестабильна', className: 'bg-away' },
  poor: { label: 'Плохая связь', className: 'bg-dnd' },
};

/** Binds a MediaStream to a <video> element without re-creating it on re-render. */
function VideoTile({
  stream,
  name,
  userId,
  avatarUrl,
  muted,
  mirrored,
  label,
  videoOff,
}: {
  stream: MediaStream | null;
  name: string;
  userId?: string;
  avatarUrl?: string | null;
  muted?: boolean;
  mirrored?: boolean;
  label?: string;
  videoOff?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().length) && !videoOff;

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="glass relative aspect-video overflow-hidden rounded-3xl bg-slate-900/40">
      {hasVideo ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={cn('h-full w-full object-cover', mirrored && 'scale-x-[-1]')}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
          <Avatar name={name} src={avatarUrl} userId={userId} size="xl" ring />
          <p className="text-sm font-semibold text-white/90">{name}</p>
        </div>
      )}
      {label ? (
        <span className="absolute bottom-2 start-2 rounded-xl bg-slate-900/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/** Full-screen call surface: video mesh, controls and an in-call chat drawer. */
export function CallOverlay() {
  const status = useCallStore((s) => s.status);
  const kind = useCallStore((s) => s.kind);
  const title = useCallStore((s) => s.title);
  const peer = useCallStore((s) => s.peer);
  const muted = useCallStore((s) => s.muted);
  const videoOff = useCallStore((s) => s.videoOff);
  const screenSharing = useCallStore((s) => s.screenSharing);
  const blurBackground = useCallStore((s) => s.blurBackground);
  const recording = useCallStore((s) => s.recording);
  const quality = useCallStore((s) => s.quality);

  const { me } = useMe();
  const rtc = useWebRTC();
  const [chatOpen, setChatOpen] = useState(false);

  const live = status === 'ringing' || status === 'connecting' || status === 'active';

  return (
    <>
      <IncomingCall onAccept={rtc.accept} onDecline={rtc.decline} />

      <AnimatePresence>
        {live ? (
          <motion.div
            key="call"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[75] flex flex-col bg-canvas/80 backdrop-blur-2xl"
            role="dialog"
            aria-label="Звонок"
          >
            <header className="flex h-16 shrink-0 items-center gap-3 px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold text-ink">{title ?? peer?.name ?? 'Звонок'}</p>
                <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <span className={cn('h-2 w-2 rounded-full', QUALITY[quality].className)} title={QUALITY[quality].label} />
                  {status === 'active'
                    ? formatDuration(rtc.elapsed)
                    : status === 'ringing'
                      ? 'Вызов…'
                      : 'Соединение…'}
                  {recording ? <span className="ms-2 font-semibold text-rose-500">● Запись</span> : null}
                </p>
              </div>
              <button
                onClick={() => setChatOpen((v) => !v)}
                className="press flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-glass/70"
                aria-label="Чат в звонке"
              >
                <MessageSquare className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
              <div
                className={cn(
                  'grid min-h-0 flex-1 content-center gap-3',
                  rtc.remotes.length > 1 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
                )}
              >
                {rtc.remotes.map((remote: RemotePeer) => (
                  <VideoTile
                    key={remote.peerId}
                    stream={remote.stream}
                    name={remote.user?.name ?? peer?.name ?? 'Участник'}
                    userId={remote.peerId}
                    avatarUrl={remote.user?.avatarUrl ?? peer?.avatarUrl}
                    videoOff={remote.videoOff}
                    label={remote.muted ? '🔇 микрофон выключен' : undefined}
                  />
                ))}
                {rtc.remotes.length === 0 ? (
                  <VideoTile
                    stream={null}
                    name={peer?.name ?? title ?? 'Ожидание'}
                    userId={peer?.id}
                    avatarUrl={peer?.avatarUrl}
                    label={status === 'ringing' ? 'Вызываем…' : 'Подключение…'}
                  />
                ) : null}
              </div>

              <div className="hidden w-56 shrink-0 flex-col gap-3 md:flex">
                <VideoTile
                  stream={rtc.localStream}
                  name={me.name}
                  userId={me.id}
                  avatarUrl={me.avatarUrl}
                  muted
                  mirrored={!screenSharing}
                  videoOff={videoOff}
                  label="Вы"
                />
              </div>

              <AnimatePresence>
                {chatOpen ? (
                  <motion.div
                    key="call-chat"
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 40, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="absolute bottom-24 end-3 top-20 z-10 w-[min(20rem,calc(100vw-1.5rem))]"
                  >
                    <InCallChat onClose={() => setChatOpen(false)} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <footer className="flex shrink-0 items-center justify-center gap-2 pb-6">
              <ControlButton
                active={muted}
                onClick={rtc.toggleMute}
                label={muted ? 'Включить микрофон' : 'Выключить микрофон'}
                icon={muted ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
              />
              {kind === 'VIDEO' ? (
                <ControlButton
                  active={videoOff}
                  onClick={rtc.toggleVideo}
                  label={videoOff ? 'Включить камеру' : 'Выключить камеру'}
                  icon={videoOff ? <VideoOff className="h-5 w-5" aria-hidden /> : <Video className="h-5 w-5" aria-hidden />}
                />
              ) : null}
              <ControlButton
                active={screenSharing}
                onClick={rtc.toggleScreen}
                label="Показать экран"
                icon={<MonitorUp className="h-5 w-5" aria-hidden />}
              />
              {kind === 'VIDEO' ? (
                <ControlButton
                  active={blurBackground}
                  onClick={rtc.toggleBlur}
                  label="Размыть фон"
                  icon={<Sparkles className="h-5 w-5" aria-hidden />}
                />
              ) : null}
              <ControlButton
                active={recording}
                onClick={rtc.toggleRecording}
                label={recording ? 'Остановить запись' : 'Записать звонок'}
                icon={<Circle className={cn('h-5 w-5', recording && 'fill-rose-500 text-rose-500')} aria-hidden />}
              />
              <button
                onClick={rtc.hangup}
                className="press ms-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-glass"
                aria-label="Завершить звонок"
              >
                <PhoneOff className="h-6 w-6" aria-hidden />
              </button>
            </footer>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'press flex h-12 w-12 items-center justify-center rounded-2xl transition',
        active ? 'bg-accent-gradient text-white shadow-glow' : 'glass text-ink hover:shadow-glow',
      )}
    >
      {icon}
    </button>
  );
}

/** Lightweight chat during a call — same socket path as the main composer. */
function InCallChat({ onClose }: { onClose: () => void }) {
  const chatId = useCallStore((s) => s.chatId);
  const messages = useChatStore((s) => (chatId ? s.messages[chatId] : undefined));
  const { me } = useMe();
  const { send } = useSend(chatId, me);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const recent = (messages ?? []).slice(-30);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [recent.length]);

  return (
    <div className="glass-strong flex h-full flex-col overflow-hidden rounded-3xl">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-hairline px-3">
        <p className="flex-1 text-sm font-bold text-ink">Чат</p>
        <button onClick={onClose} className="press rounded-lg p-1 text-ink-soft" aria-label="Закрыть чат">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {recent.length === 0 ? (
          <p className="pt-6 text-center text-xs text-ink-faint">Сообщений пока нет</p>
        ) : (
          recent.map((message) => (
            <div key={message.id} className={cn('flex flex-col', message.senderId === me.id && 'items-end')}>
              <span className="text-[10px] text-ink-faint">{message.sender?.name ?? 'Система'}</span>
              <span
                className={cn(
                  'wrap-anywhere max-w-[85%] rounded-2xl px-2.5 py-1.5 text-xs',
                  message.senderId === me.id ? 'bg-accent-gradient text-white' : 'bg-glass/70 text-ink',
                )}
              >
                {message.content || `[${message.contentType.toLowerCase()}]`}
              </span>
            </div>
          ))
        )}
      </div>

      <form
        className="flex shrink-0 items-center gap-1.5 border-t border-hairline p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value) return;
          void send({ content: value });
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение…"
          className="min-w-0 flex-1 rounded-xl bg-glass/70 px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent-from/25"
        />
        <button
          type="submit"
          className="press flex h-8 w-8 items-center justify-center rounded-xl bg-accent-gradient text-white"
          aria-label="Отправить"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
