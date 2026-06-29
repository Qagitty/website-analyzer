import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { analyzeWithAI, compareWithDesign } from '@/lib/ai/claude';
import { uploadScreenshot, getSignedUrlOrNull } from '@/lib/supabase/storage';
import { sendScoreDropAlert, sendMonitorSummary, sendAnalysisComplete, sendAnalysisFailed } from '@/lib/email/resend';
import { fireWebhooksForAnalysis } from '@/lib/webhooks/deliver';
import * as Sentry from '@sentry/nextjs';
import { LegacyWorkerCallbackSchema, type LegacyWorkerCallback } from '@/lib/contracts/schemas';
import { verifyCallbackSignature } from '@/lib/contracts/callback-auth';
import { validateDbLighthouseScores, detectLighthouseSchemaVersion } from '@/lib/contracts/db-validation';

// ── Score integrity helpers (§18, §19) ───────────────────────────────────────

/** Clamps a single score to [0, 100] or returns null when input is null/undefined. */
function clampScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

/**
 * Validates and clamps all numeric scores in a lighthouse_scores blob.
 * Logs a warning for each out-of-range value. Returns the sanitised object.
 * This runs before any storage write so no invalid scores ever reach the DB.
 */
function sanitiseLighthouseScores(
  raw: Record<string, unknown> | null | undefined,
  analysisId: string,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return raw ?? null;

  const SCORE_KEYS = ['performance', 'accessibility', 'seo', 'bestPractices', 'llmReadiness'];
  const sanitised: Record<string, unknown> = { ...raw };

  for (const key of SCORE_KEYS) {
    if (key in sanitised) {
      const original = sanitised[key];
      const clamped = clampScore(original);
      if (original !== null && original !== undefined && original !== clamped) {
        console.warn(
          `[callback][${analysisId}] Score out of range: ${key}=${original} → clamped to ${clamped}`,
        );
      }
      sanitised[key] = clamped;
    }
  }
  return sanitised;
}

/**
 * Logs the scoreVersion of each category result for reproduction tracing (§19).
 * Called before storing results so the audit trail is written even if storage fails.
 */
function logScoreVersions(lighthouseScores: Record<string, unknown> | null, analysisId: string): void {
  if (!lighthouseScores) return;
  const VERSION_KEYS = [
    ['scoreVersion',             'performance'],
    ['seoAudit.scoreVersion',    'seo'],
    ['accessibilityAudit.version', 'accessibility'],
    ['bestPracticesAudit.scoreVersion', 'best-practices'],
    ['llmReadinessAudit.scoreVersion',  'llm-readiness'],
  ] as const;
  for (const [path, category] of VERSION_KEYS) {
    const parts = path.split('.');
    let val: unknown = lighthouseScores;
    for (const p of parts) {
      val = (val as Record<string, unknown>)?.[p];
    }
    if (val) {
      console.info(`[callback][${analysisId}] scoreVersion ${category}=${val}`);
    }
  }
}

