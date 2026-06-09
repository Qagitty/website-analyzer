const { withSentryConfig } = require("@sentry/nextjs");

// Content-Security-Policy is now set dynamically in src/middleware.ts so that
// a unique nonce can be embedded per request, eliminating 'unsafe-inline' from
// script-src.  Only the static, non-nonce security headers live here.

/** @type {import('next').NextConfig} */
const nextConfig = {
  // instrumentationHook no longer needed in Next.js 15+ (instrumentation.js enabled by default)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP omitted here — middleware sets it dynamically with a per-request nonce.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin

  org: "maxlag",
  project: "website-analyzer",

  // Only print logs for uploading source maps.
  silent: true,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Transpiles SDK to be compatible with IE11 (increases bundle size)
  transpileClientSDK: true,

  // Routes browser requests to Sentry through a same-origin proxy, so your calls won't be blocked by CORS.
  // Leave this commented out if you do not have a same-origin proxy set up.
  // tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,
});
