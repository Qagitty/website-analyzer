import { describe, it, expect } from 'vitest';
import { calculateCoverage, type CoverageInput } from '@/lib/accessibility/coverage';

function makeInput(overrides: Partial<CoverageInput> = {}): CoverageInput {
  return {
    totalPages:           10,
    completedPages:       0,
    failedPages:          0,
    totalJourneys:        0,
    journeysCovered:      0,
    manualChecksRequired: 22,
    manualChecksCompleted: 0,
    ...overrides,
  };
}

describe('calculateCoverage', () => {
  it('returns 0% coverage when no pages started', () => {
    const result = calculateCoverage(makeInput());
    expect(result.pageCoveragePercent).toBe(0);
    expect(result.isInsufficient).toBe(true);
  });

  it('returns 100% when all pages completed', () => {
    const result = calculateCoverage(makeInput({ totalPages: 5, completedPages: 5, failedPages: 0 }));
    expect(result.pageCoveragePercent).toBe(100);
  });

  it('calculates partial page coverage correctly', () => {
    const result = calculateCoverage(makeInput({ totalPages: 10, completedPages: 7, failedPages: 3 }));
    expect(result.pageCoveragePercent).toBe(70);
  });

  it('marks insufficient when page coverage < 50%', () => {
    const result = calculateCoverage(makeInput({ totalPages: 10, completedPages: 4, failedPages: 6 }));
    expect(result.isInsufficient).toBe(true);
  });

  it('not insufficient when coverage >= 50%', () => {
    const result = calculateCoverage(makeInput({ totalPages: 10, completedPages: 5, failedPages: 5 }));
    expect(result.isInsufficient).toBe(false);
  });

  it('journey coverage defaults to 100% when no journeys configured', () => {
    const result = calculateCoverage(makeInput({ completedPages: 5, totalJourneys: 0, journeysCovered: 0 }));
    expect(result.journeyCoveragePercent).toBe(100);
  });

  it('calculates journey coverage when journeys configured', () => {
    const result = calculateCoverage(makeInput({
      completedPages:  5,
      totalJourneys:   4,
      journeysCovered: 3,
    }));
    expect(result.journeyCoveragePercent).toBe(75);
  });

  it('calculates manual check coverage', () => {
    const result = calculateCoverage(makeInput({
      completedPages:        5,
      manualChecksRequired:  22,
      manualChecksCompleted: 11,
    }));
    expect(result.manualCoveragePercent).toBe(50);
  });

  it('returns a statusLabel string', () => {
    const result = calculateCoverage(makeInput({ completedPages: 5 }));
    expect(typeof result.statusLabel).toBe('string');
    expect(result.statusLabel.length).toBeGreaterThan(0);
  });

  it('handles zero total pages without dividing by zero', () => {
    const result = calculateCoverage(makeInput({ totalPages: 0, completedPages: 0, failedPages: 0 }));
    expect(result.pageCoveragePercent).toBe(0);
    expect(result.isInsufficient).toBe(true);
  });

  it('manual coverage 0 when no checks required', () => {
    const result = calculateCoverage(makeInput({
      completedPages:        5,
      manualChecksRequired:  0,
      manualChecksCompleted: 0,
    }));
    expect(result.manualCoveragePercent).toBe(0);
  });
});
