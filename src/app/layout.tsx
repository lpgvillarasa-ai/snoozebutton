import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeBoot } from '@/components/ThemeToggle';
import { PWAInstaller } from '@/components/PWAInstaller';

export const metadata: Metadata = {
  title: 'Boss Availability',
  description: 'See, in one tap, whether the boss is available right now.',
  applicationName: 'Boss Availability',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Availability',
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/icon-192.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/icon-512.svg' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)',  color: '#0a0a0d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeBoot />
        <div className="mx-auto max-w-md min-h-screen flex flex-col">
          {children}
        </div>
        <PWAInstaller />
      </body>
    </html>
  );
}
