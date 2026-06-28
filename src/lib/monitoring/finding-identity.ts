/**
 * Stable finding identity and lifecycle classification (§12–§13).
 *
 * Rules:
 *  - Match findings by stable structural key — never by generated title text (§12).
 *  - AI recommendation titles are not stable identifiers.
 *  - Do NOT mark a finding resolved if the check was not executed (§13).
 *  - Do NOT mark resolved if the category failed or coverage decreased.
 *  - A finding is 'not-evaluated' when the relevant check did not run.
 */

import crypto from 'crypto';
import type { FindingIdentity, FindingChangeStatus, FindingChangeRecord } from './types';

// ─── Stable key ───────────────────────────────────────────────────────────────

/**
 * Compute a stable 32-char hex key for a finding.
 * The key is derived from the structural identity — not from generated text.
 */
export function computeFindingStableKey(identity: Omit<FindingIdentity, 'stableKey'>): string {
  const parts = [
    identity.ruleId,
    identity.scope,
    identity.pageId ?? '',
    identity.normalizedTarget ?? '',
  ];
  return crypto.createHash('sha256').update(parts.join('\x00')).digest('hex').slice(0, 32);
}

/**
 * Normalize a CSS selector or resource URL for stable identity matching.
 * Strips dynamic attributes (data-testid, class specifics, generated IDs).
 */
export function normalizeTarget(raw: string): string {
  return raw
    .replace(/#[a-z0-9_-]+/gi, '#[id]')          // strip dynamic IDs
    .replace(/\[\s*data-[^\]]+\]/g, '')            // strip data-* attributes
    .replace(/\.[a-z0-9_-]*[0-9]+[a-z0-9_-]*/gi, '.[cls]') // strip generated class names
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Finding lifecycle ────────────────────────────────────────────────────────

export interface FindingSet {
  /** Stable keys of findings present in this run's comparable page set. */
  presentKeys: Set<string>;
  /** Stable keys for which the check ran but found no violation. */
  passedKeys: Set<string>;
  /** Stable keys for which the check did not execute (audit failed, category unavailable). */
  notExecutedKeys: Set<string>;
}

/**
 * Classify findings across two runs.
 *
 * baseline — the FindingSet from the reference run (may be null for first run).
 * current  — the FindingSet from the new run.
 *
 * Returns a map from stableKey → FindingChangeStatus for all keys seen in either run.
 *
 * Implementation of §13 lifecycle rules.
 */
export function classifyFindingChanges(
  baseline: FindingSet | null,
  current: FindingSet,
): Map<string, FindingChangeStatus> {
  const result = new Map<string, FindingChangeStatus>();

  if (!baseline) {
    // First run — all findings are 'new', no comparison possible
    for (const key of current.presentKeys) {
      result.set(key, 'new');
    }
    return result;
  }

  // All keys from both runs
  const allKeys = new Set([
    ...current.presentKeys,
    ...current.passedKeys,
    ...current.notExecutedKeys,
    ...baseline.presentKeys,
    ...baseline.passedKeys,
  ]);

  for (const key of allKeys) {
    const inCurrentPresent = current.presentKeys.has(key);
    const inCurrentPassed = current.passedKeys.has(key);
    const inCurrentNotExecuted = current.notExecutedKeys.has(key);
    const inBaselinePresent = baseline.presentKeys.has(key);
    const inBaselinePassed = baseline.passedKeys.has(key);

    let status: FindingChangeStatus;

    if (inCurrentNotExecuted) {
      // Check did not run this time — cannot make any determination
      status = 'not-evaluated';
    } else if (inCurrentPresent && inBaselinePresent) {
      status = 'persistent';
    } else if (inCurrentPresent && (inBaselinePassed || !inBaselinePresent)) {
      // Was absent/passing in baseline, now failing
      if (inBaselinePassed) {
        // Was explicitly passing before → regressed
        status = 'regressed';
      } else {
        // Was never in baseline → new
        status = 'new';
      }
    } else if (!inCurrentPresent && inBaselinePresent) {
      // Was present in baseline, now absent — but only mark resolved if check ran
      if (inCurrentPassed) {
        status = 'resolved';
      } else {
        // Check didn't run or category failed — cannot confirm resolution
        status = 'not-evaluated';
      }
    } else if (inCurrentPassed && inBaselinePassed) {
      // Clean in both runs — not included in result (not a finding)
      continue;
    } else {
      status = 'unknown';
    }

    result.set(key, status);
  }

  return result;
}

/**
 * Returns true when the resolution of a finding can be confirmed.
 *
 * Resolution requires (§21):
 *  - the relevant check executed;
 *  - coverage is adequate;
 *  - the affected page was analyzed;
 *  - the result is comparable;
 *  - the finding is absent.
 */
export function canConfirmResolution(params: {
  checkExecuted: boolean;
  coverageAdequate: boolean;
  pageAnalyzed: boolean;
  comparable: boolean;
  findingAbsent: boolean;
}): boolean {
  return (
    params.checkExecuted &&
    params.coverageAdequate &&
    params.pageAnalyzed &&
    params.comparable &&
    params.findingAbsent
  );
}

/**
 * Build a FindingChangeRecord list from a classification result,
 * merging in severity information from baseline and current findings.
 */
export function buildFindingChangeRecords(
  changes: Map<string, FindingChangeStatus>,
  baselineSeverities: Map<string, string>,
  currentSeverities: Map<string, string>,
): FindingChangeRecord[] {
  const records: FindingChangeRecord[] = [];

  for (const [key, status] of changes) {
    const stableKey = key;
    records.push({
      identity: {
        stableKey,
        ruleId: '',        // caller should enrich from finding registry
        scope: 'page',
      },
      changeStatus: status,
      baselineSeverity: baselineSeverities.get(key),
      currentSeverity: currentSeverities.get(key),
    });
  }

  return records;
}
