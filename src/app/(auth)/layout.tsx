import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-5xl glass-strong lg:grid-cols-2">
        {/* brand panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-accent-gradient p-10 text-white lg:flex">
          <div className="absolute -end-16 -top-16 h-64 w-64 rounded-full bg-white/25 blur-3xl" />
          <div className="absolute -bottom-24 -start-10 h-72 w-72 rounded-full bg-white/20 blur-3xl" />

          <Link href="/" className="relative flex items-center gap-2.5">
            <Sparkles className="h-7 w-7 drop-shadow" />
            <span className="logo-font text-3xl">Lumina</span>
          </Link>

          <div className="relative space-y-4">
            <h1 className="logo-font text-4xl leading-tight drop-shadow-sm">
              Свет в каждом
              <br />
              сообщении
            </h1>
            <p className="max-w-sm text-sm text-white/85">
              Прозрачные диалоги, живые звонки, каналы и истории — в интерфейсе из светящегося стекла.
            </p>
            <ul className="space-y-2 text-sm text-white/80">
              {['Сквозное шифрование личных чатов', 'Звонки и демонстрация экрана', 'Каналы до 2000 участников'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>

          <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Lumina</p>
        </section>

        <section className="p-8 sm:p-10">{children}</section>
      </div>
    </main>
  );
}
