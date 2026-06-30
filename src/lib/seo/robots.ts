import type { Metadata } from 'next';

/** Public marketing pages — allow indexing and link following. */
export const INDEX_FOLLOW_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
};

/** Private/authenticated pages — noindex but still follow links. */
export const NOINDEX_FOLLOW_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
};

/** Fully blocked pages — noindex and nofollow. */
export const NOINDEX_NOFOLLOW_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

/**
 * Returns true only when running on the production Vercel deployment.
 * Vercel preview deployments run NODE_ENV=production but VERCEL_ENV=preview,
 * so NODE_ENV alone is not a reliable signal.
 */
export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production';
}
