/**
 * Accessibility assessment coverage calculator.
 *
 * Coverage metrics are technical measurements only — they do NOT indicate
 * legal compliance, certification, or conformance. Always accompany any
 * coverage figure with the appropriate scope disclaimer.
 */

export interface CoverageInput {
  totalPages:              number;
  completedPages:          number;
  failedPages:             number;
  totalJourneys:           number;
  journeysCovered:         number;
  manualChecksRequired:    number;
  manualChecksCompleted:   number;
}

export interface CoverageResult {
  pageCoveragePercent:    number;
  journeyCoveragePercent: number;
  manualCoveragePercent:  number;
  /** True when automated coverage is too low to draw any meaningful conclusion */
  isInsufficient:         boolean;
  statusLabel:            string;
}

/**
 * Calculate page, journey, and manual check coverage percentages.
 *
 * - pageCoveragePercent:    0–100; 0 pages tested → 0%
 * - journeyCoveragePercent: 0–100; no journeys configured → 100 (N/A, not penalised)
 * - manualCoveragePercent:  0–100; no checks required → 0
 * - isInsufficient:         true when <50% of pages completed or zero pages tested
 */
export function calculateCoverage(input: CoverageInput): CoverageResult {
  const {
    totalPages,
    completedPages,
    failedPages: _failedPages,
    totalJourneys,
    journeysCovered,
    manualChecksRequired,
    manualChecksCompleted,
  } = input;

  const pageCoveragePercent =
    totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;

  // No journeys configured is neutral — don't penalise
  const journeyCoveragePercent =
    totalJourneys > 0
      ? Math.round((journeysCovered / totalJourneys) * 100)
      : 100;

  const manualCoveragePercent =
    manualChecksRequired > 0
      ? Math.round((manualChecksCompleted / manualChecksRequired) * 100)
      : 0;

  const isInsufficient =
    pageCoveragePercent < 50 || (totalPages > 0 && completedPages === 0);

  const statusLabel = isInsufficient
    ? 'Insufficient test coverage — manual review required'
    : `${pageCoveragePercent}% page coverage`;

  return {
    pageCoveragePercent,
    journeyCoveragePercent,
    manualCoveragePercent,
    isInsufficient,
    statusLabel,
  };
}