export async function POST(req: NextRequest) {
  // F6 — fail fast if secret is not configured: both Bearer and HMAC would degrade
  // to trivially bypassable values ("Bearer undefined" / empty HMAC key).
  const callbackSecret = process.env.WORKER_CALLBACK_SECRET;
  if (!callbackSecret) {
    console.error('[callback] FATAL: WORKER_CALLBACK_SECRET not set — rejecting all callbacks');
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 503 });
  }

  // §6 — Layer 1: Bearer token check (required for all callbacks)
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${callbackSecret}`) {
    console.warn('[callback] Unauthorized — invalid Bearer token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // §32 — Guard against oversized payloads from a buggy or compromised worker.
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  // §9 — Layer 2: HMAC signature check (opt-in; required for v2 Workers).
  // Legacy Workers that don't send X-Callback-Signature pass through automatically.
  const rawBody = await req.text();
  const hmacResult = verifyCallbackSignature(
    rawBody,
    callbackSecret,
    req.headers,
  );
  if (!hmacResult.valid) {
    console.warn('[callback] Rejected — HMAC verification failed:', hmacResult.reason);
    return NextResponse.json(
      { error: 'Callback signature invalid', reason: hmacResult.reason },
      { status: 401 },
    );
  }

  // §6 — Parse and validate the callback body at the trust boundary
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // §8 — Accept both v2 (WorkerCallbackEnvelope) and v1 (legacy flat payload).
  // Detect v2 by the presence of schemaVersion on the envelope.
  const isV2Callback = rawParsed &&
    typeof rawParsed === 'object' &&
    (rawParsed as Record<string, unknown>).schemaVersion === 'worker-callback-v2';

  // §6 — Validate legacy v1 payload shape at the trust boundary
  let rawBody2: LegacyWorkerCallback;
  if (isV2Callback) {
    // v2: the actual result payload is inside .payload; analysisId is on the envelope
    const envelope = rawParsed as Record<string, unknown>;
    const innerPayload = (envelope.payload ?? {}) as Record<string, unknown>;
    rawBody2 = { ...innerPayload, analysisId: String(envelope.analysisId) } as LegacyWorkerCallback;
    console.info(`[callback] v2 envelope received: resultType=${envelope.resultType}, analysisId=${envelope.analysisId}`);
  } else {
    const parsed = LegacyWorkerCallbackSchema.safeParse(rawParsed);
    if (!parsed.success) {
      console.warn('[callback] v1 schema validation failed:', parsed.error.issues[0]?.message);
      return NextResponse.json(
        { error: 'Invalid callback payload', detail: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    }
    rawBody2 = parsed.data;
  }

  const supabase = createServiceRoleClient();

  // Extract named fields with proper types; the rest are stored in `results`.
  const analysisId   = rawBody2.analysisId;
  const workerError  = rawBody2.error;
  const crawledPages = rawBody2.crawledPages as unknown[] | null | undefined;
  const crawlCoverage= rawBody2.crawlCoverage as Record<string, unknown> | null | undefined;
  const monitorId    = rawBody2.monitorId;
  const monitorUserId= rawBody2.monitorUserId;
  const monitorLastScores = rawBody2.monitorLastScores as Record<string, number | null> | null | undefined;
  const monitorNotify     = rawBody2.monitorNotify;
  const monitorThreshold  = rawBody2.monitorThreshold;

  // `results` carries the remaining payload fields (screenshot, scores, errors, etc.).
  // Cast to LegacyWorkerCallback so named fields retain their Zod-inferred types.
  const results = rawBody2 as LegacyWorkerCallback;

  if (workerError) {
    const { data: failedRecord } = await supabase
      .from('analyses')
      .update({
        status: 'failed',
        error_message: workerError,
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId)
      .select('user_id')
      .single();

    // Refund the credit — the worker failed before producing a usable result
    if (failedRecord?.user_id) {
      await supabase.rpc('refund_credit', { p_user_id: failedRecord.user_id });

      try {
        const [{ data: userSettings }, { data: userData }] = await Promise.all([
          supabase.from('user_settings').select('notifications').eq('user_id', failedRecord.user_id).single(),
          supabase.auth.admin.getUserById(failedRecord.user_id),
        ]);
        const prefs = userSettings?.notifications as any;
        const userEmail = userData?.user?.email;
        if (userEmail && prefs?.email_on_fail !== false) {
          sendAnalysisFailed({
            to: userEmail,
            url: results.url ?? analysisId,
            analysisId,
          }).catch(() => {});
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ received: true });
  }

  try {
    // Fetch the analysis record — also serves as the idempotency check.
    // If the analysis is already completed or failed (e.g. a worker retry), skip
    // all processing to prevent duplicate webhooks, emails, and AI calls.
    const { data: analysisRecord } = await supabase
      .from('analyses')
      .select('status, design_screenshot_url, user_id, url')
      .eq('id', analysisId)
      .single();

    if (!analysisRecord) {
      return NextResponse.json({ received: true, status: 'not_found' });
    }

    if (['completed', 'failed', 'cancelled'].includes(analysisRecord.status)) {
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    // Mark as running and record when processing actually started.
    // started_at was never populated before — now it reflects the moment
    // the callback begins AI analysis, giving accurate duration metrics.
    await supabase
      .from('analyses')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', analysisId);

    let screenshotUrl: string | null = null;
    if (results.screenshotBase64) {
      try {
        const buffer = Buffer.from(results.screenshotBase64, 'base64');
        screenshotUrl = await uploadScreenshot(supabase, analysisId, buffer);
      } catch (uploadErr) {
        console.error('Screenshot upload failed (non-fatal):', uploadErr);
      }
    }

    // §6/§24: validate and clamp all scores at the trust boundary before any storage write.
    // validateDbLighthouseScores handles clamping, schema version detection, and logging.
    if (results.lighthouseScores) {
      const validated = validateDbLighthouseScores(results.lighthouseScores, analysisId);
      logScoreVersions(validated as Record<string, unknown> | null, analysisId);
      const schemaVersion = detectLighthouseSchemaVersion(results.lighthouseScores);
      console.info(`[callback][${analysisId}] Worker payload schema: ${schemaVersion}`);
      // Replace the raw scores with the validated/clamped version for all downstream use.
      (results as Record<string, unknown>).lighthouseScores = validated;
    }

    // Run AI analysis and (optionally) design comparison in parallel.
    // Design screenshot is stored as a path in a PRIVATE bucket — generate a
    // short-lived signed URL so runDesignComparison can fetch it over HTTPS.
    const designStoragePath: string | null = (analysisRecord as any)?.design_screenshot_url ?? null;
    const designSignedUrl = designStoragePath
      ? await getSignedUrlOrNull(supabase, designStoragePath, 300) // 5-min TTL is enough
      : null;

    const aiInsightsPromise = analyzeWithAI({
      screenshotBase64: results.screenshotBase64 ?? null,
      lighthouseScores: results.lighthouseScores,
      consoleErrors: (results.consoleErrors ?? []) as any[],
      accessibilityIssues: (results.accessibilityIssues ?? []) as any[],
      networkSummary: results.networkSummary,
    });

    // Run design comparison only when we have both a design upload and a live screenshot
    const designComparisonPromise =
      designSignedUrl && results.screenshotBase64
        ? runDesignComparison(designSignedUrl, results.screenshotBase64)
        : Promise.resolve(null);

    const [aiInsights, designComparison] = await Promise.all([
      aiInsightsPromise,
      designComparisonPromise,
    ]);

    // Only save design_comparison if Claude returned a well-formed result
    const validDesignComparison =
      designComparison &&
      typeof designComparison.fidelityScore === 'number' &&
      Array.isArray(designComparison.mismatches)
        ? designComparison
        : null;

    await supabase
      .from('analyses')
      .update({
        status: 'completed',
        screenshot_url: screenshotUrl,
        lighthouse_scores: results.lighthouseScores
          ? { ...results.lighthouseScores, crawlCoverage: crawlCoverage ?? null }
          : results.lighthouseScores,
        console_errors: results.consoleErrors,
        accessibility_issues: results.accessibilityIssues,
        network_requests: results.networkSummary,
        ai_insights: aiInsights,
        ai_summary: aiInsights.summary,
        crawl_pages: crawledPages ?? null,
        ...(validDesignComparison && { design_comparison: validDesignComparison }),
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    // ── Webhook delivery ─────────────────────────────────────────────────
    if (analysisRecord?.user_id) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      const siteUrl = (analysisRecord as any).url ?? (results.url ?? analysisId);
      fireWebhooksForAnalysis(supabase, (analysisRecord as any).user_id, {
        event: 'analysis.completed',
        analysisId,
        url: siteUrl,
        scores: results.lighthouseScores
          ? {
              performance: (results.lighthouseScores.performance as number | null) ?? 0,
              accessibility: (results.lighthouseScores.accessibility as number | null) ?? 0,
              seo: (results.lighthouseScores.seo as number | null) ?? 0,
              bestPractices: (results.lighthouseScores.bestPractices as number | null) ?? 0,
            }
          : undefined,
        reportUrl: `${appUrl}/reports/${analysisId}`,
        timestamp: new Date().toISOString(),
      }).catch((e) => console.error('[callback] webhook delivery failed:', e));
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Manual analysis completion email ────────────────────────────────
    // Only for non-monitor runs — monitor emails are handled below separately
    if (!monitorId && analysisRecord?.user_id) {
      try {
        const [{ data: userSettings }, { data: userData }] = await Promise.all([
          supabase.from('user_settings').select('notifications').eq('user_id', analysisRecord.user_id).single(),
          supabase.auth.admin.getUserById(analysisRecord.user_id),
        ]);
        const prefs = userSettings?.notifications as any;
        const userEmail = userData?.user?.email;
        if (userEmail && prefs?.email_on_complete !== false) {
          sendAnalysisComplete({
            to: userEmail,
            url: (analysisRecord as any).url,
            analysisId,
            scores: results.lighthouseScores as Record<string, number> | null ?? null,
          }).catch((e) => console.error('[callback] completion email failed:', e));
        }
      } catch (e) {
        console.error('[callback] failed to resolve user email for completion notification:', e);
      }
    }
    // ────────────────────────────────────────────────────────────────────

    // ── Monitor post-processing ──────────────────────────────────────────
    if (monitorId && results.lighthouseScores) {
      const newScores = results.lighthouseScores as Record<string, number | null | undefined>;

      // Update monitor with latest scores
      await supabase.from('monitors')
        .update({ last_scores: newScores, last_analysis_id: analysisId })
        .eq('id', monitorId);

      // Check for score drops and send alert.
      // Resolve email from DB here — it is intentionally not passed through
      // the Worker body to avoid sending PII over Cloudflare infrastructure.
      if (monitorNotify && monitorLastScores && monitorUserId) {
        const { data: userData } = await supabase.auth.admin.getUserById(monitorUserId);
        const resolvedEmail = userData?.user?.email;

        if (resolvedEmail) {
          const SCORE_KEYS = ['performance', 'accessibility', 'seo', 'bestPractices'] as const;
          const drops = SCORE_KEYS
            .map((key) => {
              const prev = (monitorLastScores[key] as number | null | undefined) ?? 0;
              const curr = (newScores[key] as number | null | undefined) ?? 0;
              const delta = prev - curr;
              return { metric: key, previous: prev, current: curr, delta };
            })
            .filter((d) => d.delta >= (monitorThreshold ?? 10));

          if (drops.length > 0) {
            sendScoreDropAlert({
              to: resolvedEmail,
              url: results.url ?? analysisId,
              analysisId,
              drops,
            }).catch((e) => console.error('[callback] score drop email failed:', e));
          } else {
            // Send regular completion summary
            sendMonitorSummary({
              to: resolvedEmail,
              url: results.url ?? analysisId,
              analysisId,
              scores: newScores as Record<string, number>,
            }).catch((e) => console.error('[callback] summary email failed:', e));
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    return NextResponse.json({ received: true, status: 'completed' });
  } catch (err) {
    console.error('Callback processing error:', err);
    Sentry.captureException(err);

    const { data: failedRecord } = await supabase
      .from('analyses')
      .update({
        status: 'failed',
        error_message: 'Failed to process analysis results',
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId)
      .select('user_id')
      .single();

    // Refund the credit — server-side failure, user shouldn't be penalized
    if (failedRecord?.user_id) {
      await supabase.rpc('refund_credit', { p_user_id: failedRecord.user_id });

      try {
        const [{ data: userSettings }, { data: userData }] = await Promise.all([
          supabase.from('user_settings').select('notifications').eq('user_id', failedRecord.user_id).single(),
          supabase.auth.admin.getUserById(failedRecord.user_id),
        ]);
        const prefs = userSettings?.notifications as any;
        const userEmail = userData?.user?.email;
        if (userEmail && prefs?.email_on_fail !== false) {
          sendAnalysisFailed({
            to: userEmail,
            url: results.url ?? analysisId,
            analysisId,
          }).catch(() => {});
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ received: true, status: 'failed' });
  }
}

/**
 * Downloads the design screenshot from storage, then runs the Claude Vision comparison.
 */
async function runDesignComparison(
  designScreenshotUrl: string,
  liveScreenshotBase64: string
): Promise<any> {
  try {
    const res = await fetch(designScreenshotUrl);
    if (!res.ok) {
      console.error('[callback] Failed to fetch design screenshot:', res.status);
      return null;
    }

    const contentType = res.headers.get('content-type') ?? 'image/png';
    const arrayBuffer = await res.arrayBuffer();
    const designBase64 = Buffer.from(arrayBuffer).toString('base64');

    return await compareWithDesign(designBase64, contentType, liveScreenshotBase64);
  } catch (err) {
    console.error('[callback] Design comparison failed (non-fatal):', err);
    return null;
  }
}
