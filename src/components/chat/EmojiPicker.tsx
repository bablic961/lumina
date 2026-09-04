'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useUi } from '@/store/ui';

// emoji-mart ships its own DOM renderer and a large data file — both stay out of
// the initial bundle and load only when the picker is first opened.
const Picker = dynamic(() => import('@emoji-mart/react'), { ssr: false });

const RECENT_KEY = 'lumina.recent-emoji';

export function readRecentEmoji(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string) {
  const next = [emoji, ...readRecentEmoji().filter((e) => e !== emoji)].slice(0, 24);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [data, setData] = useState<unknown>(null);
  const theme = useUi((s) => s.theme);

  useEffect(() => {
    void import('@emoji-mart/data').then((mod) => setData(mod.default));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="glass-strong absolute bottom-full end-0 z-40 mb-2 overflow-hidden rounded-3xl shadow-glass-lg">
      {data ? (
        <Picker
          data={data}
          locale="ru"
          theme={theme === 'light' ? 'light' : 'dark'}
          previewPosition="none"
          skinTonePosition="search"
          onEmojiSelect={(emoji: { native: string }) => {
            rememberEmoji(emoji.native);
            onPick(emoji.native);
          }}
        />
      ) : (
        <div className="flex h-72 w-80 items-center justify-center text-sm text-ink-soft">Загрузка эмодзи…</div>
      )}
    </div>
  );
}
