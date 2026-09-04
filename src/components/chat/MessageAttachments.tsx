'use client';

import { Download, FileText, Film, Music } from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { VoicePlayer } from '@/components/chat/VoicePlayer';
import type { AttachmentDTO } from '@/types';

/** Images tile into a grid and open the lightbox; other kinds get inline players or file rows. */
export function MessageAttachments({
  attachments,
  outgoing,
}: {
  attachments: AttachmentDTO[];
  outgoing: boolean;
}) {
  const openLightbox = useUi((s) => s.openLightbox);
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.kind === 'IMAGE');
  const others = attachments.filter((a) => a.kind !== 'IMAGE');
  const urls = images.map((a) => a.url);

  return (
    <div className="space-y-1.5">
      {images.length > 0 ? (
        <div
          className={cn(
            'grid gap-1 overflow-hidden rounded-2xl',
            images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => openLightbox(urls, index)}
              className={cn(
                'group relative overflow-hidden bg-canvas-2/60 transition-transform duration-300 hover:brightness-105',
                images.length === 1 ? 'max-h-80' : 'aspect-square',
              )}
              aria-label={`Открыть ${image.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.thumbUrl ?? image.url}
                alt={image.name}
                loading="lazy"
                className={cn('h-full w-full', images.length === 1 ? 'max-h-80 object-contain' : 'object-cover')}
              />
              {image.ocrText ? (
                <span className="absolute bottom-1 start-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                  текст распознан
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {others.map((file) => {
        if (file.kind === 'VOICE') {
          return (
            <VoicePlayer
              key={file.id}
              url={file.url}
              duration={file.duration}
              waveform={file.waveform}
              outgoing={outgoing}
            />
          );
        }
        if (file.kind === 'VIDEO') {
          return (
            <video
              key={file.id}
              src={file.url}
              controls
              preload="metadata"
              poster={file.thumbUrl ?? undefined}
              className="max-h-80 w-full rounded-2xl bg-black/80"
            />
          );
        }
        if (file.kind === 'AUDIO') {
          return (
            <div key={file.id} className="flex items-center gap-2 rounded-2xl bg-glass/60 p-2">
              <Music className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{file.name}</p>
                <audio src={file.url} controls className="mt-1 h-8 w-full" />
              </div>
            </div>
          );
        }
        return (
          <a
            key={file.id}
            href={file.url}
            download={file.name}
            className={cn(
              'flex items-center gap-2.5 rounded-2xl p-2 transition',
              outgoing ? 'bg-white/15 hover:bg-white/25' : 'bg-glass/70 hover:bg-glass',
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                outgoing ? 'bg-white/25 text-white' : 'bg-accent-gradient text-white',
              )}
            >
              {file.mime.startsWith('video') ? (
                <Film className="h-5 w-5" aria-hidden />
              ) : (
                <FileText className="h-5 w-5" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold">{file.name}</span>
              <span className={cn('block text-[11px]', outgoing ? 'text-white/70' : 'text-ink-faint')}>
                {formatBytes(file.size)}
              </span>
            </span>
            <Download className={cn('h-4 w-4 shrink-0', outgoing ? 'text-white/80' : 'text-ink-faint')} aria-hidden />
          </a>
        );
      })}
    </div>
  );
}
