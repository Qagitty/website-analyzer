import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { CookieBanner } from '@/components/shared/CookieBanner';
import { ConsentAnalytics } from '@/components/shared/ConsentAnalytics';
import { SupportChat } from '@/components/shared/SupportChat';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Website Analyzer — Automatic Site Analysis',
    template: '%s | Website Analyzer',
  },
  description:
    'Automatically analyze your website for performance, accessibility, SEO, and get AI-powered recommendations.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://webanalyzer.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'Website Analyzer',
    title: 'Website Analyzer — Automatic Site Analysis',
    description:
      'Automatically analyze your website for performance, accessibility, SEO, and get AI-powered recommendations.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Website Analyzer — Automatic Site Analysis',
    description:
      'Automatically analyze your website for performance, accessibility, SEO, and get AI-powered recommendations.',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the per-request nonce set by middleware.  Next.js uses this header
  // internally to stamp its own hydration <script> tags, enabling the
  // nonce-based CSP in middleware.ts to work without 'unsafe-inline'.
  // Pass `nonce` to any <Script nonce={nonce}> components added in the future.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <CookieBanner />
          <SupportChat />
          <Toaster richColors position="top-right" />
          <ConsentAnalytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
