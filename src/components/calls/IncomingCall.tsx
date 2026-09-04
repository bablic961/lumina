'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCallStore } from '@/store/call';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Ringing card for an inbound call. Presentational on purpose: the single
 * useWebRTC instance lives in CallOverlay, which passes the handlers down, so
 * the microphone is never opened twice.
 */
export function IncomingCall({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const status = useCallStore((s) => s.status);
  const peer = useCallStore((s) => s.peer);
  const title = useCallStore((s) => s.title);
  const kind = useCallStore((s) => s.kind);

  return (
    <AnimatePresence>
      {status === 'incoming' ? (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="glass-strong fixed bottom-6 end-6 z-[80] w-[min(22rem,calc(100vw-3rem))] rounded-3xl p-4 shadow-glass-lg"
          role="dialog"
          aria-label="Входящий звонок"
        >
          <div className="flex items-center gap-3">
            <Avatar name={peer?.name ?? title ?? 'Звонок'} src={peer?.avatarUrl} userId={peer?.id} size="lg" ring />
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold text-ink">{peer?.name ?? title}</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                {kind === 'VIDEO' ? <Video className="h-3.5 w-3.5" aria-hidden /> : <Phone className="h-3.5 w-3.5" aria-hidden />}
                Входящий {kind === 'VIDEO' ? 'видеозвонок' : 'звонок'}
                <span className="ms-1 inline-flex gap-0.5">
                  <span className="h-1 w-1 animate-bounce rounded-full bg-accent-from" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-accent-from [animation-delay:120ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-accent-from [animation-delay:240ms]" />
                </span>
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={onDecline}
              className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-sm font-bold text-white shadow-glass"
            >
              <PhoneOff className="h-4 w-4" aria-hidden /> Отклонить
            </button>
            <button
              onClick={onAccept}
              className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent2-gradient text-sm font-bold text-white shadow-glow"
            >
              <Phone className="h-4 w-4" aria-hidden /> Ответить
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
