import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { analyzeWithAI, compareWithDesign } from '@/lib/ai/claude';
import { uploadScreenshot, getSignedUrlOrNull } from '@/lib/supabase/storage';
import { sendScoreDropAlert, sendMonitorSummary, sendAnalysisComplete, sendAnalysisFailed } from '@/lib/email/resend';
import { fireWebhooksForAnalysis } from '@/lib/webhooks/deliver';
import * as Sentry from '@sentry/nextjs';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.WORKER_CALLBACK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Guard against oversized payloads from a buggy or compromised worker.
  // A full-page screenshot is ~2-4 MB as base64; 20 MB gives ample headroom.
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const supabase = createServiceRoleClient();
  const body = await req.json();
  const {
    analysisId,
    error: workerError,
    // Multi-page crawl results
    crawledPages,
    // Monitor context (present only for scheduled runs).
    // NOTE: monitorUserEmail is intentionally absent — we look it up from the
    // DB here so user emails never travel through Cloudflare Worker bodies.
    monitorId,
    monitorUserId,
    monitorLastScores,
    monitorNotify,
    monitorThreshold,
    ...results
  } = body;

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
            url: body.url ?? analysisId,
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

    if (analysisRecord.status === 'completed' || analysisRecord.status === 'failed') {
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

    // Run AI analysis and (optionally) design comparison in parallel.
    // Design screenshot is stored as a path in a PRIVATE bucket — generate a
    // short-lived signed URL so runDesignComparison can fetch it over HTTPS.
    const designStoragePath: string | null = (analysisRecord as any)?.design_screenshot_url ?? null;
    const designSignedUrl = designStoragePath
      ? await getSignedUrlOrNull(supabase, designStoragePath, 300) // 5-min TTL is enough
      : null;

    const aiInsightsPromise = analyzeWithAI({
      screenshotBase64: results.screenshotBase64,
      lighthouseScores: results.lighthouseScores,
      consoleErrors: results.consoleErrors,
      accessibilityIssues: results.accessibilityIssues,
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
        lighthouse_scores: results.lighthouseScores,
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
              performance: results.lighthouseScores.performance ?? 0,
              accessibility: results.lighthouseScores.accessibility ?? 0,
              seo: results.lighthouseScores.seo ?? 0,
              bestPractices: results.lighthouseScores.bestPractices ?? 0,
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
            scores: results.lighthouseScores ?? null,
          }).catch((e) => console.error('[callback] completion email failed:', e));
        }
      } catch (e) {
        console.error('[callback] failed to resolve user email for completion notification:', e);
      }
    }
    // ────────────────────────────────────────────────────────────────────

    // ── Monitor post-processing ──────────────────────────────────────────
    if (monitorId && results.lighthouseScores) {
      const newScores = results.lighthouseScores;

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
              const prev = monitorLastScores[key] ?? 0;
              const curr = newScores[key] ?? 0;
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
              scores: newScores,
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
            url: (analysisRecord as any)?.url ?? analysisId,
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
