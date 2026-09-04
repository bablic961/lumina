'use client';

import { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

/** Thumbnail strip for files queued in the composer, before upload. */
export function AttachmentTray({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const [previews, setPreviews] = useState<(string | null)[]>([]);

  useEffect(() => {
    const urls = files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null));
    setPreviews(urls);
    return () => urls.forEach((url) => url && URL.revokeObjectURL(url));
  }, [files]);

  return (
    <div className="scrollbar-none mb-1.5 flex gap-2 overflow-x-auto pb-1">
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="glass relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
          {previews[index] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previews[index] as string} alt={file.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center px-1 text-center">
              <FileText className="h-5 w-5 text-accent" aria-hidden />
              <span className="mt-0.5 line-clamp-1 text-[9px] font-semibold text-ink-soft">{file.name}</span>
              <span className="text-[9px] text-ink-faint">{formatBytes(file.size)}</span>
            </div>
          )}
          <button
            onClick={() => onRemove(index)}
            className="absolute end-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
            aria-label={`Убрать ${file.name}`}
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
