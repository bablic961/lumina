'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Github, Chrome, Apple, MessageCircle } from 'lucide-react';

const META: Record<string, { label: string; icon: React.ReactNode }> = {
  google: { label: 'Google', icon: <Chrome className="h-4 w-4" /> },
  github: { label: 'GitHub', icon: <Github className="h-4 w-4" /> },
  discord: { label: 'Discord', icon: <MessageCircle className="h-4 w-4" /> },
  apple: { label: 'Apple', icon: <Apple className="h-4 w-4" /> },
};

/**
 * Renders only the providers that actually have credentials in .env —
 * NextAuth's /api/auth/providers is the source of truth, so a half-configured
 * deployment never shows a button that cannot work.
 */
export function OAuthRow() {
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((data: Record<string, { id: string }>) =>
        setProviders(Object.keys(data).filter((id) => id in META)),
      )
      .catch(() => setProviders([]));
  }, []);

  if (providers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-hairline bg-glass/40 p-3 text-center text-xs text-ink-faint">
        OAuth-провайдеры отключены — добавьте ключи Google / GitHub / Discord / Apple в <code>.env</code>,
        и кнопки появятся здесь автоматически.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-xs uppercase tracking-wide text-ink-faint">или продолжить через</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((id) => (
          <button
            key={id}
            onClick={() => signIn(id, { callbackUrl: '/app' })}
            className="glass glass-hover press flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold text-ink"
          >
            {META[id].icon}
            {META[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
