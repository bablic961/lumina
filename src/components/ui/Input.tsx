'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, FieldProps>(function Input(
  { label, error, hint, icon, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-faint">{icon}</span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'w-full rounded-2xl bg-glass/70 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint',
            'border border-hairline backdrop-blur-xl transition-all duration-200',
            'focus:border-accent-from/60 focus:outline-none focus:ring-2 focus:ring-accent-from/25',
            icon && 'ps-10',
            error && 'border-rose-400/70 focus:ring-rose-400/25',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-rose-500">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full resize-none rounded-2xl border border-hairline bg-glass/70 px-4 py-3 text-sm',
          'text-ink placeholder:text-ink-faint backdrop-blur-xl focus:border-accent-from/60 focus:outline-none focus:ring-2 focus:ring-accent-from/25',
          className,
        )}
        {...props}
      />
    );
  },
);
