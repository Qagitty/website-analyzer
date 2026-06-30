import type { MetadataRoute } from 'next';
import { isProductionDeployment } from '@/lib/seo/robots';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://webanalyzer.app';

  // Non-production deployments (Vercel preview, staging, dev) must not be indexed.
  if (!isProductionDeployment()) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/analyze/',
        '/reports/',
        '/settings/',
        '/monitors/',
        '/compliance/',
        '/leads/',
        '/login',
        '/signup',
        '/auth/',
        '/forgot-password',
        '/widget/',
        // Note: /share/ is intentionally NOT blocked here.
        // Public reports return index:true via generateMetadata; private ones return noindex.
        // Blocking /share/ in robots.txt would prevent crawlers from reading that noindex directive.
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
