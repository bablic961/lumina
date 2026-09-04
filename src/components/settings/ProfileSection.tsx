'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, Loader2, Sparkles, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Switch';
import { SettingsCard, Row } from './SettingsCard';
import type { Presence, PublicUser } from '@/types';

const PRESENCE: { value: Presence; label: string }[] = [
  { value: 'ONLINE', label: 'В сети' },
  { value: 'AWAY', label: 'Отошёл' },
  { value: 'DND', label: 'Не беспокоить' },
  { value: 'OFFLINE', label: 'Невидимый' },
];

const STATUS_EMOJI = ['✨', '💻', '🎧', '☕', '🌙', '🏖', '🚀', '📚', '🎮', '🤒'];

/** Name, bio, avatar, emoji status and birthday — everything others see. */
export function ProfileSection({ me }: { me: PublicUser & { birthday?: string | null } }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio ?? '');
  const [statusEmoji, setStatusEmoji] = useState(me.statusEmoji ?? '');
  const [statusText, setStatusText] = useState(me.statusText ?? '');
  const [presence, setPresence] = useState<Presence>(me.presence ?? 'ONLINE');
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl ?? '');
  const [birthday, setBirthday] = useState(me.birthday ? String(me.birthday).slice(0, 10) : '');
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch('/api/users/me', patch),
    onSuccess: () => toast.success('Профиль обновлён'),
    onError: (err: Error) => toast.error('Не удалось сохранить', err.message),
  });

  async function pickAvatar(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append('files', file);
      const res = await api.post<{ files: { url: string }[] }>('/api/upload', body);
      const url = res.files[0]?.url;
      if (!url) throw new Error('Файл не загрузился');
      setAvatarUrl(url);
      await save.mutateAsync({ avatarUrl: url });
    } catch (err) {
      toast.error('Аватар не загружен', (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SettingsCard title="Профиль" description="Как вас видят другие" icon={<UserRound className="h-4 w-4" />}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative rounded-full"
          aria-label="Сменить аватар"
        >
          <Avatar name={name || me.name} src={avatarUrl || null} userId={me.id} size="xl" ring />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/50 opacity-0 transition group-hover:opacity-100">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
          </span>
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} label="Имя" maxLength={48} />
          <p className="font-mono text-xs text-ink-faint">@{me.username}</p>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pickAvatar(file);
          e.target.value = '';
        }}
      />

      <Textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        maxLength={280}
        placeholder="Немного о себе…"
        aria-label="О себе"
      />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setStatusEmoji(statusEmoji === emoji ? '' : emoji)}
            className={`h-9 w-9 rounded-xl text-lg transition hover:bg-glass ${
              statusEmoji === emoji ? 'bg-accent-gradient shadow-glow' : 'bg-glass/50'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <Input
        value={statusText}
        onChange={(e) => setStatusText(e.target.value)}
        label="Статус"
        maxLength={64}
        icon={<Sparkles className="h-4 w-4" />}
        placeholder="Пишу код и слушаю лоуфай"
      />

      <Row label="Статус присутствия" hint="«Невидимый» скрывает вас из списков онлайна">
        <Segmented value={presence} onChange={setPresence} options={PRESENCE} />
      </Row>

      <Row label="День рождения" hint="Друзья получат напоминание">
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="h-10 rounded-2xl border border-white/30 bg-glass/60 px-3 text-sm text-ink outline-none focus:shadow-ring"
        />
      </Row>

      <Button
        onClick={() =>
          save.mutate({
            name,
            bio: bio || null,
            statusEmoji: statusEmoji || null,
            statusText: statusText || null,
            presence,
            birthday: birthday ? new Date(`${birthday}T12:00:00.000Z`).toISOString() : null,
          })
        }
        loading={save.isPending}
        className="w-full"
      >
        Сохранить профиль
      </Button>
    </SettingsCard>
  );
}
