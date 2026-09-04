'use client';

import { BadgeCheck } from 'lucide-react';
import { cn, gradientFor, initials } from '@/lib/utils';
import type { Presence } from '@/types';

const SIZES = { xs: 'h-7 w-7 text-[10px]', sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' };
const DOT = { xs: 'h-2 w-2', sm: 'h-2.5 w-2.5', md: 'h-3 w-3', lg: 'h-3.5 w-3.5', xl: 'h-4 w-4' };
const PRESENCE_COLOR: Record<Presence, string> = {
  ONLINE: 'bg-online',
  AWAY: 'bg-away',
  DND: 'bg-dnd',
  OFFLINE: 'bg-offline',
};

interface AvatarProps {
  name: string;
  src?: string | null;
  userId?: string;
  size?: keyof typeof SIZES;
  presence?: Presence;
  verified?: boolean;
  ring?: boolean;
  className?: string;
}

/**
 * Falls back to a "3D" initials tile: a per-user deterministic gradient with an
 * inner highlight and drop shadow, so users without a photo still look distinct.
 */
export function Avatar({ name, src, userId, size = 'md', presence, verified, ring, className }: AvatarProps) {
  return (
    <div className={cn('relative shrink-0', ring && 'status-ring', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className={cn('rounded-full object-cover shadow-glass', SIZES[size])}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full font-bold text-white',
            'shadow-[inset_0_2px_6px_rgba(255,255,255,0.45),inset_0_-3px_8px_rgba(0,0,0,0.25),0_6px_16px_-6px_rgba(15,23,42,0.5)]',
            SIZES[size],
          )}
          style={{ backgroundImage: gradientFor(userId || name) }}
          aria-label={name}
        >
          <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">{initials(name)}</span>
        </div>
      )}

      {presence ? (
        <span
          className={cn(
            'absolute -bottom-0.5 -end-0.5 rounded-full ring-2 ring-canvas',
            DOT[size],
            PRESENCE_COLOR[presence],
          )}
          title={presence.toLowerCase()}
        >
          {presence === 'ONLINE' ? (
            <span className={cn('absolute inset-0 animate-pulse-ring rounded-full', PRESENCE_COLOR[presence])} />
          ) : null}
        </span>
      ) : null}

      {verified ? (
        <BadgeCheck
          className="absolute -top-1 -end-1 h-4 w-4 fill-amber-400 text-white drop-shadow"
          aria-label="verified"
        />
      ) : null}
    </div>
  );
}
