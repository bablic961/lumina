'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { AtSign, KeyRound, Mail, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OAuthRow } from '@/components/profile/OAuthRow';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/store/toast';

interface FormValues {
  name: string;
  username: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await api.post('/api/auth/register', values);
      toast.success('Добро пожаловать в Lumina');
      router.push('/login?registered=1');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать аккаунт');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Sparkles className="h-6 w-6 text-accent-from" />
        <span className="logo-font text-2xl text-gradient">Lumina</span>
      </div>

      <header className="space-y-1">
        <h2 className="text-2xl font-extrabold text-ink">Присоединиться к Lumina</h2>
        <p className="text-sm text-ink-soft">Бесплатно, без рекламы, со сквозным шифрованием</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Имя"
          placeholder="Алина Светлова"
          icon={<User className="h-4 w-4" />}
          error={formState.errors.name?.message}
          {...register('name', { required: 'Как вас зовут?', minLength: { value: 2, message: 'Минимум 2 символа' } })}
        />
        <Input
          label="Username"
          placeholder="lumen"
          icon={<AtSign className="h-4 w-4" />}
          hint="Латиница, цифры и _ — по нему вас найдут"
          error={formState.errors.username?.message}
          {...register('username', {
            required: 'Придумайте username',
            pattern: { value: /^[a-zA-Z0-9_]{3,24}$/, message: '3–24 символа: латиница, цифры, _' },
          })}
        />
        <Input
          label="Email"
          type="email"
          placeholder="lumen@lumina.app"
          icon={<Mail className="h-4 w-4" />}
          error={formState.errors.email?.message}
          {...register('email', {
            required: 'Введите email',
            pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: 'Некорректный email' },
          })}
        />
        <Input
          label="Пароль"
          type="password"
          placeholder="минимум 8 символов"
          autoComplete="new-password"
          icon={<KeyRound className="h-4 w-4" />}
          error={formState.errors.password?.message}
          {...register('password', { required: 'Введите пароль', minLength: { value: 8, message: 'Минимум 8 символов' } })}
        />
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Создать аккаунт
        </Button>
      </form>

      <OAuthRow />

      <p className="text-center text-sm text-ink-soft">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="font-semibold text-gradient">
          Войти
        </Link>
      </p>
    </div>
  );
}
