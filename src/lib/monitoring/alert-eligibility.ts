/**
 * Gate function that determines whether the full alert evaluation pipeline
 * should run for a given monitor callback.
 *
 * Keeps the eligibility logic in one place so the callback route and tests
 * can reason about it independently of the pipeline itself.
 */

export interface AlertEligibilityContext {
  monitorId: string | undefined;
  monitorNotify: boolean | null | undefined;
  monitorUserId: string | undefined;
  /** Current scores from the just-completed analysis. */
  newScores: Record<string, number | null | undefined> | null | undefined;
}

/**
 * Returns true when the alert pipeline should be invoked.
 *
 * Requirements:
 *  - This is a monitor-triggered analysis (monitorId present)
 *  - The monitor has notifications enabled
 *  - We have a user ID to resolve the notification address
 *  - The analysis produced at least some scores to evaluate
 *
 * Note: `monitorLastScores` (baseline) is intentionally NOT required here —
 * the pipeline handles first-run gracefully by treating all changes as
 * non-comparable, which produces zero triggered alerts.
 */
export function shouldEvaluateMonitorAlerts(ctx: AlertEligibilityContext): boolean {
  if (!ctx.monitorId) return false;
  if (!ctx.monitorNotify) return false;
  if (!ctx.monitorUserId) return false;
  if (!ctx.newScores) return false;
  return true;
}
