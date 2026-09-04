import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Fira_Code } from 'next/font/google';
import { AppProviders } from '@/components/providers/AppProviders';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = Fira_Code({
  subsets: ['latin', 'cyrillic-ext'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lumina — свет в каждом сообщении',
  description:
    'Lumina — коммуникационная платформа нового поколения: светящееся стекло, real-time чаты, звонки и каналы.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Lumina',
  appleWebApp: { capable: true, title: 'Lumina', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
  openGraph: {
    title: 'Lumina',
    description: 'Свет в каждом сообщении',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#f8fafc',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="light" data-accent="amber" data-density="cozy" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
