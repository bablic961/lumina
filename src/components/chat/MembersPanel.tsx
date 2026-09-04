'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, Search, Shield, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { useMe } from '@/components/providers/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import type { ChatDetailResponse, MemberRole, PublicUser } from '@/types';

const ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Админ',
  MODERATOR: 'Модератор',
  MEMBER: 'Участник',
};

const ROLE_ICON: Partial<Record<MemberRole, React.ReactNode>> = {
  OWNER: <Crown className="h-3 w-3" aria-hidden />,
  ADMIN: <ShieldCheck className="h-3 w-3" aria-hidden />,
  MODERATOR: <Shield className="h-3 w-3" aria-hidden />,
};

const RANK: Record<MemberRole, number> = { MEMBER: 0, MODERATOR: 1, ADMIN: 2, OWNER: 3 };

/** Member roster with role management for admins and an add-people picker. */
export function MembersPanel({ chatId, detail }: { chatId: string; detail?: ChatDetailResponse }) {
  const { me } = useMe();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const myRole = (detail?.me.role ?? 'MEMBER') as MemberRole;
  const canManage = RANK[myRole] >= RANK.MODERATOR;
  const members = detail?.chat.members ?? [];

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const sorted = [...members].sort((a, b) => RANK[b.role as MemberRole] - RANK[a.role as MemberRole]);
    if (!q) return sorted;
    return sorted.filter((m) => m.user.name.toLowerCase().includes(q) || m.user.username.toLowerCase().includes(q));
  }, [members, filter]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
  }

  async function setRole(userId: string, role: MemberRole) {
    try {
      await api.patch(`/api/chats/${chatId}/members`, { userId, role });
      await refresh();
      toast.success(`Роль изменена: ${ROLE_LABEL[role]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось изменить роль');
    }
  }

  async function kick(userId: string, name: string) {
    if (!window.confirm(`Исключить ${name}?`)) return;
    try {
      await api.del(`/api/chats/${chatId}/members?userId=${userId}`);
      await refresh();
      toast.success(`${name} исключён(а)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось исключить');
    }
  }

  if (!detail) return <div className="skeleton h-40 rounded-2xl" />;

  return (
    <div className="space-y-3">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Найти участника"
        icon={<Search className="h-4 w-4" aria-hidden />}
      />

      {RANK[myRole] >= RANK.ADMIN && detail.chat.type !== 'DM' ? (
        <Button variant="glass" size="sm" className="w-full" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden /> Добавить участников
        </Button>
      ) : null}

      <p className="px-1 text-xs font-semibold text-ink-faint">{members.length} участников</p>

      <ul className="space-y-1">
        {shown.map((member) => {
          const role = member.role as MemberRole;
          const isMe = member.userId === me.id;
          const canTouch = canManage && !isMe && RANK[role] < RANK[myRole];
          const items: MenuItem[] = [
            {
              label: 'Сделать админом',
              icon: <ShieldCheck className="h-4 w-4" aria-hidden />,
              onSelect: () => setRole(member.userId, 'ADMIN'),
              hidden: !canTouch || RANK[myRole] < RANK.ADMIN || role === 'ADMIN',
            },
            {
              label: 'Сделать модератором',
              icon: <Shield className="h-4 w-4" aria-hidden />,
              onSelect: () => setRole(member.userId, 'MODERATOR'),
              hidden: !canTouch || RANK[myRole] < RANK.ADMIN || role === 'MODERATOR',
            },
            {
              label: 'Снять права',
              icon: <Shield className="h-4 w-4" aria-hidden />,
              onSelect: () => setRole(member.userId, 'MEMBER'),
              hidden: !canTouch || RANK[myRole] < RANK.ADMIN || role === 'MEMBER',
            },
            {
              label: 'Передать владение',
              icon: <Crown className="h-4 w-4" aria-hidden />,
              onSelect: () => {
                if (window.confirm(`Передать владение ${member.user.name}? Вы станете админом.`)) {
                  setRole(member.userId, 'OWNER');
                }
              },
              hidden: myRole !== 'OWNER' || isMe,
            },
            {
              label: 'Исключить',
              icon: <UserMinus className="h-4 w-4" aria-hidden />,
              onSelect: () => kick(member.userId, member.user.name),
              danger: true,
              hidden: !canTouch,
            },
          ];

          return (
            <li key={member.id} className="group flex items-center gap-2.5 rounded-2xl px-2 py-1.5 hover:bg-glass/60">
              <Link href={`/app/u/${member.user.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                <Avatar
                  name={member.user.name}
                  src={member.user.avatarUrl}
                  userId={member.userId}
                  size="sm"
                  presence={member.user.presence}
                  verified={member.user.verified}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink">{member.user.name}</span>
                    {isMe ? <span className="text-[10px] text-ink-faint">вы</span> : null}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">
                    {member.user.statusText || `@${member.user.username}`}
                  </span>
                </span>
              </Link>

              {member.customRole ? (
                <span
                  className="rounded-lg px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: `${member.customRole.color}22`, color: member.customRole.color }}
                >
                  {member.customRole.name}
                </span>
              ) : role !== 'MEMBER' ? (
                <span className="flex items-center gap-1 rounded-lg bg-accent-from/12 px-1.5 py-0.5 text-[10px] font-bold text-accent-from">
                  {ROLE_ICON[role]}
                  {ROLE_LABEL[role]}
                </span>
              ) : null}

              {items.some((item) => !item.hidden) ? (
                <Menu
                  align="end"
                  items={items}
                  trigger={
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl text-lg leading-none text-ink-faint transition group-hover:text-ink">
                      ⋯
                    </span>
                  }
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <AddMembersModal chatId={chatId} open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} />
    </div>
  );
}

/** Debounced people picker that skips users already in the chat (server-side). */
function AddMembersModal({
  chatId,
  open,
  onClose,
  onAdded,
}: {
  chatId: string;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [picked, setPicked] = useState<PublicUser[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setPicked([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const data = await api
        .get<{ users: PublicUser[] }>(
          `/api/users/search?q=${encodeURIComponent(query.trim())}&excludeChatId=${chatId}`,
        )
        .catch(() => null);
      setResults(data?.users ?? []);
    }, 260);
    return () => clearTimeout(timer);
  }, [query, chatId]);

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/api/chats/${chatId}/members`, { userIds: picked.map((u) => u.id) });
      toast.success(picked.length === 1 ? 'Участник добавлен' : `Добавлено: ${picked.length}`);
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось добавить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить участников"
      description="Найдите людей по имени или @username."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} loading={busy} disabled={picked.length === 0}>
            Добавить {picked.length || ''}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя или @username"
          icon={<Search className="h-4 w-4" aria-hidden />}
          autoFocus
        />

        {picked.length ? (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((user) => (
              <button
                key={user.id}
                onClick={() => setPicked((prev) => prev.filter((u) => u.id !== user.id))}
                className="press flex items-center gap-1.5 rounded-full bg-accent-from/12 px-2 py-1 text-xs font-semibold text-ink"
              >
                <Avatar name={user.name} src={user.avatarUrl} userId={user.id} size="xs" />
                {user.name} ✕
              </button>
            ))}
          </div>
        ) : null}

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {results
            .filter((user) => !picked.some((p) => p.id === user.id))
            .map((user) => (
              <li key={user.id}>
                <button
                  onClick={() => setPicked((prev) => [...prev, user])}
                  className="press flex w-full items-center gap-2.5 rounded-2xl px-2 py-1.5 text-start hover:bg-glass/70"
                >
                  <Avatar
                    name={user.name}
                    src={user.avatarUrl}
                    userId={user.id}
                    size="sm"
                    presence={user.presence}
                    verified={user.verified}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
                    <span className="block truncate text-xs text-ink-faint">@{user.username}</span>
                  </span>
                  <UserPlus className="h-4 w-4 text-ink-faint" aria-hidden />
                </button>
              </li>
            ))}
          {query.trim().length >= 2 && results.length === 0 ? (
            <li className="py-4 text-center text-sm text-ink-faint">Никого не найдено</li>
          ) : null}
        </ul>
      </div>
    </Modal>
  );
}
