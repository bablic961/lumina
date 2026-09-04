'use client';

import { useQuery } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import { LogOut, Settings2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/components/providers/MeProvider';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { AppearanceSection } from '@/components/settings/AppearanceSection';
import { LanguageSection } from '@/components/settings/LanguageSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { PrivacySection } from '@/components/settings/PrivacySection';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { BADGE_LABELS } from '@/lib/badges';
import type { PublicUser } from '@/types';

type Reach = 'EVERYONE' | 'CONTACTS' | 'NOBODY';

interface MeResponse {
  user: PublicUser & {
    email: string;
    birthday: string | null;
    whoCanMessage: Reach;
    showPresence: boolean;
    showReadState: boolean;
    e2ePublicKey: string | null;
    createdAt: string;
  };
  badges: { id: string; key: string; earnedAt: string }[];
}

/** Everything about the account, in two glass columns on wide screens. */
export default function SettingsPage() {
  const { me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'full'],
    queryFn: () => api.get<MeResponse>('/api/users/me'),
  });

  return (
    <div className="h-full overflow-y-auto">
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-3 border-b border-hairline px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow">
          <Settings2 className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold text-ink">Настройки</h1>
          <p className="truncate text-xs text-ink-faint">
            {me.name} · <span className="font-mono">@{me.username}</span>
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-5 pb-24 md:pb-8">
        {isLoading || !data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass space-y-3 rounded-3xl p-5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <ProfileSection me={data.user} />
              <NotificationsSection />
              <LanguageSection />
            </div>
            <div className="space-y-4">
              <AppearanceSection />
              <PrivacySection
                initial={{
                  whoCanMessage: data.user.whoCanMessage,
                  showPresence: data.user.showPresence,
                  showReadState: data.user.showReadState,
                  e2ePublicKey: data.user.e2ePublicKey,
                }}
              />
              <SecuritySection />
              <SettingsCard title="Аккаунт" icon={<Sparkles className="h-4 w-4" />}>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-faint">Email</dt>
                    <dd className="truncate font-medium text-ink">{data.user.email}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-faint">С нами с</dt>
                    <dd className="font-medium text-ink">
                      {new Date(data.user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                    </dd>
                  </div>
                  {data.badges.length ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-faint">Награды</dt>
                      <dd className="flex flex-wrap justify-end gap-1">
                        {data.badges.map((badge) => (
                          <span
                            key={badge.id}
                            title={new Date(badge.earnedAt).toLocaleDateString('ru-RU')}
                            className="rounded-full bg-glass px-2 py-0.5 text-xs text-ink"
                          >
                            {BADGE_LABELS[badge.key] ?? badge.key}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <Button variant="glass" className="w-full" onClick={() => signOut({ callbackUrl: '/login' })}>
                  <LogOut className="h-4 w-4" /> Выйти из аккаунта
                </Button>
              </SettingsCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
