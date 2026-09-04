'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PackDTO {
  id: string;
  name: string;
  emoji: string | null;
  stickers: { id: string; url: string; emoji: string; animated: boolean }[];
}

export function StickerPicker({
  onPick,
  onClose,
}: {
  onPick: (stickerId: string, emoji: string) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const packs = useQuery({
    queryKey: ['sticker-packs'],
    queryFn: () => api.get<{ packs: PackDTO[] }>('/api/stickers'),
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = packs.data?.packs ?? [];
  const current = list.find((p) => p.id === (active ?? list[0]?.id));
  const stickers = (current?.stickers ?? []).filter((s) =>
    query ? s.emoji.includes(query) : true,
  );

  return (
    <div className="glass-strong absolute bottom-full end-0 z-40 mb-2 w-80 overflow-hidden rounded-3xl p-2 shadow-glass-lg">
      <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-glass/70 px-2">
        <Search className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по эмодзи"
          aria-label="Поиск стикеров"
          className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-faint"
        />
      </div>

      {list.length === 0 ? (
        <p className="px-2 py-8 text-center text-xs text-ink-soft">
          {packs.isLoading ? 'Загрузка наборов…' : 'Наборы стикеров пока не добавлены'}
        </p>
      ) : (
        <>
          <div className="scrollbar-none mb-2 flex gap-1 overflow-x-auto">
            {list.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setActive(pack.id)}
                className={cn(
                  'press shrink-0 rounded-xl px-2 py-1 text-xs font-semibold',
                  current?.id === pack.id ? 'bg-accent-gradient text-white' : 'text-ink-soft hover:bg-glass/70',
                )}
              >
                {pack.emoji ?? '🎨'} {pack.name}
              </button>
            ))}
          </div>
          <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => onPick(sticker.id, sticker.emoji)}
                className="press flex aspect-square items-center justify-center rounded-2xl transition hover:scale-105 hover:bg-glass/70"
                aria-label={sticker.emoji}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sticker.url} alt={sticker.emoji} className="h-16 w-16 object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
