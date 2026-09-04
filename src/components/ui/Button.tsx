'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'glass' | 'ghost' | 'danger' | 'secondary';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-gradient text-white shadow-glow hover:shadow-glow-lg',
  secondary: 'bg-accent2-gradient text-white shadow-glass hover:brightness-110',
  glass: 'glass text-ink hover:shadow-glow',
  ghost: 'text-ink-soft hover:bg-glass/60 hover:text-ink',
  danger: 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-glass hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-2xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'btn-ray press inline-flex select-none items-center justify-center font-semibold',
        'transition-all duration-300 ease-lumina disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
