'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Music, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatBytes } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { Segmented } from '@/components/ui/Switch';
import type { AttachmentDTO } from '@/types';

type Tab = 'media' | 'files' | 'audio';

interface GalleryItem extends AttachmentDTO {
  message: { id: string; createdAt: string; sender: { id: string; name: string; username: string } | null };
}

/** Right-panel gallery: image grid, file rows and audio rows for one chat. */
export function MediaGallery({ chatId }: { chatId: string }) {
  const [tab, setTab] = useState<Tab>('media');
  const { openLightbox } = useUi();

  const { data, isLoading } = useQuery({
    queryKey: ['chat-media', chatId, tab],
    queryFn: () => api.get<{ attachments: GalleryItem[]; nextCursor: string | null }>(
      `/api/chats/${chatId}/media?tab=${tab}`,
    ),
  });

  const items = data?.attachments ?? [];
  const images = items.filter((item) => item.kind === 'IMAGE').map((item) => item.url);

  return (
    <div className="space-y-3">
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'media', label: 'Медиа' },
          { value: 'files', label: 'Файлы' },
          { value: 'audio', label: 'Аудио' },
        ]}
        className="w-full"
      />

      {isLoading ? (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">Пока ничего нет</p>
      ) : tab === 'media' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                const index = images.indexOf(item.url);
                if (index >= 0) openLightbox(images, index);
                else window.open(item.url, '_blank', 'noopener,noreferrer');
              }}
              className="press group relative aspect-square overflow-hidden rounded-xl bg-glass/60"
              aria-label={item.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbUrl || item.url}
                alt={item.name}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              {item.kind === 'VIDEO' ? (
                <span className="absolute inset-0 flex items-center justify-center bg-slate-900/25">
                  <Play className="h-6 w-6 fill-white text-white drop-shadow" aria-hidden />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="glass flex items-center gap-2.5 rounded-2xl p-2.5">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white',
                  tab === 'audio' ? 'bg-accent2-gradient' : 'bg-accent-gradient',
                )}
              >
                {tab === 'audio' ? <Music className="h-5 w-5" aria-hidden /> : <FileText className="h-5 w-5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                <p className="text-xs text-ink-faint">
                  {formatBytes(item.size)} · {new Date(item.message.createdAt).toLocaleDateString('ru-RU')}
                  {item.message.sender ? ` · ${item.message.sender.name}` : ''}
                </p>
              </div>
              <a
                href={item.url}
                download={item.name}
                className="press rounded-xl p-2 text-ink-soft transition hover:bg-accent-from/10 hover:text-ink"
                aria-label={`Скачать ${item.name}`}
              >
                <Download className="h-4 w-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
