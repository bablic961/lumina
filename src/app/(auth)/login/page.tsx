'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { AtSign, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OAuthRow } from '@/components/profile/OAuthRow';
import { toast } from '@/store/toast';

interface FormValues {
  identifier: string;
  password: string;
  code?: string;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const { register, handleSubmit, formState } = useForm<FormValues>();

  useEffect(() => {
    if (params.get('error')) toast.error('Не удалось войти', 'Проверьте данные и попробуйте снова');
    if (params.get('registered')) toast.success('Аккаунт создан', 'Войдите, чтобы начать общение');
  }, [params]);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const res = await signIn('credentials', { ...values, redirect: false });
    setLoading(false);
    if (res?.error) {
      // Credentials errors are deliberately indistinguishable, so on the first
      // failure we also offer the 2FA field instead of guessing why it failed.
      if (needsCode) {
        toast.error('Неверные данные или код подтверждения');
      } else {
        setNeedsCode(true);
        toast.error('Неверный email/@username или пароль', 'Если включена 2FA — введите код из приложения');
      }
      return;
    }
    router.push(params.get('callbackUrl') || '/app');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Sparkles className="h-6 w-6 text-accent-from" />
        <span className="logo-font text-2xl text-gradient">Lumina</span>
      </div>

      <header className="space-y-1">
        <h2 className="text-2xl font-extrabold text-ink">С возвращением</h2>
        <p className="text-sm text-ink-soft">Войдите, чтобы продолжить разговор</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email или @username"
          placeholder="lumen@lumina.app"
          autoComplete="username"
          icon={<AtSign className="h-4 w-4" />}
          error={formState.errors.identifier?.message}
          {...register('identifier', { required: 'Введите email или @username' })}
        />
        <Input
          label="Пароль"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          icon={<KeyRound className="h-4 w-4" />}
          error={formState.errors.password?.message}
          {...register('password', { required: 'Введите пароль' })}
        />
        {needsCode ? (
          <Input
            label="Код из приложения"
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            icon={<ShieldCheck className="h-4 w-4" />}
            {...register('code')}
          />
        ) : null}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Войти
        </Button>
      </form>

      <OAuthRow />

      <p className="text-center text-sm text-ink-soft">
        Нет аккаунта?{' '}
        <Link href="/register" className="font-semibold text-gradient">
          Создать
        </Link>
      </p>
    </div>
  );
}

/**
 * `useSearchParams` opts the subtree out of prerendering, so the form lives
 * behind Suspense and the shell (logo, headings) still renders statically.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="glass h-[26rem] w-full animate-pulse rounded-3xl" />}>
      <LoginForm />
    </Suspense>
  );
}
