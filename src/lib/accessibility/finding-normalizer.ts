/**
 * Normalize raw axe-core findings into the canonical AccessibilityFinding shape.
 *
 * Security: html_excerpt is always sanitized via sanitizeHtmlExcerpt.
 * Never render html_excerpt as HTML — treat as plain text only.
 */

import {
  calculateFindingFingerprint,
  normalizeSelector,
  normalizePageUrl,
  sanitizeHtmlExcerpt,
} from './fingerprint';

export interface RawAxeFinding {
  id:          string;
  impact:      'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  nodes:       Array<{ target: unknown[]; html: string }>;
  tags:        string[];
}

export interface NormalizeFindingOpts {
  profileId:            string;
  pageUrl:              string;
  assessmentId:         string;
  pageId:               string;
  selectedJurisdictions?: string[];
}

export interface NormalizedFinding {
  assessment_id:        string;
  profile_id:           string;
  page_id:              string;
  rule_id:              string;
  title:                string;
  impact:               'critical' | 'serious' | 'moderate' | 'minor';
  page_url:             string;
  selector:             string;
  html_excerpt:         string;
  wcag_criteria:        string[];
  wcag_level:           'A' | 'AA' | 'AAA';
  pour_principle:       'perceivable' | 'operable' | 'understandable' | 'robust';
  automated:            true;
  jurisdiction_relevance: Record<string, unknown>;
  fingerprint:          string;
  status:               'open';
  first_seen_at:        string;
  last_seen_at:         string;
}

export function normalizeFinding(
  raw: RawAxeFinding,
  opts: NormalizeFindingOpts,
): NormalizedFinding {
  const ruleId   = String(raw.id ?? '');
  const pageUrl  = opts.pageUrl;
  const normalizedUrl = normalizePageUrl(pageUrl);

  const firstNode = Array.isArray(raw.nodes) ? raw.nodes[0] : undefined;

  const rawSelector =
    firstNode?.target
      ? firstNode.target.map(String).join(', ')
      : '';

  const selector    = normalizeSelector(rawSelector);
  const htmlExcerpt = firstNode?.html ? sanitizeHtmlExcerpt(String(firstNode.html)) : '';

  const tags: string[] = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
  const wcagCriteria = tags.filter((t) => /^wcag\d|^best-practice/.test(t));

  const wcagLevel: 'A' | 'AA' | 'AAA' = wcagCriteria.some((t) =>
    t.includes('aaa'),
  )
    ? 'AAA'
    : wcagCriteria.some((t) => t.includes('2aa') || t.includes('22aa'))
    ? 'AA'
    : 'A';

  const pourPrinciple = derivePourPrinciple(wcagCriteria);

  const fingerprint = calculateFindingFingerprint({
    profileId:          opts.profileId,
    normalizedPageUrl:  normalizedUrl,
    ruleId,
    normalizedSelector: selector,
  });

  const now = new Date().toISOString();

  return {
    assessment_id:          opts.assessmentId,
    profile_id:             opts.profileId,
    page_id:                opts.pageId,
    rule_id:                ruleId,
    title:                  String(raw.description ?? ruleId),
    impact:                 raw.impact,
    page_url:               pageUrl,
    selector,
    html_excerpt:           htmlExcerpt,
    wcag_criteria:          wcagCriteria,
    wcag_level:             wcagLevel,
    pour_principle:         pourPrinciple,
    automated:              true,
    jurisdiction_relevance: {},
    fingerprint,
    status:                 'open',
    first_seen_at:          now,
    last_seen_at:           now,
  };
}

function derivePourPrinciple(
  tags: string[],
): 'perceivable' | 'operable' | 'understandable' | 'robust' {
  for (const tag of tags) {
    // WCAG criterion numbers: 1.x = perceivable, 2.x = operable, 3.x = understandable, 4.x = robust
    if (/wcag1\d{2}/.test(tag) || /1\.\d/.test(tag)) return 'perceivable';
    if (/wcag2\d{2}/.test(tag) || /2\.\d/.test(tag)) return 'operable';
    if (/wcag3\d{2}/.test(tag) || /3\.\d/.test(tag)) return 'understandable';
    if (/wcag4\d{2}/.test(tag) || /4\.\d/.test(tag)) return 'robust';
  }
  return 'perceivable'; // safe default
}
