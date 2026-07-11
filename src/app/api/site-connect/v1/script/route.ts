/**
 * GET /api/site-connect/v1/script
 *
 * Serves the WebScore connection script.
 * Rewritten from /site-connect/v1/webscore-connect.min.js via next.config.js.
 *
 * Cache strategy:
 *  - CDN: public, stale-while-revalidate (SWR) 5 min, max-age 1 min
 *  - Script versioning is tied to SCRIPT_VERSION constant — bump it to
 *    force a cache bust (customers' browsers will see the new version within 1 min).
 *
 * Security:
 *  - X-Content-Type-Options: nosniff prevents MIME sniffing
 *  - CORS: wide open (public script, needs to load from any origin)
 *  - Subresource integrity: callers may add integrity= attribute
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildScript, SCRIPT_VERSION } from '@/lib/site-connect/script-source';

export const runtime = 'nodejs';

const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.example.com';
const INGESTION_URL = `${APP_URL}/api/site-connect/events`;

const SCRIPT_CONTENT = buildScript({ ingestionEndpoint: INGESTION_URL });

export function GET(_req: NextRequest) {
  return new NextResponse(SCRIPT_CONTENT, {
    status: 200,
    headers: {
      'Content-Type':           'application/javascript; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control':          'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
      'ETag':                   `"webscore-connect-${SCRIPT_VERSION}"`,
      'X-Script-Version':       SCRIPT_VERSION,
    },
  });
}
