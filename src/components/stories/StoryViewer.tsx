'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Eye, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import { Avatar } from '@/components/ui/Avatar';
import type { PublicUser } from '@/types';

export interface StoryItem {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  viewCount: number;
  reactions: (string | null)[];
  viewers?: { userId: string; emoji: string | null; viewedAt: string }[];
}

export interface StoryGroup {
  user: PublicUser;
  stories: StoryItem[];
  unseen: number;
}

const REACTIONS = ['❤️', '🔥', '😂', '😮', '👏', '✨'];
const SLIDE_MS = 5000;

/** Full-screen story player: auto-advancing progress bars, taps, reactions. */
export function StoryViewer({
  groups,
  startGroup,
  isMine,
  onClose,
  onSeen,
  onDelete,
}: {
  groups: StoryGroup[];
  startGroup: number;
  isMine: (userId: string) => boolean;
  onClose: () => void;
  onSeen: () => void;
  onDelete: (storyId: string) => void;
}) {
  const [groupIndex, setGroupIndex] = useState(startGroup);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const marked = useRef(new Set<string>());

  const group = groups[groupIndex];
  const story = group?.stories[index];
  const mine = group ? isMine(group.user.id) : false;

  /** Advance one story, then one group, then close. */
  function next() {
    if (!group) return onClose();
    if (index + 1 < group.stories.length) {
      setIndex(index + 1);
    } else if (groupIndex + 1 < groups.length) {
      setGroupIndex(groupIndex + 1);
      setIndex(0);
    } else {
      onClose();
    }
    setProgress(0);
  }

  function prev() {
    if (index > 0) setIndex(index - 1);
    else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setIndex(0);
    }
    setProgress(0);
  }

  // `next` closes over state, so the timers read it through a ref instead of
  // re-subscribing on every tick.
  const nextRef = useRef(next);
  const prevRef = useRef(prev);
  nextRef.current = next;
  prevRef.current = prev;

  // Register the view once per story; the endpoint is idempotent anyway.
  useEffect(() => {
    if (!story || mine || marked.current.has(story.id)) return;
    marked.current.add(story.id);
    api.post(`/api/stories/${story.id}/view`, {}).then(onSeen).catch(() => {});
  }, [story, mine, onSeen]);

  useEffect(() => {
    if (!story || story.kind === 'VIDEO' || showViewers) return;
    const step = 100 / (SLIDE_MS / 50);
    const timer = setInterval(() => {
      setProgress((value) => {
        if (value + step >= 100) {
          nextRef.current();
          return 0;
        }
        return value + step;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [story, showViewers]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') nextRef.current();
      if (event.key === 'ArrowLeft') prevRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function react(emoji: string) {
    if (!story) return;
    try {
      await api.post(`/api/stories/${story.id}/view`, { emoji });
      toast.success(`Реакция ${emoji} отправлена`);
    } catch (err) {
      toast.error('Реакция не ушла', (err as Error).message);
    }
  }

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl">
      <div className="relative flex h-full w-full max-w-md flex-col">
        <div className="flex gap-1 p-3">
          {group.stories.map((item, position) => (
            <div key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-[width] duration-100"
                style={{
                  width: position < index ? '100%' : position === index ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        <header className="flex items-center gap-3 px-4 pb-3">
          <Avatar name={group.user.name} src={group.user.avatarUrl} userId={group.user.id} size="sm" ring />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{mine ? 'Моя история' : group.user.name}</p>
            <p className="text-[11px] text-white/60">
              {new Date(story.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {mine ? (
            <>
              <button
                type="button"
                onClick={() => setShowViewers((value) => !value)}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-white"
              >
                <Eye className="h-3.5 w-3.5" /> {story.viewCount}
              </button>
              <button
                type="button"
                onClick={() => onDelete(story.id)}
                className="rounded-full bg-white/10 p-1.5 text-white"
                aria-label="Удалить историю"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-1.5 text-white" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <motion.div
            key={story.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="flex h-full items-center justify-center"
          >
            {story.kind === 'VIDEO' ? (
              <video
                src={story.mediaUrl}
                className="max-h-full max-w-full rounded-3xl"
                autoPlay
                playsInline
                onEnded={() => nextRef.current()}
                controls={false}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.mediaUrl} alt={story.caption ?? 'История'} className="max-h-full max-w-full rounded-3xl" />
            )}
          </motion.div>

          <button
            type="button"
            onClick={prev}
            className="absolute inset-y-0 start-0 w-1/3 cursor-w-resize"
            aria-label="Предыдущая"
          />
          <button
            type="button"
            onClick={next}
            className="absolute inset-y-0 end-0 w-1/3 cursor-e-resize"
            aria-label="Следующая"
          />
          <ChevronLeft className="pointer-events-none absolute start-2 top-1/2 h-6 w-6 -translate-y-1/2 text-white/40" />
          <ChevronRight className="pointer-events-none absolute end-2 top-1/2 h-6 w-6 -translate-y-1/2 text-white/40" />
        </div>

        {story.caption ? (
          <p className="px-5 py-3 text-center text-sm text-white drop-shadow">{story.caption}</p>
        ) : null}

        {showViewers && mine ? (
          <div className="max-h-52 overflow-y-auto border-t border-white/10 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/70">Посмотрели</p>
            {story.viewers?.length ? (
              <ul className="space-y-1">
                {story.viewers.map((viewer) => (
                  <li key={viewer.userId} className="flex items-center justify-between text-xs text-white/80">
                    <span className="font-mono">{viewer.userId.slice(0, 10)}…</span>
                    <span>
                      {viewer.emoji ?? ''}{' '}
                      {new Date(viewer.viewedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-white/60">Пока никто.</p>
            )}
          </div>
        ) : null}

        {!mine ? (
          <div className="flex items-center justify-center gap-2 p-4">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => react(emoji)}
                className={cn(
                  'h-11 w-11 rounded-full bg-white/10 text-xl transition hover:scale-110 hover:bg-white/20',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : story.reactions.filter(Boolean).length ? (
          <p className="p-4 text-center text-lg">{story.reactions.filter(Boolean).join(' ')}</p>
        ) : null}
      </div>
    </div>
  );
}
