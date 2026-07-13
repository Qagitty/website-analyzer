/**
 * Queue handlers for the accessibility workflow.
 *
 * accessibility.assessment.page    — Process one page's axe findings into findings table
 * accessibility.assessment.finalize — Finalize assessment status after all pages complete
 * accessibility.regression.check   — Detect regressions vs prior completed assessment
 * accessibility.alert.evaluate     — Evaluate risk increase alerts
 * accessibility.statement.generate — Generate a statement draft
 */

import { createServiceRoleClient as _createServiceRoleClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createServiceRoleClient(): any {
  return _createServiceRoleClient();
}
import {
  calculateFindingFingerprint,
  normalizePageUrl,
  normalizeSelector,
  sanitizeHtmlExcerpt,
} from '@/lib/accessibility/fingerprint';
import { calculateCoverage } from '@/lib/accessibility/coverage';
import type { QueueJobHandler, QueueJobResult } from '../types';

// ─── assessment.start ────────────────────────────────────────────────────────

export const handleAccessibilityAssessmentStart: QueueJobHandler<{ assessmentId: string }> =
  async (_ctx, payload) => {
    // The assessment is already created by the API route.
    // This handler triggers page-level jobs for each pending page.
    const supabase = createServiceRoleClient();
    const { data: pages } = await supabase
      .from('accessibility_assessment_pages')
      .select('id, analysis_id')
      .eq('assessment_id', payload.assessmentId)
      .eq('status', 'pending');

    if (!pages || pages.length === 0) {
      // No pages — finalize immediately
      await handleAccessibilityAssessmentFinalize(_ctx, payload);
      return { status: 'completed' };
    }

    // For pages that already have an analysis_id, enqueue page processing
    // (In production these would trigger real Cloudflare Worker analyses first)
    for (const page of pages) {
      if (page.analysis_id) {
        // Enqueue accessibility.assessment.page job via service
        // Deferred: queue service import would create circular dep — use direct DB update
        await supabase
          .from('accessibility_assessment_pages')
          .update({ status: 'pending' })
          .eq('id', page.id);
      }
    }

    return { status: 'completed' };
  };

// ─── assessment.page ─────────────────────────────────────────────────────────

export interface AccessibilityAssessmentPagePayload {
  assessmentId:     string;
  assessmentPageId: string;
  analysisId:       string;
}

export const handleAccessibilityAssessmentPage: QueueJobHandler<AccessibilityAssessmentPagePayload> =
  async (_ctx, payload) => {
    const supabase = createServiceRoleClient();

    // Load the analysis record for this page
    const { data: analysis, error: analysisErr } = await supabase
      .from('analyses')
      .select('accessibility_issues, url, user_id')
      .eq('id', payload.analysisId)
      .single();

    if (analysisErr || !analysis) {
      return {
        status: 'failed',
        errorCode:   'ANALYSIS_NOT_FOUND',
        failureType: 'permanent',
      };
    }

    // Load assessment for profile_id
    const { data: assessment, error: assessmentErr } = await supabase
      .from('accessibility_assessments')
      .select('profile_id')
      .eq('id', payload.assessmentId)
      .single();

    if (assessmentErr || !assessment) {
      return {
        status: 'failed',
        errorCode:   'ASSESSMENT_NOT_FOUND',
        failureType: 'permanent',
      };
    }

    // Mark page as running
    await supabase
      .from('accessibility_assessment_pages')
      .update({
        status:     'running',
        started_at: new Date().toISOString(),
        analysis_id: payload.analysisId,
      })
      .eq('id', payload.assessmentPageId);

    const rawIssues: unknown[] = Array.isArray(analysis.accessibility_issues)
      ? (analysis.accessibility_issues as unknown[])
      : [];

    let findingsCount   = 0;
    let criticalCount   = 0;

    for (const rawIssue of rawIssues) {
      const issue = rawIssue as Record<string, unknown>;
      if (!issue?.id || !issue?.impact) continue;

      const nodes = Array.isArray(issue.nodes) ? (issue.nodes as Record<string, unknown>[]) : [];
      const firstNode = nodes[0];

      const rawTarget = firstNode?.target;
      const rawSelector = Array.isArray(rawTarget) ? rawTarget.map(String).join(', ') : '';
      const selector    = normalizeSelector(rawSelector);
      const htmlExcerpt = firstNode?.html ? sanitizeHtmlExcerpt(String(firstNode.html)) : '';

      const pageUrl      = String(analysis.url ?? '');
      const normalizedUrl = normalizePageUrl(pageUrl);

      const tags: string[] = Array.isArray(issue.tags) ? (issue.tags as string[]) : [];
      const wcagCriteria = tags.filter((t) => /^wcag\d|^best-practice/.test(t));
      const wcagLevel: 'A' | 'AA' | 'AAA' = wcagCriteria.some((t) => t.includes('aaa'))
        ? 'AAA'
        : wcagCriteria.some((t) => t.includes('aa'))
        ? 'AA'
        : 'A';

      const pour = derivePour(wcagCriteria);
      const impact = String(issue.impact) as 'critical' | 'serious' | 'moderate' | 'minor';

      const fingerprint = calculateFindingFingerprint({
        profileId:          assessment.profile_id,
        normalizedPageUrl:  normalizedUrl,
        ruleId:             String(issue.id),
        normalizedSelector: selector,
      });

      if (impact === 'critical' || impact === 'serious') criticalCount++;
      findingsCount++;

      const now = new Date().toISOString();

      // Upsert: update last_seen_at on conflict; preserve status for existing findings
      await supabase
        .from('accessibility_findings')
        .upsert(
          {
            assessment_id:          payload.assessmentId,
            profile_id:             assessment.profile_id,
            page_id:                payload.assessmentPageId,
            // Legacy required fields from 029
            user_id:                analysis.user_id,
            finding_key:            fingerprint,
            page_url:               pageUrl,
            rule_id:                String(issue.id),
            title:                  String(issue.description ?? issue.id),
            description:            String(issue.description ?? issue.id),
            severity:               impact,
            wcag_criteria:          wcagCriteria,
            is_critical_journey:    false,
            // New sprint-17 fields
            impact,
            selector,
            html_excerpt:           htmlExcerpt,
            wcag_level:             wcagLevel,
            pour_principle:         pour,
            automated:              true,
            jurisdiction_relevance: {},
            fingerprint,
            status:                 'open',
            first_seen_at:          now,
            last_seen_at:           now,
          },
          {
            onConflict:      'profile_id,finding_key',
            ignoreDuplicates: false,
          },
        );
    }

    // Mark page completed
    await supabase
      .from('accessibility_assessment_pages')
      .update({
        status:                    'completed',
        completed_at:              new Date().toISOString(),
        automated_findings_count:  findingsCount,
        critical_findings_count:   criticalCount,
        finding_count:             findingsCount,
        critical_count:            criticalCount,
      })
      .eq('id', payload.assessmentPageId);

    // Check if all pages in this assessment are done
    await maybeFinalize(supabase, payload.assessmentId);

    return { status: 'completed' };
  };

// ─── assessment.finalize ─────────────────────────────────────────────────────

export interface AccessibilityAssessmentFinalizePayload {
  assessmentId: string;
}

export const handleAccessibilityAssessmentFinalize: QueueJobHandler<AccessibilityAssessmentFinalizePayload> =
  async (_ctx, payload) => {
    const supabase = createServiceRoleClient();

    const { data: assessment } = await supabase
      .from('accessibility_assessments')
      .select('profile_id, status')
      .eq('id', payload.assessmentId)
      .single();

    if (!assessment) {
      return { status: 'failed', errorCode: 'ASSESSMENT_NOT_FOUND', failureType: 'permanent' };
    }

    // Log activity
    await supabase.from('accessibility_activities').insert({
      assessment_id: payload.assessmentId,
      profile_id:    assessment.profile_id,
      event_type:    'assessment_completed',
      event_data:    { assessmentId: payload.assessmentId, finalStatus: assessment.status },
    });

    return { status: 'completed' };
  };

// ─── regression.check ────────────────────────────────────────────────────────

export const handleAccessibilityRegressionCheck: QueueJobHandler<{ assessmentId: string }> =
  async (_ctx, payload) => {
    // Stub — regression logic will compare new findings against prior verified findings
    const supabase = createServiceRoleClient();
    const { data: assessment } = await supabase
      .from('accessibility_assessments')
      .select('profile_id')
      .eq('id', payload.assessmentId)
      .single();

    if (assessment) {
      await supabase.from('accessibility_activities').insert({
        assessment_id: payload.assessmentId,
        profile_id:    assessment.profile_id,
        event_type:    'regression_check_completed',
        event_data:    { assessmentId: payload.assessmentId },
      });
    }

    return { status: 'completed' };
  };

// ─── alert.evaluate ──────────────────────────────────────────────────────────

export const handleAccessibilityAlertEvaluate: QueueJobHandler<{ assessmentId: string }> =
  async (_ctx, _payload) => {
    // Stub — will check risk level changes and send notifications
    return { status: 'completed' };
  };

// ─── statement.generate ──────────────────────────────────────────────────────

export const handleAccessibilityStatementGenerate: QueueJobHandler<{
  profileId:     string;
  assessmentId?: string;
  jurisdictionId: string;
}> =
  async (_ctx, _payload) => {
    // Stub — will call statement-generator and insert draft statement row
    return { status: 'completed' };
  };

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function maybeFinalize(
  supabase: ReturnType<typeof createServiceRoleClient>,
  assessmentId: string,
): Promise<void> {
  const { data: pages } = await supabase
    .from('accessibility_assessment_pages')
    .select('status')
    .eq('assessment_id', assessmentId);

  if (!pages || pages.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allDone = pages.every((p: any) =>
    ['completed', 'failed', 'skipped'].includes(p.status as string),
  );
  if (!allDone) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completed = pages.filter((p: any) => p.status === 'completed').length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const failed    = pages.filter((p: any) => p.status === 'failed').length;
  const status =
    completed === 0 ? 'failed' : failed > 0 ? 'partially_completed' : 'completed';

  const coverage = calculateCoverage({
    totalPages:            pages.length,
    completedPages:        completed,
    failedPages:           failed,
    totalJourneys:         0,
    journeysCovered:       0,
    manualChecksRequired:  0,
    manualChecksCompleted: 0,
  });

  await supabase
    .from('accessibility_assessments')
    .update({
      status,
      completed_at:     new Date().toISOString(),
      pages_completed:  completed,
      pages_failed:     failed,
      coverage_percent: coverage.pageCoveragePercent,
    })
    .eq('id', assessmentId);
}

function derivePour(
  tags: string[],
): 'perceivable' | 'operable' | 'understandable' | 'robust' {
  for (const t of tags) {
    if (/wcag1\d{2}/.test(t) || /1\.\d/.test(t)) return 'perceivable';
    if (/wcag2\d{2}/.test(t) || /2\.\d/.test(t)) return 'operable';
    if (/wcag3\d{2}/.test(t) || /3\.\d/.test(t)) return 'understandable';
    if (/wcag4\d{2}/.test(t) || /4\.\d/.test(t)) return 'robust';
  }
  return 'perceivable';
}
