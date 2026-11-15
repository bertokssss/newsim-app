import type { Metadata, Viewport } from 'next';
import { League_Spartan, Libre_Baskerville, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, CookieConsentBanner, AnalyticsProvider } from '@newsim/ui';
import { InstructorLayoutShell } from '@/components/InstructorLayoutShell';

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
    { media: '(prefers-color-scheme: dark)', color: '#07070d' },
  ],
};

export const metadata: Metadata = {
  title: 'NEWSIM Instructor Portal | Command & Instruction',
  description: 'Maritime Training Instruction, Grading, and Evaluation Portal',
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
    title: 'NEWSIM Instructor',
  },
};

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${leagueSpartan.variable} ${libreBaskerville.variable} ${inter.variable} light`}>
      <body suppressHydrationWarning className="antialiased font-sans bg-background text-foreground transition-colors duration-200 light">
        <ThemeProvider defaultTheme="light" storageKey="newsim_instructor_theme" enableSystem={false}>
          <InstructorLayoutShell>{children}</InstructorLayoutShell>
          <CookieConsentBanner privacyHref="/privacy" cookiePolicyHref="/privacy#cookies" />
          <AnalyticsProvider portalName="instructor" />
        </ThemeProvider>
      </body>
    </html>
  );
}


