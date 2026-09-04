'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/** Small glass dropdown used by message actions, chat actions and the profile menu. */
export function Menu({
  trigger,
  items,
  align = 'end',
  className,
}: {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter((item) => !item.hidden);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            className={cn(
              'glass-strong absolute z-40 mt-2 min-w-48 overflow-hidden rounded-2xl p-1.5',
              align === 'end' ? 'end-0' : 'start-0',
            )}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16 }}
          >
            {visible.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm transition',
                  item.danger ? 'text-rose-500 hover:bg-rose-500/10' : 'text-ink hover:bg-accent-from/10',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Same glass sheet, but opened by right-click or a long press instead of a
 * button — needed where the trigger is itself a link (chat rows, bubbles).
 */
export function ContextMenu({
  children,
  items,
  className,
}: {
  children: React.ReactNode;
  items: MenuItem[];
  className?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  const visible = items.filter((item) => !item.hidden);
  if (visible.length === 0) return <>{children}</>;

  return (
    <div
      className={className}
      onContextMenu={(e) => {
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
      }}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        timer.current = setTimeout(() => setPos({ x: touch.clientX, y: touch.clientY }), 480);
      }}
      onTouchEnd={() => timer.current && clearTimeout(timer.current)}
      onTouchMove={() => timer.current && clearTimeout(timer.current)}
    >
      {children}
      {pos
        ? createPortal(
            <div
              role="menu"
              className="glass-strong fixed z-[70] min-w-48 animate-fade-in overflow-hidden rounded-2xl p-1.5 shadow-glass-lg"
              style={{
                left: Math.min(pos.x, window.innerWidth - 220),
                top: Math.min(pos.y, window.innerHeight - visible.length * 40 - 24),
              }}
            >
              {visible.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    setPos(null);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm transition',
                    item.danger ? 'text-rose-500 hover:bg-rose-500/10' : 'text-ink hover:bg-accent-from/10',
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
