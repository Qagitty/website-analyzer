/**
 * Source adapters for the Fix Request domain.
 *
 * Each adapter takes a source record from its native module and normalizes it
 * into the shared FixRequestDraft shape. This lets the Fix Request UI accept
 * finding data from any WebScore module without coupling the UI to each module's
 * internal schema.
 *
 * Adapters MUST:
 *  - Never copy private_notes, internal_notes, or billing data into the draft
 *  - Set isPrivate=true on any evidence derived from internal-only fields
 *  - Never include PII (emails, phone numbers, user names) in public evidence
 *  - Sanitize HTML excerpts before including them as evidence
 */

import type {
  FixRequestDraft,
  FixRequestEvidence,
  FixRequestSourceType,
  FixRequestSeverity,
} from '@/types/fix-request';

// ── Shared input types (minimal; mirrors DB columns used here) ─────────────────

export interface AnalysisFindingInput {
  id:          string;
  category:    string;
  priority:    'critical' | 'high' | 'medium' | 'low';
  title:       string;
  description: string;
  url?:        string;
  recommendation?: string;
  analysisId:  string;
}

export interface AccessibilityFindingInput {
  id:          string;
  ruleId:      string;
  title:       string;
  description: string;
  severity:    'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriteria: string[];
  wcagLevel?:  string;
  pageUrl:     string;
  affectedSelector?: string;
  sanitizedHtmlExcerpt?: string;
  analysisId:  string;
}

export interface ErrorIssueInput {
  id:       string;
  message:  string;
  type:     string;
  source:   string;
  line?:    number;
  url?:     string;
  analysisId: string;
}

export interface MonitorRegressionInput {
  id:          string;
  monitorId:   string;
  url:         string;
  metricName:  string;
  previousValue: number;
  currentValue:  number;
  dropPercent?:  number;
  detectedAt:  string;
  runId?:      string;
}

export interface SecurityFindingInput {
  id:          string;
  headerName:  string;
  severity:    'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  url:         string;
  analysisId:  string;
}

export interface SeoFindingInput {
  id:          string;
  ruleId:      string;
  title:       string;
  description: string;
  severity:    'critical' | 'high' | 'medium' | 'low';
  url:         string;
  recommendation?: string;
  analysisId:  string;
}

export interface DesignMismatchInput {
  id:            string;
  category:      string;
  title:         string;
  description:   string;
  severity:      'critical' | 'high' | 'medium' | 'low';
  url:           string;
  analysisId:    string;
  compareId?:    string;
}

export interface LlmReadinessFindingInput {
  id:          string;
  dimension:   string;
  title:       string;
  description: string;
  severity:    'critical' | 'high' | 'medium' | 'low';
  url:         string;
  recommendation?: string;
  analysisId:  string;
}

export interface RemediationItemInput {
  id:               string;
  issueId:          string;
  issueDescription: string;
  impact:           'critical' | 'serious' | 'moderate' | 'minor';
  url:              string;
  analysisId:       string;
  wcagCriteria?:    string[];
  notes?:           string; // treated as internal; never copied to public evidence
}

// ── Severity mapping helpers ───────────────────────────────────────────────────

function axeImpactToSeverity(impact: 'critical' | 'serious' | 'moderate' | 'minor'): FixRequestSeverity {
  const map: Record<string, FixRequestSeverity> = {
    critical: 'critical',
    serious:  'high',
    moderate: 'medium',
    minor:    'low',
  };
  return map[impact] ?? 'medium';
}

function priorityToSeverity(priority: 'critical' | 'high' | 'medium' | 'low'): FixRequestSeverity {
  return priority as FixRequestSeverity;
}

// ── Adapter: analysis_finding ──────────────────────────────────────────────────

