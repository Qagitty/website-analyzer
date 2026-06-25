// ─── Accessibility Audit Types (v2) ──────────────────────────────────────────
// All checks are static HTML heuristics. A real browser + screen reader test
// is required to confirm or rule out each finding.

/** Confidence level of a finding from static analysis */
export type AccessibilityFindingStatus =
  | 'confirmed'       // Definitely an issue based on static HTML
  | 'likely'          // Probably an issue; false positives possible
  | 'manual-review'   // Cannot determine statically; needs human testing
  | 'passed'          // Check ran and found no issue
  | 'not-applicable'; // Check does not apply to this page

/** Severity of an accessibility barrier */
export type AccessibilitySeverity =
  | 'critical'        // WCAG A violation that completely blocks access
  | 'serious'         // WCAG AA violation that significantly impedes access
  | 'moderate'        // Non-critical barrier; workarounds exist
  | 'minor'           // Best-practice issue; low impact
  | 'manual-review';  // Severity cannot be determined statically

/** A sanitised HTML snippet for evidence — no tokens, cookies, or secrets */
export interface AccessibilityNodeEvidence {
  /** Short hint about what element this is, e.g. "img.hero" */
  selector: string;
  /** Sanitised HTML, max 200 chars */
  html: string;
}

/** Evidence from inline colour-contrast analysis */
export interface ContrastEvidence {
  fgColor: string;
  bgColor: string;
  ratio: number;
  requiredRatio: number;
  isLargeText: boolean;
  source: 'inline-style' | 'manual-review-needed';
}

/** A single accessibility finding (superset of legacy AccessibilityIssue) */
export interface AccessibilityFinding {
  // ── v2 core fields ────────────────────────────────────────────────────────
  id: string;
  severity: AccessibilitySeverity;
  status: AccessibilityFindingStatus;

  /** What is broken (plain English, 1–2 sentences) */
  what: string;
  /** Why it matters for users */
  why: string;
  /** Who is affected */
  who: string;
  /** WCAG success criterion, e.g. "1.1.1 Non-text Content" */
  wcag: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  where: AccessibilityNodeEvidence[];
  howToFix: string;
  howToVerify: string;
  /** Total occurrences found */
  count: number;
  contrastEvidence?: ContrastEvidence;

  // ── Legacy aliases (backward compat with AccessibilityIssue) ─────────────
  /** @deprecated Use severity — 'manual-review' severity maps to 'minor' here */
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  /** @deprecated Use what */
  description: string;
  /** @deprecated Use where[].html */
  nodes: string[];
  /** @deprecated Use wcag */
  wcagCriteria: string[];
}

/** How the v2 accessibility score was computed */
export interface AccessibilityScoreBreakdown {
  confirmedCritical: number;
  confirmedSerious: number;
  confirmedModerate: number;
  confirmedMinor: number;
  likelyCritical: number;
  likelySerious: number;
  likelyModerate: number;
  likelyMinor: number;
  manualReviewItems: number;
  totalConfirmedAndLikely: number;
  weightedPenalty: number;
}

/** Structured error when the audit fails partially or fully */
export interface AccessibilityAuditError {
  code: 'HTML_TOO_LARGE' | 'PARSE_FAILED' | 'TIMEOUT' | 'UNKNOWN';
  message: string;
  /** true = some findings returned despite the error */
  partial: boolean;
}

/** Full accessibility audit result from the static HTML engine */
export interface AccessibilityAuditResult {
  version: 'accessibility-v2';
  mode: 'static-html-only';
  disclaimer: string;
  findings: AccessibilityFinding[];
  /** 0–100, v2 weighted scoring formula */
  score: number;
  scoreBreakdown: AccessibilityScoreBreakdown;
  /** Checks that require manual/screen-reader testing */
  manualReviewItems: string[];
  totalElements: {
    images: number;
    inputs: number;
    buttons: number;
    links: number;
    iframes: number;
    svgs: number;
    tables: number;
    videos: number;
    audios: number;
  };
  error?: AccessibilityAuditError;
}
