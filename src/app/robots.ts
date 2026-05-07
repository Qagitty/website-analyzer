import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://websiteanalyzer.dev';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup'],
        // Keep dashboard, reports, settings, API private
        disallow: ['/dashboard', '/analyze', '/reports', '/settings', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
