import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: { default: 'CareBridge AI', template: '%s · CareBridge AI' },
  description: 'Offline-first continuity of care — connecting the patient journey from hospital to home.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#0e7667',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="min-h-dvh font-sans antialiased">
        <I18nProvider>{children}</I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
