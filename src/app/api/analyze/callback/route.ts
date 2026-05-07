import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { analyzeWithAI, compareWithDesign } from '@/lib/ai/claude';
import { uploadScreenshot } from '@/lib/supabase/storage';
import { sendScoreDropAlert, sendMonitorSummary } from '@/lib/email/resend';

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
    // Fetch the analysis record to check if design screenshot was uploaded
    const { data: analysisRecord } = await supabase
      .from('analyses')
      .select('design_screenshot_url')
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
        ...(designComparison && { design_comparison: designComparison }),
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

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
