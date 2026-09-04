import { MessageCircleHeart } from 'lucide-react';

export default function AppIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="glass flex h-24 w-24 items-center justify-center rounded-3xl shadow-glow">
        <MessageCircleHeart className="h-11 w-11 text-accent" aria-hidden />
      </div>
      <h2 className="logo-font text-3xl font-extrabold text-gradient">Lumina</h2>
      <p className="max-w-sm text-sm text-ink-soft">
        Выберите чат слева или начните новый разговор. Сообщения, звонки и файлы — в одном светлом
        пространстве.
      </p>
      <p className="text-xs text-ink-faint">
        Подсказка: <kbd className="glass rounded-lg px-1.5 py-0.5 font-mono text-[11px]">Ctrl</kbd> +{' '}
        <kbd className="glass rounded-lg px-1.5 py-0.5 font-mono text-[11px]">K</kbd> — быстрый поиск
      </p>
    </div>
  );
}
