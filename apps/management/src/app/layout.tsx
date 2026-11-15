import type { Metadata, Viewport } from 'next';
import { League_Spartan, Libre_Baskerville, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, CookieConsentBanner, AnalyticsProvider } from '@newsim/ui';

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
    { media: '(prefers-color-scheme: light)', color: '#F7F9FC' },
    { media: '(prefers-color-scheme: dark)', color: '#07111C' },
  ],
};

export const metadata: Metadata = {
  title: 'NEWSIM Management Portal | Executive & Operational Command',
  description: 'Enterprise Maritime Training Management & Executive Administration System',
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
    title: 'NEWSIM Admin',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${leagueSpartan.variable} ${libreBaskerville.variable} ${inter.variable} light`}>
      <body suppressHydrationWarning className="antialiased font-sans bg-background text-foreground transition-colors duration-200 light">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          storageKey="newsim_mgmt_theme"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <CookieConsentBanner privacyHref="/privacy" cookiePolicyHref="/privacy#cookies" />
          <AnalyticsProvider portalName="management" />
        </ThemeProvider>
      </body>
    </html>
  );
}
