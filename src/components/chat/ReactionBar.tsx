'use client';

import { cn } from '@/lib/utils';
import { useMe } from '@/components/providers/MeProvider';
import { useSocketContext } from '@/components/providers/SocketProvider';
import type { ReactionSummary } from '@/types';

const LIGHT = new Set(['✨', '💡', '🌟', '⚡', '🔥', '🌈']);

/** Reaction chips under a bubble. "Light" emoji glow and trigger the burst effect. */
export function ReactionBar({
  messageId,
  summary,
  align,
}: {
  messageId: string;
  summary: ReactionSummary[];
  align: 'start' | 'end';
}) {
  const { me } = useMe();
  const { socket } = useSocketContext();
  if (summary.length === 0) return null;

  return (
    <div className={cn('mt-1 flex flex-wrap gap-1', align === 'end' ? 'justify-end' : 'justify-start')}>
      {summary.map((reaction) => {
        const mine = reaction.userIds.includes(me.id);
        return (
          <button
            key={reaction.emoji}
            onClick={() => socket?.emit('reaction:toggle', { messageId, emoji: reaction.emoji })}
            className={cn(
              'press flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold transition-all duration-300',
              mine ? 'bg-accent/20 text-accent ring-1 ring-inset ring-accent-from/40' : 'glass text-ink-soft',
              LIGHT.has(reaction.emoji) && 'shadow-glow',
            )}
            aria-pressed={mine}
            aria-label={`${reaction.emoji} ${reaction.count}`}
          >
            <span className={cn(LIGHT.has(reaction.emoji) && 'drop-shadow-[0_0_6px_rgba(245,158,11,0.9)]')}>
              {reaction.emoji}
            </span>
            {reaction.count > 1 ? <span className="font-mono text-[11px]">{reaction.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
