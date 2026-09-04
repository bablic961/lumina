import type { Config } from 'tailwindcss';

/**
 * Lumina design system.
 * Every colour resolves through a CSS variable so that theme (light / dark / amoled)
 * and the 12 accent presets can be swapped at runtime without a re-render.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        'canvas-2': 'rgb(var(--canvas-2) / <alpha-value>)',
        glass: 'rgb(var(--glass) / <alpha-value>)',
        'glass-strong': 'rgb(var(--glass-strong) / <alpha-value>)',
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--ink-soft) / <alpha-value>)',
        'ink-faint': 'rgb(var(--ink-faint) / <alpha-value>)',
        accent: {
          from: 'rgb(var(--accent-from) / <alpha-value>)',
          to: 'rgb(var(--accent-to) / <alpha-value>)',
          DEFAULT: 'rgb(var(--accent-from) / <alpha-value>)',
        },
        accent2: {
          from: 'rgb(var(--accent2-from) / <alpha-value>)',
          to: 'rgb(var(--accent2-to) / <alpha-value>)',
          DEFAULT: 'rgb(var(--accent2-from) / <alpha-value>)',
        },
        online: '#10b981',
        away: '#f59e0b',
        dnd: '#ef4444',
        offline: '#94a3b8',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Clash Display', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, rgb(var(--accent-from)), rgb(var(--accent-to)))',
        'accent2-gradient': 'linear-gradient(135deg, rgb(var(--accent2-from)), rgb(var(--accent2-to)))',
        'canvas-gradient': 'linear-gradient(160deg, rgb(var(--canvas)), rgb(var(--canvas-2)))',
        'glass-sheen': 'linear-gradient(120deg, rgb(255 255 255 / 0.35) 0%, rgb(255 255 255 / 0) 55%)',
      },
      boxShadow: {
        glass: '0 8px 32px -8px rgb(15 23 42 / 0.18), inset 0 1px 0 0 rgb(255 255 255 / 0.35)',
        'glass-lg': '0 24px 64px -16px rgb(15 23 42 / 0.25), inset 0 1px 0 0 rgb(255 255 255 / 0.4)',
        glow: '0 0 0 1px rgb(var(--accent-from) / 0.35), 0 8px 28px -6px rgb(var(--accent-from) / 0.45)',
        'glow-lg': '0 0 48px -6px rgb(var(--accent-from) / 0.55)',
        ring: '0 0 0 3px rgb(var(--accent-from) / 0.28)',
      },
      backdropBlur: { xs: '2px', glass: '24px', heavy: '40px' },
      borderRadius: { '4xl': '2rem', '5xl': '2.75rem' },
      transitionTimingFunction: {
        lumina: 'cubic-bezier(0.22, 1, 0.36, 1)',
        snap: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'light-burst': {
          '0%': { opacity: '0', transform: 'scale(0.85)', filter: 'brightness(1.8)' },
          '60%': { opacity: '1', filter: 'brightness(1.15)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'brightness(1)' },
        },
        'ray-sweep': { '0%': { transform: 'translateX(-120%) skewX(-18deg)' }, '100%': { transform: 'translateX(220%) skewX(-18deg)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'slide-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'gradient-shift': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        'bounce-dot': { '0%,80%,100%': { transform: 'translateY(0)', opacity: '0.4' }, '40%': { transform: 'translateY(-5px)', opacity: '1' } },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        'light-burst': 'light-burst 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'ray-sweep': 'ray-sweep 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        float: 'float 4s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'bounce-dot': 'bounce-dot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
