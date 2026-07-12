import { NextRequest, NextResponse } from 'next/server';
import { getSdkSource } from '@/lib/error-projects/sdk-source';

export const runtime = 'nodejs';

const SDK_VERSION = '1.0.0';
const sdkBody     = getSdkSource(SDK_VERSION);

export async function GET(_req: NextRequest) {
  return new NextResponse(sdkBody, {
    status: 200,
    headers: {
      'Content-Type':            'application/javascript; charset=utf-8',
      'X-Content-Type-Options':  'nosniff',
      'Cache-Control':           'public, max-age=3600, s-maxage=3600',
      ETag:                      `"ws-err-sdk-${SDK_VERSION}"`,
      'Access-Control-Allow-Origin': '*',
      'X-SDK-Version':           SDK_VERSION,
    },
  });
}
