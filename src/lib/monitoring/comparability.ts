/**
 * Comparability validation (§10).
 *
 * Before computing a score delta, verify the two runs used compatible
 * configurations. Non-comparable runs must not produce a normal green/red
 * score delta for the user.
 *
 * Rules:
 *  - Different score versions → not-comparable (no score alert)
 *  - Different audit modes for a category → that category is excluded
 *  - Different device profiles → limited comparison (flagged)
 *  - Different analyzer versions → info-level difference (not blocking)
 *  - Page sample differences are tracked separately (§7)
 */

import crypto from 'crypto';
import type {
  MonitorRunConfiguration,
  MonitorComparabilityResult,
  MonitorConfigurationDifference,
  MonitorConfigurationDifferenceLevel,
} from './types';

// ─── Fingerprint ─────────────────────────────────────────────────────────────

/**
 * Compute a stable SHA-256 fingerprint for a run configuration.
 * Fields are sorted canonically so key insertion order doesn't matter.
 */
export function computeConfigFingerprint(config: Omit<MonitorRunConfiguration, 'configurationFingerprint'>): string {
  const canonical = {
    analyzerVersion: config.analyzerVersion,
    scoreVersions: sortedRecord(config.scoreVersions),
    ruleRegistryVersions: sortedRecord(config.ruleRegistryVersions),
    deviceProfile: config.deviceProfile,
    auditModes: sortedRecord(config.auditModes),
    crawlStrategy: config.crawlStrategy,
    maxPages: config.maxPages,
    locale: config.locale ?? null,
    browserVersion: config.browserVersion ?? null,
    aiCrawlerConfigVersion: config.aiCrawlerConfigVersion ?? null,
    featureFlags: config.featureFlags ? sortedRecord(config.featureFlags as Record<string, unknown>) : null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function sortedRecord<V>(obj: Record<string, V>): Record<string, V> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

// ─── Comparability validation ─────────────────────────────────────────────────

/**
 * Compare two run configurations and determine whether their results can be
 * meaningfully compared.
 *
 * Returns a MonitorComparabilityResult describing what categories (if any)
 * can be compared and what differs.
 */
export function validateComparability(
  current: MonitorRunConfiguration,
  baseline: MonitorRunConfiguration,
): MonitorComparabilityResult {
  const differences: MonitorConfigurationDifference[] = [];
  const excludedCategories: string[] = [];

  // ── Score versions (incompatible if different) ────────────────────────────
  const currentScoreKeys = Object.keys(current.scoreVersions).sort();
  const baselineScoreKeys = Object.keys(baseline.scoreVersions).sort();

  for (const key of new Set([...currentScoreKeys, ...baselineScoreKeys])) {
    const cv = current.scoreVersions[key];
    const bv = baseline.scoreVersions[key];
    if (cv !== bv) {
      differences.push({
        field: `scoreVersions.${key}`,
        baselineValue: bv ?? null,
        currentValue: cv ?? null,
        level: 'incompatible',
        reason: `Score version for ${key} changed from ${bv ?? 'none'} to ${cv ?? 'none'} — scores are not comparable`,
      });
      if (!excludedCategories.includes(key)) excludedCategories.push(key);
    }
  }

  // ── Audit modes (incompatible per category if different) ──────────────────
  const auditModeKeys = new Set([
    ...Object.keys(current.auditModes),
    ...Object.keys(baseline.auditModes),
  ]);
  for (const key of auditModeKeys) {
    const cv = current.auditModes[key];
    const bv = baseline.auditModes[key];
    if (cv !== bv) {
      differences.push({
        field: `auditModes.${key}`,
        baselineValue: bv ?? null,
        currentValue: cv ?? null,
        level: 'incompatible',
        reason: `Audit mode for ${key} changed from ${bv ?? 'none'} to ${cv ?? 'none'} — comparison excluded`,
      });
      if (!excludedCategories.includes(key)) excludedCategories.push(key);
    }
  }

  // ── Device profile (limited comparison) ───────────────────────────────────
  if (current.deviceProfile !== baseline.deviceProfile) {
    differences.push({
      field: 'deviceProfile',
      baselineValue: baseline.deviceProfile,
      currentValue: current.deviceProfile,
      level: 'limited',
      reason: `Device profile changed from ${baseline.deviceProfile} to ${current.deviceProfile} — performance metrics may not be comparable`,
    });
  }

  // ── Crawl strategy (limited — page sample may differ) ─────────────────────
  if (current.crawlStrategy !== baseline.crawlStrategy) {
    differences.push({
      field: 'crawlStrategy',
      baselineValue: baseline.crawlStrategy,
      currentValue: current.crawlStrategy,
      level: 'limited',
      reason: `Crawl strategy changed — page sample may differ`,
    });
  }

  // ── Max pages (limited if significantly different) ─────────────────────────
  if (current.maxPages !== baseline.maxPages) {
    const level: MonitorConfigurationDifferenceLevel =
      Math.abs(current.maxPages - baseline.maxPages) > 5 ? 'limited' : 'info';
    differences.push({
      field: 'maxPages',
      baselineValue: baseline.maxPages,
      currentValue: current.maxPages,
      level,
      reason: `Max pages changed from ${baseline.maxPages} to ${current.maxPages}`,
    });
  }

  // ── Analyzer version (info — may affect scores subtly) ────────────────────
  if (current.analyzerVersion !== baseline.analyzerVersion) {
    differences.push({
      field: 'analyzerVersion',
      baselineValue: baseline.analyzerVersion,
      currentValue: current.analyzerVersion,
      level: 'info',
      reason: `Analyzer version changed from ${baseline.analyzerVersion} to ${current.analyzerVersion}`,
    });
  }

  // ── Rule registry versions (limited if different) ─────────────────────────
  const ruleKeys = new Set([
    ...Object.keys(current.ruleRegistryVersions),
    ...Object.keys(baseline.ruleRegistryVersions),
  ]);
  for (const key of ruleKeys) {
    const cv = current.ruleRegistryVersions[key];
    const bv = baseline.ruleRegistryVersions[key];
    if (cv !== bv) {
      differences.push({
        field: `ruleRegistryVersions.${key}`,
        baselineValue: bv ?? null,
        currentValue: cv ?? null,
        level: 'limited',
        reason: `Rule registry ${key} changed — findings may not be fully comparable`,
      });
    }
  }

  // ── Locale (limited) ──────────────────────────────────────────────────────
  if ((current.locale ?? 'en') !== (baseline.locale ?? 'en')) {
    differences.push({
      field: 'locale',
      baselineValue: baseline.locale ?? 'en',
      currentValue: current.locale ?? 'en',
      level: 'limited',
      reason: 'Locale changed — content and SEO checks may differ',
    });
  }

  // ── AI crawler config version (limited) ───────────────────────────────────
  if (current.aiCrawlerConfigVersion !== baseline.aiCrawlerConfigVersion) {
    differences.push({
      field: 'aiCrawlerConfigVersion',
      baselineValue: baseline.aiCrawlerConfigVersion ?? null,
      currentValue: current.aiCrawlerConfigVersion ?? null,
      level: 'limited',
      reason: 'AI crawler configuration changed — LLM readiness comparison is limited (§29)',
    });
  }

  // ── Determine overall comparability ───────────────────────────────────────
  const hasIncompatible = differences.some((d) => d.level === 'incompatible');
  const hasLimited = differences.some((d) => d.level === 'limited');

  const level = hasIncompatible ? 'not-comparable' : hasLimited ? 'limited' : 'full';
  const comparable = !hasIncompatible;

  // Categories that are comparable = all known categories minus excluded ones
  const allCategories = ['performance', 'accessibility', 'seo', 'bestPractices', 'llmReadiness', 'security'];
  const comparableCategories = comparable
    ? allCategories.filter((c) => !excludedCategories.includes(c))
    : [];

  let warning: string | undefined;
  if (level === 'not-comparable') {
    warning = 'Runs are not comparable due to configuration changes. Score deltas are suppressed.';
  } else if (level === 'limited') {
    const limitedFields = differences.filter((d) => d.level === 'limited').map((d) => d.field);
    warning = `Comparison is limited due to changes in: ${limitedFields.join(', ')}.`;
  }

  return {
    comparable,
    level,
    differences,
    comparableCategories,
    excludedCategories,
    warning,
  };
}

// ─── Baseline selection ───────────────────────────────────────────────────────

export interface BaselineCandidate {
  runId: string;
  status: string;
  configuration: MonitorRunConfiguration;
  completedAt: string;
  coveragePercent?: number;
}

export interface BaselineSelectionResult {
  selectedRunId: string | null;
  rejectedRunIds: string[];
  reason: string;
}

/**
 * Select the best baseline from a list of candidates.
 * Implements §9 — do not compare against failed, low-coverage, or
 * incompatible runs.
 *
 * Candidates must be pre-sorted newest-first.
 */
export function selectBaseline(
  candidates: BaselineCandidate[],
  currentConfig: MonitorRunConfiguration,
  minCoveragePercent = 50,
): BaselineSelectionResult {
  const rejected: string[] = [];

  for (const candidate of candidates) {
    // Must be a successful run
    if (candidate.status !== 'completed') {
      rejected.push(candidate.runId);
      continue;
    }

    // Must meet minimum coverage
    if (
      candidate.coveragePercent !== undefined &&
      candidate.coveragePercent < minCoveragePercent
    ) {
      rejected.push(candidate.runId);
      continue;
    }

    // Must be comparable (not necessarily fully — limited is OK)
    const comp = validateComparability(currentConfig, candidate.configuration);
    if (!comp.comparable) {
      rejected.push(candidate.runId);
      continue;
    }

    return {
      selectedRunId: candidate.runId,
      rejectedRunIds: rejected,
      reason: comp.level === 'full'
        ? 'Selected previous comparable run'
        : `Selected previous run with limited comparability: ${comp.warning ?? ''}`,
    };
  }

  return {
    selectedRunId: null,
    rejectedRunIds: rejected,
    reason: 'No comparable baseline found',
  };
}
