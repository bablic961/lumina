'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CirclePlus, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import { useMe } from '@/components/providers/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { StoryViewer, type StoryGroup } from '@/components/stories/StoryViewer';

/** The 24-hour feed: rings on top, a full-screen player underneath. */
export default function StoriesPage() {
  const { me } = useMe();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [pending, setPending] = useState<{ url: string; kind: 'IMAGE' | 'VIDEO' } | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.get<{ groups: StoryGroup[] }>('/api/stories'),
    refetchInterval: 60_000,
  });

  const groups = data?.groups ?? [];

  const publish = useMutation({
    mutationFn: () =>
      api.post('/api/stories', { kind: pending?.kind, mediaUrl: pending?.url, caption: caption.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      setComposerOpen(false);
      setPending(null);
      setCaption('');
      toast.success('История опубликована', 'Исчезнет через 24 часа');
    },
    onError: (err: Error) => toast.error('Не опубликовалось', err.message),
  });

  const remove = useMutation({
    mutationFn: (storyId: string) => api.del(`/api/stories?id=${storyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      setOpen(null);
      toast.info('История удалена');
    },
  });

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append('files', file);
      const res = await api.post<{ files: { url: string }[] }>('/api/upload', body);
      const url = res.files[0]?.url;
      if (!url) throw new Error('Файл не загрузился');
      setPending({ url, kind: file.type.startsWith('video') ? 'VIDEO' : 'IMAGE' });
      setComposerOpen(true);
    } catch (err) {
      toast.error('Загрузка не удалась', (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-3 border-b border-hairline px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent2-gradient text-white shadow-glow">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold text-ink">Истории</h1>
          <p className="text-xs text-ink-faint">Живут 24 часа · видны тем, с кем есть общий чат</p>
        </div>
        <Button onClick={() => fileRef.current?.click()} loading={uploading}>
          <CirclePlus className="h-4 w-4" /> Добавить
        </Button>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />

      <div className="mx-auto max-w-4xl p-5 pb-24 md:pb-5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/4] w-full rounded-3xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl p-12 text-center">
            <Sparkles className="h-10 w-10 text-ink-faint" aria-hidden />
            <p className="text-sm font-semibold text-ink">Историй пока нет</p>
            <p className="max-w-xs text-xs text-ink-faint">
              Опубликуйте первую — её увидят все, с кем у вас есть общий чат.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {groups.map((group, index) => {
              const cover = group.stories[group.stories.length - 1];
              const mine = group.user.id === me.id;
              return (
                <button
                  key={group.user.id}
                  type="button"
                  onClick={() => setOpen(index)}
                  className="group relative aspect-[3/4] overflow-hidden rounded-3xl bg-glass shadow-glass transition hover:shadow-glow-lg"
                >
                  {cover.kind === 'VIDEO' ? (
                    <video src={cover.mediaUrl} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.mediaUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-3 text-start">
                    <span className="flex items-center gap-2">
                      <Avatar
                        name={group.user.name}
                        src={group.user.avatarUrl}
                        userId={group.user.id}
                        size="sm"
                        ring={group.unseen > 0}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-white">
                          {mine ? 'Вы' : group.user.name}
                        </span>
                        <span className="block text-[10px] text-white/70">{group.stories.length} шт.</span>
                      </span>
                    </span>
                  </span>
                  {group.unseen > 0 ? (
                    <span
                      className={cn(
                        'absolute end-2 top-2 rounded-full bg-accent-gradient px-2 py-0.5 text-[10px] font-bold text-white shadow-glow',
                      )}
                    >
                      {group.unseen}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {open !== null ? (
        <StoryViewer
          groups={groups}
          startGroup={open}
          isMine={(userId) => userId === me.id}
          onClose={() => setOpen(null)}
          onSeen={() => queryClient.invalidateQueries({ queryKey: ['stories'] })}
          onDelete={(storyId) => remove.mutate(storyId)}
        />
      ) : null}

      <Modal
        open={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setPending(null);
        }}
        title="Новая история"
        description="Подпись необязательна — 200 символов максимум"
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposerOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => publish.mutate()} loading={publish.isPending} disabled={!pending}>
              Опубликовать
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {pending ? (
            pending.kind === 'VIDEO' ? (
              <video src={pending.url} className="max-h-64 w-full rounded-2xl object-contain" controls />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pending.url} alt="" className="max-h-64 w-full rounded-2xl object-contain" />
            )
          ) : (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-ink-faint">
              <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
            </div>
          )}
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            label="Подпись"
            maxLength={200}
            placeholder="Свет в каждом сообщении…"
          />
        </div>
      </Modal>
    </div>
  );
}
