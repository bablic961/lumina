'use client';

import { BarChart3, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { useMe } from '@/components/providers/MeProvider';
import type { PollDTO } from '@/types';

/** Poll with live results; a tap toggles the vote and the server broadcasts totals. */
export function PollCard({ poll, outgoing }: { poll: PollDTO; outgoing: boolean }) {
  const { socket } = useSocketContext();
  const { me } = useMe();

  const total = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  const closed = Boolean(poll.closesAt && new Date(poll.closesAt) < new Date());
  const myVotes = new Set(
    poll.options.filter((o) => o.votes.some((v) => v.userId === me.id)).map((o) => o.id),
  );

  return (
    <div className="min-w-[15rem] space-y-2 py-0.5">
      <div className="flex items-start gap-2">
        <BarChart3 className={cn('mt-0.5 h-4 w-4 shrink-0', outgoing ? 'text-white/80' : 'text-accent')} aria-hidden />
        <div>
          <p className="text-sm font-bold leading-snug">{poll.question}</p>
          <p className={cn('text-[11px]', outgoing ? 'text-white/70' : 'text-ink-faint')}>
            {poll.anonymous ? 'Анонимный опрос' : 'Открытый опрос'}
            {poll.multiple ? ' · несколько вариантов' : ''}
            {closed ? ' · завершён' : ''}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {poll.options.map((option) => {
          const count = option.votes.length;
          const share = total ? Math.round((count / total) * 100) : 0;
          const chosen = myVotes.has(option.id);
          return (
            <button
              key={option.id}
              disabled={closed}
              onClick={() => socket?.emit('poll:vote', { optionId: option.id })}
              className={cn(
                'relative w-full overflow-hidden rounded-xl px-2.5 py-2 text-start text-xs transition disabled:cursor-not-allowed',
                outgoing ? 'bg-white/15 hover:bg-white/25' : 'bg-glass/70 hover:bg-glass',
                chosen && 'ring-1 ring-inset ring-accent-from/70',
              )}
            >
              <span
                className={cn(
                  'absolute inset-y-0 start-0 transition-all duration-500 ease-lumina',
                  outgoing ? 'bg-white/25' : 'bg-accent-gradient/25',
                )}
                style={{ width: `${share}%` }}
                aria-hidden
              />
              <span className="relative flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    chosen ? 'border-transparent bg-accent-gradient text-white' : 'border-ink-faint/50',
                  )}
                  aria-hidden
                >
                  {chosen ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{option.text}</span>
                <span className="shrink-0 font-mono text-[11px]">{share}%</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className={cn('flex items-center gap-1 text-[11px]', outgoing ? 'text-white/70' : 'text-ink-faint')}>
        {closed ? <Lock className="h-3 w-3" aria-hidden /> : null}
        {total} {total === 1 ? 'голос' : total < 5 ? 'голоса' : 'голосов'}
      </p>
    </div>
  );
}
