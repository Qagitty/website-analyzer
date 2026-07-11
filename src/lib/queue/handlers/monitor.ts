/**
 * Handlers: monitor.run, monitor.page_check, monitor.discovery
 *
 * These replace the direct-dispatch logic in api/cron/monitors/route.ts.
 * The monitor ID/page URL are stored in the payload; secrets are loaded server-side.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { QueueJobHandler, QueueJobResult } from '../types';

// ─── monitor.run ──────────────────────────────────────────────────────────────

export interface MonitorRunPayload {
  monitorId:    string;
  monitorRunId: string;
}

export const monitorRunHandler: QueueJobHandler<MonitorRunPayload> = async (ctx, payload) => {
  const supabase = createServiceRoleClient();

  // Load monitor config server-side — never trust payload for resource ownership
  const { data: monitor, error } = await supabase
    .from('monitors')
    .select('id, user_id, url, page_mode, is_active')
    .eq('id', payload.monitorId)
    .single();

  if (error || !monitor) {
    return {
      status: 'failed',
      errorCode: 'MONITOR_NOT_FOUND',
      failureType: 'permanent',
    } satisfies QueueJobResult;
  }

  if (monitor.user_id !== ctx.tenantId) {
    return {
      status: 'failed',
      errorCode: 'MONITOR_OWNERSHIP_MISMATCH',
      failureType: 'permanent',
    } satisfies QueueJobResult;
  }

  if (!monitor.is_active) {
    return {
      status: 'cancelled',
      reasonCode: 'MONITOR_INACTIVE',
    } satisfies QueueJobResult;
  }

  // Enqueue individual page checks for this monitor run
  const { enqueueJob } = await import('@/lib/queue/service');
  const { QueuePriority } = await import('@/lib/queue/types');
  const { data: pages } = await supabase
    .from('monitor_pages')
    .select('url')
    .eq('monitor_id', payload.monitorId);

  if (!pages || pages.length === 0) {
    // No pages discovered yet — trigger discovery
    await enqueueJob({
      jobType:        'monitor.discovery',
      tenantId:       ctx.tenantId,
      idempotencyKey: `monitor:discovery:${payload.monitorId}:${payload.monitorRunId}`,
      priority:       QueuePriority.NORMAL,
      payload: {
        monitorId:    payload.monitorId,
        monitorRunId: payload.monitorRunId,
        rootUrl:      monitor.url,
      },
    });
  } else {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    for (const page of pages) {
      await enqueueJob({
        jobType:        'monitor.page_check',
        tenantId:       ctx.tenantId,
        idempotencyKey: `monitor:page:${payload.monitorId}:${payload.monitorRunId}:${page.url}`,
        priority:       QueuePriority.NORMAL,
        originHash:     undefined, // dispatcher handles per-origin staggering
        payload: {
          monitorId:    payload.monitorId,
          monitorRunId: payload.monitorRunId,
          url:          page.url,
          callbackUrl:  `${appUrl}/api/analyze/callback`,
        },
      });
    }
  }

  return { status: 'completed' } satisfies QueueJobResult;
};

// ─── monitor.page_check ───────────────────────────────────────────────────────

export interface MonitorPageCheckPayload {
  monitorId:    string;
  monitorRunId: string;
  url:          string;
  callbackUrl:  string;
}

export const monitorPageCheckHandler: QueueJobHandler<MonitorPageCheckPayload> = async (ctx, payload) => {
  const supabase = createServiceRoleClient();
  const { randomUUID } = await import('crypto');

  // Validate monitor ownership
  const { data: monitor } = await supabase
    .from('monitors')
    .select('user_id, is_active')
    .eq('id', payload.monitorId)
    .single();

  if (!monitor || monitor.user_id !== ctx.tenantId || !monitor.is_active) {
    return {
      status: 'cancelled',
      reasonCode: 'MONITOR_INACTIVE_OR_MISSING',
    } satisfies QueueJobResult;
  }

  // Create analysis record
  const analysisId = randomUUID();
  const { error: insertError } = await supabase
    .from('analyses')
    .insert({
      id:         analysisId,
      user_id:    ctx.tenantId,
      url:        payload.url,
      status:     'queued',
      created_at: new Date().toISOString(),
    });

  if (insertError) {
    return {
      status: 'retry',
      errorCode: 'DB_INSERT_FAILED',
      failureType: 'transient',
    } satisfies QueueJobResult;
  }

  // Dispatch to Cloudflare Worker
  const workerUrl   = process.env.CLOUDFLARE_WORKER_URL;
  const authToken   = process.env.CLOUDFLARE_WORKER_AUTH_TOKEN;
  const callbackSecret = process.env.WORKER_CALLBACK_SECRET;

  if (!workerUrl || !authToken || !callbackSecret) {
    return {
      status: 'failed',
      errorCode: 'WORKER_CONFIG_MISSING',
      failureType: 'dependency_unavailable',
    } satisfies QueueJobResult;
  }

  try {
    const res = await fetch(`${workerUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        analysisId,
        url:          payload.url,
        callbackUrl:  payload.callbackUrl,
        callbackSecret,
        monitorId:    payload.monitorId,
        monitorRunId: payload.monitorRunId,
      }),
    });

    if (res.ok || res.status === 202) {
      return { status: 'completed' } satisfies QueueJobResult;
    }

    if (res.status >= 500) {
      return {
        status: 'retry',
        errorCode: `WORKER_HTTP_${res.status}`,
        failureType: 'transient',
      } satisfies QueueJobResult;
    }

    return {
      status: 'failed',
      errorCode: `WORKER_HTTP_${res.status}`,
      failureType: 'permanent',
    } satisfies QueueJobResult;
  } catch {
    return {
      status: 'retry',
      errorCode: 'WORKER_UNREACHABLE',
      failureType: 'transient',
    } satisfies QueueJobResult;
  }
};

// ─── monitor.discovery ────────────────────────────────────────────────────────

export interface MonitorDiscoveryPayload {
  monitorId:    string;
  monitorRunId: string;
  rootUrl:      string;
}

export const monitorDiscoveryHandler: QueueJobHandler<MonitorDiscoveryPayload> = async (ctx, payload) => {
  const supabase = createServiceRoleClient();

  const { data: monitor } = await supabase
    .from('monitors')
    .select('user_id, is_active, page_mode')
    .eq('id', payload.monitorId)
    .single();

  if (!monitor || monitor.user_id !== ctx.tenantId || !monitor.is_active) {
    return {
      status: 'cancelled',
      reasonCode: 'MONITOR_INACTIVE_OR_MISSING',
    } satisfies QueueJobResult;
  }

  try {
    const { discoverPages } = await import('@/lib/monitoring/discovery');
    const result = await discoverPages(payload.rootUrl, {
      strategy: 'both',
      maxPages:  50,
    });
    const discovered = result.pages;

    // Upsert discovered pages
    for (const page of discovered) {
      await supabase.from('monitor_pages').upsert(
        {
          monitor_id:       payload.monitorId,
          url:              page.url,
          importance_score: page.importanceScore ?? 0,
        },
        { onConflict: 'monitor_id,url' },
      );
    }

    return { status: 'completed' } satisfies QueueJobResult;
  } catch {
    return {
      status: 'retry',
      errorCode: 'DISCOVERY_FAILED',
      failureType: 'transient',
    } satisfies QueueJobResult;
  }
};
