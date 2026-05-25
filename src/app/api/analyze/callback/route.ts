import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { analyzeWithAI, compareWithDesign } from '@/lib/ai/claude';
import { uploadScreenshot } from '@/lib/supabase/storage';
import { sendScoreDropAlert, sendMonitorSummary } from '@/lib/email/resend';
import { fireWebhooksForAnalysis } from '@/lib/webhooks/deliver';
import * as Sentry from '@sentry/nextjs';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.WORKER_CALLBACK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const body = await req.json();
  const {
    analysisId,
    error: workerError,
    // Multi-page crawl results
    crawledPages,
    // Monitor context (present only for scheduled runs)
    monitorId,
    monitorUserId,
    monitorUserEmail,
    monitorLastScores,
    monitorNotify,
    monitorThreshold,
    ...results
  } = body;

  if (workerError) {
    await supabase
      .from('analyses')
      .update({
        status: 'failed',
        error_message: workerError,
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    return NextResponse.json({ received: true });
  }

  try {
    // Fetch the analysis record to get design screenshot URL, user ID, and URL for webhooks
    const { data: analysisRecord } = await (supabase as any)
      .from('analyses')
      .select('design_screenshot_url, user_id, url')
      .eq('id', analysisId)
      .single();

    let screenshotUrl: string | null = null;
    if (results.screenshotBase64) {
      try {
        const buffer = Buffer.from(results.screenshotBase64, 'base64');
        screenshotUrl = await uploadScreenshot(supabase, analysisId, buffer);
      } catch (uploadErr) {
        console.error('Screenshot upload failed (non-fatal):', uploadErr);
      }
    }

    // Run AI analysis and (optionally) design comparison in parallel
    const designScreenshotUrl: string | null = (analysisRecord as any)?.design_screenshot_url ?? null;

    const aiInsightsPromise = analyzeWithAI({
      screenshotBase64: results.screenshotBase64,
      lighthouseScores: results.lighthouseScores,
      consoleErrors: results.consoleErrors,
      accessibilityIssues: results.accessibilityIssues,
      networkSummary: results.networkSummary,
    });

    // Run design comparison only when we have both a design upload and a live screenshot
    const designComparisonPromise =
      designScreenshotUrl && results.screenshotBase64
        ? runDesignComparison(designScreenshotUrl, results.screenshotBase64)
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

    await (supabase as any)
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

    // ── Monitor post-processing ──────────────────────────────────────────
    if (monitorId && results.lighthouseScores) {
      const newScores = results.lighthouseScores;

      // Update monitor with latest scores
      await (supabase as any).from('monitors')
        .update({ last_scores: newScores, last_analysis_id: analysisId })
        .eq('id', monitorId);

      // Check for score drops and send alert
      if (monitorNotify && monitorLastScores && monitorUserEmail) {
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
            to: monitorUserEmail,
            url: results.url ?? analysisId,
            analysisId,
            drops,
          }).catch((e) => console.error('[callback] score drop email failed:', e));
        } else {
          // Send regular completion summary
          sendMonitorSummary({
            to: monitorUserEmail,
            url: results.url ?? analysisId,
            analysisId,
            scores: newScores,
          }).catch((e) => console.error('[callback] summary email failed:', e));
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    return NextResponse.json({ received: true, status: 'completed' });
  } catch (err) {
    console.error('Callback processing error:', err);
    Sentry.captureException(err);
    await supabase
      .from('analyses')
      .update({
        status: 'failed',
        error_message: 'Failed to process analysis results',
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

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
