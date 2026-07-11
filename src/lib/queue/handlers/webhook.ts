/**
 * Handler: webhook.deliver
 *
 * Delivers a webhook event payload to a caller-supplied endpoint.
 * Follows the same HMAC signing logic as lib/webhooks/deliver.ts but
 * integrates with the unified retry/DLQ infrastructure.
 *
 * Security: The raw webhook secret is not stored in the job payload.
 * Instead, the webhook row ID is stored and the secret is loaded server-side.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { QueueJobHandler, QueueJobResult } from '../types';
import crypto from 'crypto';

export interface WebhookDeliverPayload {
  webhookId: string;  // DB row ID — secret loaded server-side
  event:     string;
  body:      Record<string, unknown>;
  timestamp: string;
}

export const webhookDeliverHandler: QueueJobHandler<WebhookDeliverPayload> = async (ctx, payload) => {
  const supabase = createServiceRoleClient();

  // Load webhook configuration server-side
  const { data: webhook, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', payload.webhookId)
    .single() as { data: { url: string; secret: string | null; is_active: boolean; user_id: string } | null; error: unknown };

  if (error || !webhook || !webhook.secret) {
    return {
      status: 'failed',
      errorCode: 'WEBHOOK_NOT_FOUND',
      failureType: 'permanent',
    } satisfies QueueJobResult;
  }

  // Validate ownership (tenantId is the user_id)
  if (webhook.user_id !== ctx.tenantId) {
    return {
      status: 'failed',
      errorCode: 'WEBHOOK_OWNERSHIP_MISMATCH',
      failureType: 'permanent',
    } satisfies QueueJobResult;
  }

  if (!webhook.is_active) {
    return {
      status: 'cancelled',
      reasonCode: 'WEBHOOK_INACTIVE',
    } satisfies QueueJobResult;
  }

  // Sign the payload with HMAC-SHA256
  const bodyStr = JSON.stringify(payload.body);
  const sig = crypto
    .createHmac('sha256', webhook.secret)
    .update(bodyStr)
    .digest('hex');

  let response: Response;
  try {
    response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WebAnalyzer-Event':    payload.event,
        'X-WebAnalyzer-Timestamp': payload.timestamp,
        'X-WebAnalyzer-Signature': `sha256=${sig}`,
        'User-Agent': 'WebAnalyzer-Webhook/1.0',
      },
      body: bodyStr,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return {
      status: 'retry',
      errorCode: 'WEBHOOK_NETWORK_ERROR',
      failureType: 'transient',
    } satisfies QueueJobResult;
  }

  if (response.ok) {
    return { status: 'completed' } satisfies QueueJobResult;
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    return {
      status: 'retry',
      errorCode: 'WEBHOOK_RATE_LIMITED',
      failureType: 'rate_limited',
      retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
    } satisfies QueueJobResult;
  }

  if (response.status >= 500) {
    return {
      status: 'retry',
      errorCode: `WEBHOOK_HTTP_${response.status}`,
      failureType: 'transient',
    } satisfies QueueJobResult;
  }

  // 4xx errors (except 429) are permanent — endpoint rejected us
  return {
    status: 'failed',
    errorCode: `WEBHOOK_HTTP_${response.status}`,
    failureType: 'permanent',
  } satisfies QueueJobResult;
};
