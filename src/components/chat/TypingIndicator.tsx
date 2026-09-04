'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useChatStore } from '@/store/chat';

/** Three-dot bubble with the names of everyone currently typing. */
export function TypingIndicator({ chatId }: { chatId: string }) {
  const typing = useChatStore((s) => s.typing[chatId]);
  const names = Object.values(typing ?? {}).map((t) => t.name);

  return (
    <AnimatePresence>
      {names.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="flex items-center gap-2 px-2 py-2"
        >
          <div className="glass flex items-center gap-1 rounded-2xl px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-accent"
                style={{ animationDelay: `${i * 140}ms` }}
                aria-hidden
              />
            ))}
          </div>
          <span className="text-xs text-ink-soft">
            {names.length === 1 ? `${names[0]} печатает…` : `${names.slice(0, 2).join(', ')} печатают…`}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
