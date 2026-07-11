/**
 * Handler: email.send
 *
 * Sends a transactional email via the existing lib/email service.
 * Template data is stored in the payload; no secrets.
 */

import type { QueueJobHandler, QueueJobResult } from '../types';

export type EmailTemplate =
  | 'analysis_complete'
  | 'analysis_failed'
  | 'monitor_alert'
  | 'team_invite'
  | 'weekly_digest';

export interface EmailSendPayload {
  to:       string;
  template: EmailTemplate;
  data:     Record<string, string | number | boolean | null>;
}

export const emailSendHandler: QueueJobHandler<EmailSendPayload> = async (ctx, payload) => {
  // Dynamically import to avoid loading Resend client in every worker context
  try {
    const mod = await import('@/lib/email/resend');
    // Route to the correct send function based on template
    const fn = {
      analysis_complete: mod.sendAnalysisComplete,
      analysis_failed:   mod.sendAnalysisFailed,
      team_invite:       mod.sendTeamInvite,
      monitor_alert:     mod.sendScoreDropAlert,
      weekly_digest:     mod.sendMonitorSummary,
    }[payload.template];
    if (!fn) throw new Error(`Unknown template: ${payload.template}`);
    await (fn as (args: Record<string, unknown>) => Promise<unknown>)({ to: payload.to, ...payload.data });
    return { status: 'completed' } satisfies QueueJobResult;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Resend API rate limit returns 429
    if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
      return {
        status: 'retry',
        errorCode: 'EMAIL_RATE_LIMITED',
        failureType: 'rate_limited',
      } satisfies QueueJobResult;
    }

    // Invalid recipient / template errors are permanent
    if (message.includes('invalid') || message.includes('not found')) {
      return {
        status: 'failed',
        errorCode: 'EMAIL_PERMANENT_ERROR',
        failureType: 'permanent',
      } satisfies QueueJobResult;
    }

    return {
      status: 'retry',
      errorCode: 'EMAIL_TRANSIENT_ERROR',
      failureType: 'transient',
    } satisfies QueueJobResult;
  }
};
