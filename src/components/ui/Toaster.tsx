'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useToasts } from '@/store/toast';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

const ACCENT = {
  info: 'from-sky-400 to-indigo-500',
  success: 'from-emerald-400 to-teal-500',
  error: 'from-rose-500 to-red-600',
};

/** Toasts arrive as a flash of light: a bright bloom that settles into glass. */
export function Toaster() {
  const { toasts, dismiss } = useToasts();

  return (
    <div className="pointer-events-none fixed bottom-6 end-6 z-[60] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <motion.button
              key={t.id}
              layout
              onClick={() => dismiss(t.id)}
              className="glass-strong pointer-events-auto flex w-full items-start gap-3 rounded-2xl p-3.5 text-start"
              initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'brightness(2)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'brightness(1)' }}
              exit={{ opacity: 0, x: 30, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={`rounded-xl bg-gradient-to-br ${ACCENT[t.variant]} p-1.5 text-white shadow-glass`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">{t.title}</span>
                {t.description ? <span className="block text-xs text-ink-soft">{t.description}</span> : null}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