export function fromAnalysisFinding(input: AnalysisFindingInput): FixRequestDraft {
  const evidence: FixRequestEvidence[] = [];
  if (input.url) {
    evidence.push({ type: 'url', label: 'Affected page', value: input.url, isPrivate: false });
  }
  return {
    requestType:          'fix',
    title:                input.title,
    summary:              input.description,
    technicalDescription: input.description,
    severity:             priorityToSeverity(input.priority),
    category:             input.category,
    sourceType:           'analysis_finding',
    sourceId:             input.id,
    analysisId:           input.analysisId,
    affectedUrls:         input.url ? [input.url] : [],
    reproductionSteps:    [],
    verificationSteps:    [],
    recommendedFix:       input.recommendation,
    evidence,
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Adapter: accessibility_finding ───────────────────────────────────────────

export function fromAccessibilityFinding(input: AccessibilityFindingInput): FixRequestDraft {
  const evidence: FixRequestEvidence[] = [
    { type: 'url', label: 'Affected page', value: input.pageUrl, isPrivate: false },
  ];
  if (input.affectedSelector) {
    evidence.push({ type: 'text', label: 'CSS selector', value: input.affectedSelector, isPrivate: false });
  }
  if (input.sanitizedHtmlExcerpt) {
    evidence.push({ type: 'text', label: 'HTML excerpt (sanitized)', value: input.sanitizedHtmlExcerpt, isPrivate: false });
  }
  const wcagNote = input.wcagCriteria.length > 0
    ? `WCAG ${input.wcagLevel ?? '2.1'}: ${input.wcagCriteria.join(', ')}`
    : undefined;

  return {
    requestType:          'fix',
    title:                input.title,
    summary:              input.description,
    technicalDescription: [input.description, wcagNote].filter(Boolean).join('\n\n'),
    severity:             axeImpactToSeverity(input.severity),
    category:             'accessibility',
    sourceType:           'accessibility_finding',
    sourceId:             input.id,
    analysisId:           input.analysisId,
    affectedUrls:         [input.pageUrl],
    reproductionSteps:    input.affectedSelector
      ? [`Navigate to ${input.pageUrl}`, `Locate element matching: ${input.affectedSelector}`]
      : [`Navigate to ${input.pageUrl}`],
    verificationSteps:    [
      'Re-run an automated accessibility scan on this page',
      'Confirm the rule violation is no longer reported',
      'Test with a screen reader if applicable',
    ],
    evidence,
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Adapter: error_issue ──────────────────────────────────────────────────────

export function fromErrorIssue(input: ErrorIssueInput): FixRequestDraft {
  const evidence: FixRequestEvidence[] = [
    { type: 'log', label: 'Error message', value: input.message, isPrivate: false },
    { type: 'text', label: 'Source', value: input.source + (input.line ? `:${input.line}` : ''), isPrivate: false },
  ];
  if (input.url) {
    evidence.push({ type: 'url', label: 'Affected page', value: input.url, isPrivate: false });
  }
  return {
    requestType:          'fix',
    title:                `Browser ${input.type}: ${input.message.slice(0, 120)}`,
    summary:              `A ${input.type} was detected in the browser console.`,
    technicalDescription: `Message: ${input.message}\nSource: ${input.source}${input.line ? ` (line ${input.line})` : ''}`,
    severity:             input.type === 'error' ? 'high' : 'low',
    category:             'javascript',
    sourceType:           'error_issue',
    sourceId:             input.id,
    analysisId:           input.analysisId,
    affectedUrls:         input.url ? [input.url] : [],
    reproductionSteps:    [
      input.url ? `Open ${input.url}` : 'Open the affected page',
      'Open browser developer tools → Console tab',
      `Reproduce the error: ${input.message.slice(0, 80)}`,
    ],
    verificationSteps:    [
      'Re-run analysis and confirm console error is no longer reported',
    ],
    evidence,
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Adapter: monitor_regression ──────────────────────────────────────────────

export function fromMonitorRegression(input: MonitorRegressionInput): FixRequestDraft {
  const dropText = input.dropPercent != null ? ` (${input.dropPercent.toFixed(1)}% drop)` : '';
  return {
    requestType:          'audit',
    title:                `Monitor regression: ${input.metricName} dropped on ${input.url}`,
    summary:              `${input.metricName} dropped from ${input.previousValue} to ${input.currentValue}${dropText} at ${input.detectedAt}.`,
    technicalDescription: `Metric: ${input.metricName}\nPrevious: ${input.previousValue}\nCurrent: ${input.currentValue}${dropText}\nDetected: ${input.detectedAt}`,
    severity:             input.dropPercent != null && input.dropPercent >= 20 ? 'high' : 'medium',
    category:             'performance',
    sourceType:           'monitor_regression',
    sourceId:             input.id,
    monitorId:            input.monitorId,
    affectedUrls:         [input.url],
    reproductionSteps:    [
      `Navigate to ${input.url}`,
      `Check ${input.metricName} — currently ${input.currentValue}`,
      `Compare against baseline: ${input.previousValue}`,
    ],
    verificationSteps:    [
      `Re-run monitor for ${input.url}`,
      `Confirm ${input.metricName} returns to within 10% of previous baseline`,
    ],
    evidence: [
      { type: 'url', label: 'Affected URL', value: input.url, isPrivate: false },
      { type: 'text', label: 'Metric', value: `${input.metricName}: ${input.previousValue} → ${input.currentValue}${dropText}`, isPrivate: false },
    ],
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Adapter: security_finding ─────────────────────────────────────────────────

export function fromSecurityFinding(input: SecurityFindingInput): FixRequestDraft {
  return {
    requestType:          'fix',
    title:                `Missing or misconfigured security header: ${input.headerName}`,
    summary:              input.description,
    technicalDescription: input.description,
    severity:             priorityToSeverity(input.severity),
    category:             'security',
    sourceType:           'security_finding',
    sourceId:             input.id,
    analysisId:           input.analysisId,
    affectedUrls:         [input.url],
    reproductionSteps:    [
      `Fetch ${input.url} with curl: curl -I ${input.url}`,
      `Check for header: ${input.headerName}`,
    ],
    verificationSteps:    [
      `Re-analyze ${input.url}`,
      `Confirm ${input.headerName} header is present and correctly configured`,
    ],
    recommendedFix:       input.recommendation,
    evidence: [
      { type: 'url', label: 'Affected URL', value: input.url, isPrivate: false },
      { type: 'text', label: 'Missing/misconfigured header', value: input.headerName, isPrivate: false },
    ],
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Adapter: seo_finding ──────────────────────────────────────────────────────

export function fromSeoFinding(input: SeoFindingInput): FixRequestDraft {
  return {
    requestType:          'fix',
    title:                input.title,
    summary:              input.description,
    technicalDescription: input.description,
    severity:             priorityToSeverity(input.severity),
    category:             'seo',
    sourceType:           'seo_finding',
    sourceId:             input.id,
    analysisId:           input.analysisId,
    affectedUrls:         [input.url],
    reproductionSteps:    [`Navigate to ${input.url}`, `Check ${input.ruleId}`],
    verificationSteps:    [`Re-analyze ${input.url} and confirm ${input.ruleId} no longer fails`],
    recommendedFix:       input.recommendation,
    evidence: [
      { type: 'url', label: 'Affected URL', value: input.url, isPrivate: false },
    ],
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Adapter: design_mismatch ──────────────────────────────────────────────────

export function fromDesignMismatch(input: DesignMismatchInput): FixRequestDraft {
  return {
    requestType:          'review',
    title:                input.title,
    summary:              input.description,
    technicalDescription: input.description,
    severity:             priorityToSeverity(input.severity),
    category:             'design',
    sourceType:           'design_mismatch',
    sourceId:             input.id,
    analysisId:           input.analysisId,
    affectedUrls:         [input.url],
    reproductionSteps:    [`Navigate to ${input.url}`, `Review ${input.category}: ${input.title}`],
    verificationSteps:    [`Re-run comparison for ${input.url} and confirm mismatch is resolved`],
    evidence: [
      { type: 'url', label: 'Affected URL', value: input.url, isPrivate: false },
      { type: 'text', label: 'Category', value: input.category, isPrivate: false },
    ],
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Adapter: llm_readiness_finding ────────────────────────────────────────────

export function fromLlmReadinessFinding(input: LlmReadinessFindingInput): FixRequestDraft {
  return {
    requestType:          'fix',
    title:                input.title,
    summary:              input.description,
    technicalDescription: input.description,
    severity:             priorityToSeverity(input.severity),
    category:             'llm_readiness',
    sourceType:           'llm_readiness_finding',
    sourceId:             input.id,
    analysisId:           input.analysisId,
    affectedUrls:         [input.url],
    reproductionSteps:    [`Navigate to ${input.url}`, `Review LLM readiness dimension: ${input.dimension}`],
    verificationSteps:    [`Re-analyze ${input.url} and confirm LLM readiness dimension '${input.dimension}' is addressed`],
    recommendedFix:       input.recommendation,
    evidence: [
      { type: 'url', label: 'Affected URL', value: input.url, isPrivate: false },
      { type: 'text', label: 'Dimension', value: input.dimension, isPrivate: false },
    ],
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Adapter: remediation_item ─────────────────────────────────────────────────

export function fromRemediationItem(input: RemediationItemInput): FixRequestDraft {
  // notes is internal only — NEVER included in public evidence
  const evidence: FixRequestEvidence[] = [
    { type: 'url', label: 'Affected URL', value: input.url, isPrivate: false },
  ];
  if (input.wcagCriteria && input.wcagCriteria.length > 0) {
    evidence.push({ type: 'text', label: 'WCAG criteria', value: input.wcagCriteria.join(', '), isPrivate: false });
  }

  return {
    requestType:          'fix',
    title:                input.issueDescription.slice(0, 200),
    summary:              `Remediation item: ${input.issueId} — ${input.issueDescription}`,
    technicalDescription: input.issueDescription,
    severity:             axeImpactToSeverity(input.impact),
    category:             'accessibility',
    sourceType:           'remediation_item',
    sourceId:             input.id,
    analysisId:           input.analysisId,
    affectedUrls:         [input.url],
    reproductionSteps:    [`Navigate to ${input.url}`, `Check for: ${input.issueId}`],
    verificationSteps:    ['Re-run accessibility scan and confirm finding is resolved'],
    evidence,
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
  };
}

// ── Generic adapter: manual ────────────────────────────────────────────────────

export function createManualDraft(overrides: Partial<FixRequestDraft> = {}): FixRequestDraft {
  return {
    requestType:          'fix',
    title:                '',
    summary:              '',
    technicalDescription: '',
    severity:             'medium',
    category:             '',
    sourceType:           'manual',
    affectedUrls:         [],
    reproductionSteps:    [],
    verificationSteps:    [],
    evidence:             [],
    attachments:          [],
    recipientSelection:   { type: 'internal_user' },
    deliveryChannels:     ['email'],
    ...overrides,
  };
}

// ── Registry ──────────────────────────────────────────────────────────────────

export type SourceAdapterInput =
  | { type: 'analysis_finding';       data: AnalysisFindingInput }
  | { type: 'accessibility_finding';  data: AccessibilityFindingInput }
  | { type: 'error_issue';            data: ErrorIssueInput }
  | { type: 'monitor_regression';     data: MonitorRegressionInput }
  | { type: 'security_finding';       data: SecurityFindingInput }
  | { type: 'seo_finding';            data: SeoFindingInput }
  | { type: 'design_mismatch';        data: DesignMismatchInput }
  | { type: 'llm_readiness_finding';  data: LlmReadinessFindingInput }
  | { type: 'remediation_item';       data: RemediationItemInput }
  | { type: 'manual';                 data?: Partial<FixRequestDraft> };

export function buildDraftFromSource(input: SourceAdapterInput): FixRequestDraft {
  switch (input.type) {
    case 'analysis_finding':      return fromAnalysisFinding(input.data);
    case 'accessibility_finding': return fromAccessibilityFinding(input.data);
    case 'error_issue':           return fromErrorIssue(input.data);
    case 'monitor_regression':    return fromMonitorRegression(input.data);
    case 'security_finding':      return fromSecurityFinding(input.data);
    case 'seo_finding':           return fromSeoFinding(input.data);
    case 'design_mismatch':       return fromDesignMismatch(input.data);
    case 'llm_readiness_finding': return fromLlmReadinessFinding(input.data);
    case 'remediation_item':      return fromRemediationItem(input.data);
    case 'manual':                return createManualDraft(input.data);
  }
}
