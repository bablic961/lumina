'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Bell, Copy, Hash, Link2, Lock, LogOut, Palette, ShieldAlert, Timer, UserX, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import { useMe } from '@/components/providers/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { ChatDetailResponse } from '@/types';

const SLOW_MODES = [0, 5, 15, 30, 60, 300];
const WALLPAPERS = [
  { label: 'Нет', value: null },
  { label: 'Заря', value: 'linear-gradient(160deg,#fde68a,#fbcfe8)' },
  { label: 'Океан', value: 'linear-gradient(160deg,#a5f3fc,#c7d2fe)' },
  { label: 'Лес', value: 'linear-gradient(160deg,#bbf7d0,#a7f3d0)' },
  { label: 'Ночь', value: 'linear-gradient(160deg,#1e293b,#4c1d95)' },
];

export function ChatInfoPanel({ chatId, detail }: { chatId: string; detail?: ChatDetailResponse }) {
  const { me } = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inviteBusy, setInviteBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');
  const chat = detail?.chat;
  const membership = detail?.me;
  const isAdmin = ['OWNER', 'ADMIN'].includes(membership?.role ?? 'MEMBER');
  const peer = chat?.type === 'DM' ? chat.members.find((m) => m.userId !== me.id)?.user : undefined;

  async function patch(body: Record<string, unknown>) {
    await api.patch(`/api/chats/${chatId}`, body);
    await queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    await queryClient.invalidateQueries({ queryKey: ['chats'] });
  }

  async function createInvite() {
    setInviteBusy(true);
    try {
      const { url } = await api.post<{ url: string }>(`/api/chats/${chatId}/invite`, { maxUses: null, ttlHours: 168 });
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Ссылка скопирована', url);
      await queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать ссылку');
    } finally {
      setInviteBusy(false);
    }
  }

  async function block() {
    if (!peer) return;
    try {
      await api.post('/api/users/block', { userId: peer.id });
      toast.success(`${peer.name} заблокирован`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось заблокировать');
    }
  }

  async function report() {
    if (!reason.trim()) return;
    try {
      await api.post('/api/reports', { targetUserId: peer?.id, reason: reason.trim() });
      toast.success('Жалоба отправлена');
      setReportOpen(false);
      setReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось отправить жалобу');
    }
  }

  /** Leaving is destructive, so it is confirmed before the request goes out. */
  async function leave() {
    const label = chat?.type === 'DM' ? 'Удалить переписку?' : 'Покинуть чат?';
    if (!window.confirm(label)) return;
    try {
      await api.del(`/api/chats/${chatId}`);
      await queryClient.invalidateQueries({ queryKey: ['chats'] });
      router.push('/app');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось выйти из чата');
    }
  }

  if (!chat) return <div className="skeleton h-40 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="glass flex flex-col items-center gap-2 rounded-3xl p-4 text-center">
        <Avatar
          name={peer?.name ?? chat.title ?? 'Чат'}
          src={peer?.avatarUrl ?? chat.avatarUrl}
          userId={peer?.id ?? chat.id}
          size="xl"
          ring
          verified={peer?.verified}
        />
        <div>
          <p className="text-lg font-extrabold text-ink">{peer?.name ?? chat.title}</p>
          {peer ? <p className="text-xs text-ink-faint">@{peer.username}</p> : null}
          {peer?.statusText ? (
            <p className="mt-1 text-xs text-ink-soft">
              {peer.statusEmoji} {peer.statusText}
            </p>
          ) : null}
          {!peer ? (
            <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-ink-faint">
              {chat.type === 'CHANNEL' ? <Hash className="h-3 w-3" aria-hidden /> : <Users className="h-3 w-3" aria-hidden />}
              {chat._count.members} участников · {chat._count.messages} сообщений
            </p>
          ) : null}
        </div>
        {peer?.bio ? <p className="text-xs leading-relaxed text-ink-soft">{peer.bio}</p> : null}
        {chat.description ? <p className="text-xs leading-relaxed text-ink-soft">{chat.description}</p> : null}
      </div>

      <section className="glass space-y-3 rounded-3xl p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
          <Bell className="h-3.5 w-3.5" aria-hidden /> Уведомления
        </h3>
        <Switch
          checked={Boolean(membership?.notificationsEnabled)}
          onChange={(value) => patch(value ? { muteForMinutes: 0 } : { notificationsEnabled: false })}
          label="Присылать уведомления"
        />
        <Switch
          checked={Boolean(membership?.isArchived)}
          onChange={(value) => patch({ isArchived: value })}
          label="В архиве"
        />
        <Switch
          checked={Boolean(membership?.isPinned)}
          onChange={(value) => patch({ isPinned: value })}
          label="Закреплён сверху"
        />
      </section>

      <section className="glass space-y-2 rounded-3xl p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
          <Palette className="h-3.5 w-3.5" aria-hidden /> Обои чата
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {WALLPAPERS.map((paper) => (
            <button
              key={paper.label}
              onClick={() => patch({ wallpaper: paper.value })}
              disabled={!isAdmin && chat.type !== 'DM'}
              className={cn(
                'press h-10 w-14 overflow-hidden rounded-xl ring-1 ring-inset ring-hairline transition hover:scale-105',
                chat.wallpaper === paper.value && 'ring-2 ring-accent-from',
              )}
              style={paper.value ? { background: paper.value } : undefined}
              aria-label={paper.label}
              title={paper.label}
            >
              {!paper.value ? <span className="text-[10px] font-bold text-ink-faint">нет</span> : null}
            </button>
          ))}
        </div>
      </section>

      {chat.type !== 'DM' && isAdmin ? (
        <section className="glass space-y-3 rounded-3xl p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Управление
          </h3>
          <Input
            label="Название"
            defaultValue={chat.title ?? ''}
            onBlur={(e) => e.target.value !== chat.title && patch({ title: e.target.value })}
          />
          <Input
            label="Описание"
            defaultValue={chat.description ?? ''}
            onBlur={(e) => e.target.value !== chat.description && patch({ description: e.target.value })}
          />
          <Switch
            checked={chat.onlyAdminsCanPost}
            onChange={(value) => patch({ onlyAdminsCanPost: value })}
            label="Писать могут только админы"
          />
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
              <Timer className="h-3.5 w-3.5" aria-hidden /> Медленный режим
            </p>
            <div className="flex flex-wrap gap-1">
              {SLOW_MODES.map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => patch({ slowModeSec: seconds })}
                  className={cn(
                    'press rounded-xl px-2 py-1 text-xs font-semibold transition',
                    chat.slowModeSec === seconds ? 'bg-accent-gradient text-white' : 'bg-glass/70 text-ink-soft',
                  )}
                >
                  {seconds === 0 ? 'выкл' : seconds < 60 ? `${seconds}с` : `${seconds / 60}м`}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {chat.type === 'DM' ? (
        <section className="glass space-y-2 rounded-3xl p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Шифрование
          </h3>
          <Switch
            checked={chat.e2eEnabled}
            onChange={(value) => patch({ e2eEnabled: value })}
            label="Сквозное шифрование"
            description={
              peer?.e2ePublicKey
                ? 'Новые сообщения шифруются на устройстве — сервер видит только шифртекст.'
                : 'Собеседник ещё не создал ключ. Включите позже.'
            }
            disabled={!peer?.e2ePublicKey}
          />
        </section>
      ) : null}

      {chat.type !== 'DM' ? (
        <section className="glass space-y-2 rounded-3xl p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
            <Link2 className="h-3.5 w-3.5" aria-hidden /> Ссылки-приглашения
          </h3>
          {chat.invites.length === 0 ? (
            <p className="text-xs text-ink-faint">Пока нет активных ссылок.</p>
          ) : (
            <ul className="space-y-1.5">
              {chat.invites.map((invite) => (
                <li key={invite.id} className="flex items-center gap-2 rounded-2xl bg-glass/60 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-ink">/join/{invite.code}</p>
                    <p className="text-[10px] text-ink-faint">
                      {invite.uses}
                      {invite.maxUses ? ` / ${invite.maxUses}` : ''} использований
                      {invite.expiresAt ? ` · до ${new Date(invite.expiresAt).toLocaleDateString('ru-RU')}` : ' · без срока'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(`${window.location.origin}/join/${invite.code}`)
                        .then(() => toast.success('Ссылка скопирована'))
                        .catch(() => toast.error('Не удалось скопировать'));
                    }}
                    className="press rounded-xl p-1.5 text-ink-soft transition hover:bg-accent-from/10 hover:text-ink"
                    aria-label="Скопировать ссылку"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isAdmin ? (
            <Button variant="glass" size="sm" loading={inviteBusy} onClick={createInvite} className="w-full">
              Создать ссылку
            </Button>
          ) : null}
        </section>
      ) : null}

      <section className="glass space-y-1.5 rounded-3xl p-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-rose-500">Опасная зона</h3>
        {peer ? (
          <>
            <button
              onClick={block}
              className="press flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-sm text-rose-500 transition hover:bg-rose-500/10"
            >
              <UserX className="h-4 w-4" aria-hidden /> Заблокировать {peer.name}
            </button>
            <button
              onClick={() => setReportOpen(true)}
              className="press flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-sm text-ink-soft transition hover:bg-glass/70"
            >
              <ShieldAlert className="h-4 w-4" aria-hidden /> Пожаловаться
            </button>
          </>
        ) : null}
        <button
          onClick={leave}
          className="press flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-sm text-rose-500 transition hover:bg-rose-500/10"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {chat.type === 'DM' ? 'Удалить переписку' : 'Покинуть чат'}
        </button>
      </section>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Пожаловаться"
        description="Модераторы получат обращение вместе со ссылкой на чат."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              Отмена
            </Button>
            <Button variant="danger" onClick={report}>
              Отправить
            </Button>
          </>
        }
      >
        <Input
          label="Причина"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Спам, оскорбления, мошенничество…"
        />
      </Modal>
    </div>
  );
}
