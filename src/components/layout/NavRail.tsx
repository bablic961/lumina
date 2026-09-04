'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bookmark,
  Circle,
  MessagesSquare,
  NotebookPen,
  Settings,
  Shield,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMe } from '@/components/providers/MeProvider';
import { Avatar } from '@/components/ui/Avatar';

const LINKS = [
  { href: '/app', label: 'Чаты', icon: MessagesSquare, match: /^\/app(\/chat)?/ },
  { href: '/app/stories', label: 'Истории', icon: Circle, match: /^\/app\/stories/ },
  { href: '/app/saved', label: 'Избранное', icon: Bookmark, match: /^\/app\/saved/ },
  { href: '/app/notes', label: 'Заметки', icon: NotebookPen, match: /^\/app\/notes/ },
];

export function NavRail({ isAdmin, horizontal }: { isAdmin: boolean; horizontal?: boolean }) {
  const pathname = usePathname();
  const { me } = useMe();

  const items = [
    ...LINKS,
    ...(isAdmin ? [{ href: '/app/admin', label: 'Админ', icon: Shield, match: /^\/app\/admin/ }] : []),
  ];

  return (
    <nav
      className={cn(
        'glass-strong flex items-center gap-1 border-hairline',
        horizontal
          ? 'w-full justify-around border-t px-2 pb-[env(safe-area-inset-bottom)] pt-2'
          : 'h-full w-[4.5rem] flex-col border-e px-2 py-4',
      )}
      aria-label="Основная навигация"
    >
      {!horizontal ? (
        <Link
          href="/app"
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-gradient shadow-glow transition-transform duration-300 hover:scale-105"
          aria-label="Lumina"
        >
          <Sparkles className="h-5 w-5 text-white" aria-hidden />
        </Link>
      ) : null}

      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match.test(pathname);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'press relative flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-300',
              horizontal ? 'h-14 flex-1 text-[10px]' : 'h-12 w-12',
              active ? 'bg-accent/15 text-accent shadow-glow' : 'text-ink-soft hover:bg-glass/60 hover:text-ink',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {horizontal ? <span className="font-semibold">{label}</span> : null}
            {active && !horizontal ? (
              <span className="absolute -start-2 h-6 w-1 rounded-full bg-accent-gradient" aria-hidden />
            ) : null}
          </Link>
        );
      })}

      <div className={cn(horizontal ? '' : 'mt-auto flex flex-col items-center gap-2')}>
        {!horizontal ? (
          <Link
            href="/app/settings"
            title="Настройки"
            className={cn(
              'press flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300',
              /^\/app\/settings/.test(pathname)
                ? 'bg-accent/15 text-accent shadow-glow'
                : 'text-ink-soft hover:bg-glass/60 hover:text-ink',
            )}
          >
            <Settings className="h-5 w-5" aria-hidden />
          </Link>
        ) : null}
        <Link href="/app/settings" aria-label="Профиль" className={horizontal ? 'flex flex-col items-center' : ''}>
          <Avatar
            name={me.name}
            src={me.avatarUrl}
            userId={me.id}
            size={horizontal ? 'xs' : 'sm'}
            presence={me.presence}
            ring
          />
          {horizontal ? <span className="mt-0.5 text-[10px] font-semibold text-ink-soft">Я</span> : null}
        </Link>
      </div>
    </nav>
  );
}
