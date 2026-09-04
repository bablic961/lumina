'use client';

import { cn } from '@/lib/utils';

/** Shared glass panel so every settings block lines up. */
export function SettingsCard({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('glass rounded-3xl p-5', className)}>
      <header className="mb-4 flex items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink-faint">{description}</p> : null}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Label + control row used by the pickers below. */
export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
