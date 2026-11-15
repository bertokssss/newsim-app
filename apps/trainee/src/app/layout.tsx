import type { Metadata, Viewport } from 'next';
import { League_Spartan, Libre_Baskerville, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, CookieConsentBanner, AnalyticsProvider } from '@newsim/ui';
import { TraineeLayoutShell } from '@/components/TraineeLayoutShell';

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  variable: '--font-league-spartan',
  display: 'swap',
});

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  variable: '--font-libre-baskerville',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#06090d' },
  ],
};

export const metadata: Metadata = {
  title: 'NEWSIM Trainee Portal | Maritime Training',
  description: 'Maritime Training Trainee Portal, Course Progress, and Certificates',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NEWSIM Trainee',
  },
};

export default function TraineeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${leagueSpartan.variable} ${libreBaskerville.variable} ${inter.variable} light`}
      data-scroll-behavior="smooth"
    >
      <body suppressHydrationWarning className="antialiased font-sans bg-background text-foreground transition-colors duration-200 light">
        <ThemeProvider defaultTheme="light" storageKey="newsim_trainee_theme" enableSystem={false}>
          <TraineeLayoutShell>{children}</TraineeLayoutShell>
          <CookieConsentBanner privacyHref="/privacy" cookiePolicyHref="/privacy#cookies" />
          <AnalyticsProvider portalName="trainee" />
        </ThemeProvider>
      </body>
    </html>
  );
}
