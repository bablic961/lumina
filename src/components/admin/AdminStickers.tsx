'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, ImagePlus, Loader2, Sticker as StickerIcon, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';

interface Pack {
  id: string;
  name: string;
  slug: string;
  coverUrl: string | null;
  isGlobal: boolean;
  animated: boolean;
  stickers: { id: string; url: string; emoji: string; name: string | null }[];
  author: { id: string; name: string; username: string } | null;
}

/** Pack manager: upload images, name the set, flip visibility, delete. */
export function AdminStickers() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [isGlobal, setIsGlobal] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [drafts, setDrafts] = useState<{ url: string; emoji: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stickers'],
    queryFn: () => api.get<{ packs: Pack[] }>('/api/admin/stickers'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/stickers', { name, isGlobal, animated, stickers: drafts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stickers'] });
      setName('');
      setDrafts([]);
      toast.success('Набор создан');
    },
    onError: (err: Error) => toast.error('Не создалось', err.message),
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/api/admin/stickers', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'stickers'] }),
    onError: (err: Error) => toast.error('Не обновилось', err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/stickers?id=${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stickers'] });
      toast.info('Набор удалён');
    },
  });

  async function upload(files: FileList) {
    setUploading(true);
    try {
      // The upload route takes at most 10 files per request.
      const list = Array.from(files).slice(0, 10);
      const body = new FormData();
      for (const file of list) body.append('files', file);
      const res = await api.post<{ files: { url: string }[] }>('/api/upload', body);
      setDrafts((prev) => [...prev, ...res.files.map((file) => ({ url: file.url, emoji: '✨' }))]);
    } catch (err) {
      toast.error('Загрузка не удалась', (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-3xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <StickerIcon className="h-4 w-4" /> Новый набор
        </h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} label="Название" maxLength={60} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Switch checked={isGlobal} onChange={setIsGlobal} label="Доступен всем" description="Иначе только автору" />
          <Switch checked={animated} onChange={setAnimated} label="Анимированный" description="WebP/GIF/Lottie" />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="glass" onClick={() => fileRef.current?.click()} loading={uploading}>
            <ImagePlus className="h-4 w-4" /> Загрузить картинки
          </Button>
          <span className="text-xs text-ink-faint">{drafts.length} шт. (до 10 за раз, максимум 120)</span>
        </div>

        {drafts.length ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {drafts.map((draft, index) => (
              <div key={draft.url} className="space-y-1 rounded-2xl bg-glass/60 p-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.url} alt="" className="mx-auto h-14 w-14 object-contain" />
                <input
                  value={draft.emoji}
                  onChange={(e) =>
                    setDrafts((prev) =>
                      prev.map((item, position) =>
                        position === index ? { ...item, emoji: e.target.value.slice(0, 8) } : item,
                      ),
                    )
                  }
                  className="w-full rounded-lg bg-glass px-1 text-center text-sm outline-none"
                  aria-label="Эмодзи стикера"
                />
                <button
                  type="button"
                  onClick={() => setDrafts((prev) => prev.filter((_, position) => position !== index))}
                  className="text-[10px] text-rose-500"
                >
                  убрать
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!name.trim() || drafts.length === 0}
          className="w-full"
        >
          Создать набор
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-3xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {data?.packs.map((pack) => (
            <li key={pack.id} className="glass space-y-2 rounded-3xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-ink">{pack.name}</p>
                <span className="font-mono text-xs text-ink-faint">{pack.slug}</span>
                {pack.isGlobal ? <Globe className="h-3.5 w-3.5 text-emerald-500" aria-label="Глобальный" /> : null}
                {pack.animated ? (
                  <span className="rounded-full bg-glass px-2 text-[10px] text-ink-faint">анимация</span>
                ) : null}
                <span className="text-xs text-ink-faint">
                  {pack.stickers.length} шт.
                  {pack.author ? ` · @${pack.author.username}` : ''}
                </span>
                <div className="ms-auto flex gap-1.5">
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={() => patch.mutate({ id: pack.id, isGlobal: !pack.isGlobal })}
                  >
                    {pack.isGlobal ? 'Скрыть' : 'Открыть всем'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Удалить набор «${pack.name}»?`)) remove.mutate(pack.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pack.stickers.slice(0, 24).map((sticker) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={sticker.id}
                    src={sticker.url}
                    alt={sticker.emoji}
                    title={sticker.emoji}
                    className="h-12 w-12 rounded-xl bg-glass/60 object-contain p-1"
                  />
                ))}
                {pack.stickers.length > 24 ? (
                  <span className="flex h-12 items-center px-2 text-xs text-ink-faint">
                    +{pack.stickers.length - 24}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {uploading ? (
        <p className="flex items-center justify-center gap-2 text-xs text-ink-faint">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Загрузка…
        </p>
      ) : null}
    </div>
  );
}
