'use client';

import { useState } from 'react';
import { Activity, Gauge, Megaphone, ScrollText, ShieldAlert, ShieldCheck, Sticker, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMe } from '@/components/providers/MeProvider';
import { AdminAudit } from '@/components/admin/AdminAudit';
import { AdminBroadcast } from '@/components/admin/AdminBroadcast';
import { AdminRateLimits } from '@/components/admin/AdminRateLimits';
import { AdminReports } from '@/components/admin/AdminReports';
import { AdminStats } from '@/components/admin/AdminStats';
import { AdminStickers } from '@/components/admin/AdminStickers';
import { AdminUsers } from '@/components/admin/AdminUsers';

const TABS = [
  { key: 'stats', label: 'Статистика', icon: Activity },
  { key: 'users', label: 'Пользователи', icon: Users },
  { key: 'reports', label: 'Жалобы', icon: ShieldAlert },
  { key: 'stickers', label: 'Стикеры', icon: Sticker },
  { key: 'limits', label: 'Лимиты', icon: Gauge },
  { key: 'broadcast', label: 'Рассылка', icon: Megaphone },
  { key: 'audit', label: 'Журнал', icon: ScrollText },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** Admin console. The API guards every route with `requireAdmin` regardless. */
export default function AdminPage() {
  const { isAdmin } = useMe();
  const [tab, setTab] = useState<TabKey>('stats');

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="glass max-w-sm space-y-2 rounded-3xl p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-ink-faint" aria-hidden />
          <p className="text-sm font-semibold text-ink">Раздел только для администраторов</p>
          <p className="text-xs text-ink-faint">Если это ошибка — попросите владельца выдать роль ADMIN.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="glass-strong sticky top-0 z-10 border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold text-ink">Админ-панель</h1>
            <p className="text-xs text-ink-faint">Модерация, лимиты и аналитика инстанса</p>
          </div>
        </div>
        <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Разделы админки">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-current={tab === item.key}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold transition',
                tab === item.key ? 'bg-accent-gradient text-white shadow-glow' : 'bg-glass/60 text-ink-soft hover:shadow-glow',
              )}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden /> {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-5xl p-5 pb-24 md:pb-8">
        {tab === 'stats' ? <AdminStats /> : null}
        {tab === 'users' ? <AdminUsers /> : null}
        {tab === 'reports' ? <AdminReports /> : null}
        {tab === 'stickers' ? <AdminStickers /> : null}
        {tab === 'limits' ? <AdminRateLimits /> : null}
        {tab === 'broadcast' ? <AdminBroadcast /> : null}
        {tab === 'audit' ? <AdminAudit /> : null}
      </div>
    </div>
  );
}
