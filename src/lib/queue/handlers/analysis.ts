/**
 * Handler: analysis.run
 *
 * Fires the Cloudflare Worker to analyze a URL.
 * Worker URL and auth token are loaded server-side — never from the job payload.
 *
 * Security: authToken is passed via Authorization header, not in the Worker body.
 */

import type { QueueJobHandler, QueueJobResult } from '../types';
import { deriveNormalizedOrigin, hashOrigin } from '../origin-policy';
import { setOriginCooldown } from '../origin-throttle';

export interface AnalysisRunPayload {
  analysisId: string;
  url:         string;
  callbackUrl: string;
}

export const analysisRunHandler: QueueJobHandler<AnalysisRunPayload> = async (ctx, payload) => {
  const workerUrl    = process.env.CLOUDFLARE_WORKER_URL;
  const authToken    = process.env.CLOUDFLARE_WORKER_AUTH_TOKEN;
  const callbackSecret = process.env.WORKER_CALLBACK_SECRET;

  if (!workerUrl || !authToken || !callbackSecret) {
    return {
      status: 'failed',
      errorCode: 'WORKER_CONFIG_MISSING',
      failureType: 'dependency_unavailable',
    } satisfies QueueJobResult;
  }

  let response: Response;
  try {
    response = await fetch(`${workerUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        analysisId: payload.analysisId,
        url:        payload.url,
        callbackUrl: payload.callbackUrl,
        // callbackSecret is sent in body to authenticate the callback —
        // this is different from authToken which authenticates us to the worker.
        callbackSecret,
      }),
    });
  } catch (err) {
    return {
      status: 'retry',
      errorCode: 'WORKER_UNREACHABLE',
      failureType: 'transient',
    } satisfies QueueJobResult;
  }

  if (response.ok || response.status === 202) {
    return { status: 'completed' } satisfies QueueJobResult;
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    // Set origin cooldown so subsequent jobs for this site back off.
    const origin = deriveNormalizedOrigin(payload.url);
    if (origin) {
      const originHash = await hashOrigin(origin);
      await setOriginCooldown({ originHash, retryAfterHeader: retryAfter }).catch(() => {});
    }
    return {
      status: 'retry',
      errorCode: 'WORKER_RATE_LIMITED',
      failureType: 'rate_limited',
      retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
    } satisfies QueueJobResult;
  }

  if (response.status >= 500) {
    return {
      status: 'retry',
      errorCode: `WORKER_HTTP_${response.status}`,
      failureType: 'transient',
    } satisfies QueueJobResult;
  }

  return {
    status: 'failed',
    errorCode: `WORKER_HTTP_${response.status}`,
    failureType: 'permanent',
  } satisfies QueueJobResult;
};
