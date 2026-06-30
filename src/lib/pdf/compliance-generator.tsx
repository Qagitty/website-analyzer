import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { Analysis, AccessibilityIssue } from '@/types/analysis';
import { getComplianceSummary, type ComplianceLevel } from '@/lib/compliance';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  indigo:      '#EA580C',
  indigoLight: '#FFF7ED',
  violet:      '#EA580C',
  emerald:     '#059669',
  emeraldBg:   '#ECFDF5',
  amber:       '#D97706',
  amberBg:     '#FFFBEB',
  red:         '#DC2626',
  redBg:       '#FEF2F2',
  dark:        '#111118',
  slate:       '#334155',
  slateLight:  '#64748B',
  border:      '#E2E8F0',
  pageBg:      '#FFFFFF',
  sectionBg:   '#F8FAFC',
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: C.pageBg,
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    fontSize: 9,
    color: C.dark,
  },

  // Cover
  coverPage: {
    backgroundColor: C.dark,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  coverGradientBar: {
    height: 8,
    backgroundColor: C.indigo,
  },
  coverBody: {
    paddingHorizontal: 48,
    paddingTop: 60,
    paddingBottom: 60,
    flex: 1,
  },
  coverEyebrow: {
    fontSize: 9,
    color: C.slateLight,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 1.2,
  },
  coverSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 48,
  },
  coverMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  coverMetaLabel: {
    fontSize: 8,
    color: C.slateLight,
    width: 80,
  },
  coverMetaValue: {
    fontSize: 8,
    color: '#E2E8F0',
    flex: 1,
  },
  coverBadgeRow: {
    marginTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coverCompliantBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  coverDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginTop: 48,
    marginBottom: 20,
  },
  coverFooter: {
    fontSize: 8,
    color: C.slateLight,
  },

  // Page header/footer
  pageHeader: {
    backgroundColor: C.indigo,
    paddingHorizontal: 48,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  pageHeaderTitle: {
    fontSize: 8,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pageHeaderSite: {
    fontSize: 8,
    color: '#C7D2FE',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 16,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  pageFooterText: {
    fontSize: 7,
    color: C.slateLight,
  },

  // Layout
  body: {
    paddingHorizontal: 48,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: C.dark,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: C.indigo,
  },

  // Summary stat cards
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.sectionBg,
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 7,
    color: C.slateLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Status box
  statusBox: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  statusBoxTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  statusBoxText: {
    fontSize: 9,
    lineHeight: 1.5,
  },

  // Category table
  categoryRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    alignItems: 'center',
  },
  categoryRowHeader: {
    backgroundColor: C.indigo,
  },
  categoryHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  categoryName: {
    flex: 2,
    fontSize: 9,
  },
  categoryCount: {
    flex: 1,
    fontSize: 9,
    textAlign: 'center',
  },
  categoryStatus: {
    flex: 1,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },

  // Issue item
  issueBlock: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  issueHeader: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  issueTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
  },
  issueBadge: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  issueBody: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  issueDescription: {
    fontSize: 8,
    color: C.slate,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  issueTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  issueTag: {
    fontSize: 6.5,
    color: C.slateLight,
    backgroundColor: C.sectionBg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: 'Helvetica',
  },

  // Remediation table
  remRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    alignItems: 'flex-start',
  },
  remNum: {
    width: 20,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.indigo,
  },
  remTitle: {
    flex: 2,
    fontSize: 9,
  },
  remImpact: {
    flex: 1,
    fontSize: 8,
    color: C.slateLight,
    textAlign: 'center',
  },
  remPriority: {
    flex: 1,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },

  // Legal notice
  legalBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  legalTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#92400E',
    marginBottom: 4,
  },
  legalText: {
    fontSize: 8,
    color: '#92400E',
    lineHeight: 1.5,
  },
  methodBox: {
    backgroundColor: C.sectionBg,
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  methodTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: C.dark,
  },
  methodItem: {
    fontSize: 8,
    color: C.slate,
    lineHeight: 1.6,
    marginBottom: 2,
  },

  // Sign-off
  signOffBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 16,
    marginTop: 8,
  },
  signOffRow: {
    flexDirection: 'row',
    gap: 20,
  },
  signOffField: {
    flex: 1,
  },
  signOffLabel: {
    fontSize: 7,
    color: C.slateLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 18,
  },
  signOffLine: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 4,
  },
  signOffName: {
    fontSize: 7,
    color: C.slateLight,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function impactConfig(impact: string): { bg: string; color: string; label: string } {
  switch (impact) {
    case 'critical': return { bg: C.redBg,     color: C.red,     label: 'Critical' };
    case 'serious':  return { bg: '#FFF1F2',   color: '#E11D48', label: 'Serious' };
    case 'moderate': return { bg: C.amberBg,   color: C.amber,   label: 'Moderate' };
    default:         return { bg: C.sectionBg, color: C.slateLight, label: 'Minor' };
  }
}

function levelConfig(level: ComplianceLevel): { bg: string; color: string; label: string; border: string } {
  switch (level) {
    case 'compliant':      return { bg: C.emeraldBg, color: C.emerald, border: C.emerald,   label: 'NO CRITICAL ISSUES DETECTED' };
    case 'partial':        return { bg: C.amberBg,   color: C.amber,   border: C.amber,     label: 'ISSUES REQUIRE ATTENTION' };
    case 'non-compliant':  return { bg: C.redBg,     color: C.red,     border: C.red,       label: 'CRITICAL ISSUES FOUND' };
  }
}

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

// ── Page wrapper helpers ──────────────────────────────────────────────────────

function PageHeader({ url, pageLabel }: { url: string; pageLabel: string }) {
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch {}
  return (
    <View style={S.pageHeader} fixed>
      <Text style={S.pageHeaderTitle}>Accessibility Compliance Audit</Text>
      <Text style={S.pageHeaderSite}>{hostname} · {pageLabel}</Text>
    </View>
  );
}

function PageFooter({ auditDate, reportId }: { auditDate: string; reportId: string }) {
  return (
    <View style={S.pageFooter} fixed>
      <Text style={S.pageFooterText}>Report ID: {reportId.slice(0, 8).toUpperCase()} · Audit date: {auditDate}</Text>
      <Text style={S.pageFooterText}>Generated by WebAnalyzer · Automated WCAG 2.1 AA scan</Text>
    </View>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────

interface Props {
  analysis: Analysis;
  agencyName?: string;
}

function ComplianceDocument({ analysis, agencyName }: Props) {
  const issues = (analysis.accessibility_issues as AccessibilityIssue[]) ?? [];
  const summary = getComplianceSummary(issues);
  const level   = summary.level;
  const lCfg    = levelConfig(level);
  const auditDate = formatDate(analysis.completed_at);

  const hostname = (() => { try { return new URL(analysis.url).hostname; } catch { return analysis.url; } })();

  // Sort issues by severity
  const sortedIssues = [...issues].sort(
    (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact),
  );

  // Group for remediation priority (top 8 critical/serious)
  const priorityIssues = sortedIssues
    .filter((i) => i.impact === 'critical' || i.impact === 'serious')
    .slice(0, 8);

  return (
    <Document
      title={`Compliance Audit — ${hostname}`}
      author={agencyName ?? 'WebAnalyzer'}
      subject="WCAG 2.1 AA / EAA Accessibility Compliance Report"
    >
      {/* ── COVER PAGE ───────────────────────────────────────────────────── */}
      <Page size="A4" style={[S.page, S.coverPage]}>
        <View style={S.coverGradientBar} />
        <View style={S.coverBody}>
          <Text style={S.coverEyebrow}>Accessibility Compliance Audit</Text>
          <Text style={S.coverTitle}>
            WCAG 2.1 AA{'\n'}Compliance Report
          </Text>
          <Text style={S.coverSubtitle}>
            European Accessibility Act (EAA) Assessment
          </Text>

          <View style={S.coverMetaRow}>
            <Text style={S.coverMetaLabel}>Website</Text>
            <Text style={S.coverMetaValue}>{analysis.url}</Text>
          </View>
          <View style={S.coverMetaRow}>
            <Text style={S.coverMetaLabel}>Audit date</Text>
            <Text style={S.coverMetaValue}>{auditDate}</Text>
          </View>
          <View style={S.coverMetaRow}>
            <Text style={S.coverMetaLabel}>Standard</Text>
            <Text style={S.coverMetaValue}>WCAG 2.1 Level AA / EN 301 549 / EAA 2025</Text>
          </View>
          {agencyName && (
            <View style={S.coverMetaRow}>
              <Text style={S.coverMetaLabel}>Prepared by</Text>
              <Text style={S.coverMetaValue}>{agencyName}</Text>
            </View>
          )}

          <View style={S.coverBadgeRow}>
            <Text style={S.coverEyebrow}>Overall status</Text>
            <View style={[S.coverCompliantBadge, { backgroundColor: lCfg.bg }]}>
              <Text style={{ color: lCfg.color, fontSize: 12, fontFamily: 'Helvetica-Bold' }}>
                {lCfg.label}
              </Text>
            </View>
          </View>

          <View style={S.coverDivider} />
          <Text style={S.coverFooter}>
            This report is based on automated WCAG 2.1 AA scanning and does not constitute legal compliance certification.{'\n'}
            Automated testing detects ~30–40% of accessibility issues. Manual review by an accessibility specialist is recommended for full verification.
          </Text>
        </View>
      </Page>

      {/* ── EXECUTIVE SUMMARY ────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <PageHeader url={analysis.url} pageLabel="Executive Summary" />
        <View style={S.body}>

          {/* Overall status banner */}
          <View style={[S.statusBox, {
            backgroundColor: lCfg.bg,
            borderLeftColor: lCfg.color,
          }]}>
            <Text style={[S.statusBoxTitle, { color: lCfg.color }]}>
              {lCfg.label} — {hostname}
            </Text>
            <Text style={[S.statusBoxText, { color: lCfg.color }]}>
              {level === 'compliant'
                ? 'No critical or serious accessibility barriers were detected in this automated scan. Manual review is still recommended for full verification.'
                : level === 'partial'
                ? 'Minor accessibility issues were detected. No critical barriers found. Remediation is recommended before claiming WCAG 2.1 AA readiness.'
                : `${summary.criticalCount} critical accessibility barrier${summary.criticalCount !== 1 ? 's' : ''} detected. Immediate remediation is required. This site is not ready for WCAG 2.1 AA compliance claims.`}
            </Text>
          </View>

          {/* Stat cards */}
          <View style={S.statRow}>
            <View style={S.statCard}>
              <Text style={[S.statValue, { color: summary.totalIssues > 0 ? C.amber : C.emerald }]}>
                {summary.totalIssues}
              </Text>
              <Text style={S.statLabel}>Total issues</Text>
            </View>
            <View style={S.statCard}>
              <Text style={[S.statValue, { color: summary.criticalCount > 0 ? C.red : C.emerald }]}>
                {summary.criticalCount}
              </Text>
              <Text style={S.statLabel}>Critical / Serious</Text>
            </View>
            <View style={S.statCard}>
              <Text style={[S.statValue, { color: summary.moderateCount > 0 ? C.amber : C.emerald }]}>
                {summary.moderateCount}
              </Text>
              <Text style={S.statLabel}>Moderate / Minor</Text>
            </View>
          </View>

          {/* Categories table */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Compliance Category Breakdown</Text>
            <View style={[S.categoryRow, S.categoryRowHeader]}>
              <Text style={[S.categoryHeaderText, { flex: 2 }]}>Category</Text>
              <Text style={[S.categoryHeaderText, { flex: 1, textAlign: 'center' }]}>Issues</Text>
              <Text style={[S.categoryHeaderText, { flex: 1, textAlign: 'right' }]}>Status</Text>
            </View>
            {[
              { name: 'WCAG 2.1 Level AA (overall)', count: summary.totalIssues },
              { name: 'Principle 1 — Perceivable', count: summary.perceivableCount },
              { name: 'Principle 2 — Operable', count: summary.operableCount },
            ].map((row, i) => (
              <View key={i} style={[S.categoryRow, { backgroundColor: i % 2 === 0 ? C.pageBg : C.sectionBg }]}>
                <Text style={[S.categoryName, { fontSize: 9 }]}>{row.name}</Text>
                <Text style={[S.categoryCount, { color: row.count > 0 ? C.red : C.emerald }]}>
                  {row.count}
                </Text>
                <Text style={[S.categoryStatus, { color: row.count > 0 ? C.amber : C.emerald }]}>
                  {row.count === 0 ? '✓ Pass' : '✗ Fail'}
                </Text>
              </View>
            ))}
          </View>

          {/* AI summary if available */}
          {analysis.ai_summary && analysis.ai_summary.length > 5 && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>AI Analysis Summary</Text>
              <View style={S.methodBox}>
                <Text style={{ fontSize: 9, color: C.slate, lineHeight: 1.6 }}>
                  {analysis.ai_summary}
                </Text>
              </View>
            </View>
          )}
        </View>
        <PageFooter auditDate={auditDate} reportId={analysis.id} />
      </Page>

      {/* ── LEGAL CONTEXT ────────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <PageHeader url={analysis.url} pageLabel="Legal Context & Methodology" />
        <View style={S.body}>

          <View style={S.section}>
            <Text style={S.sectionTitle}>European Accessibility Act (EAA)</Text>

            <View style={S.legalBox}>
              <Text style={S.legalTitle}>⚠ Legal Requirement — Effective June 2025</Text>
              <Text style={S.legalText}>
                The European Accessibility Act (Directive 2019/882) requires that digital products and services sold to EU consumers meet WCAG 2.1 Level AA accessibility standards. This automated report provides a compliance readiness assessment only. It does not constitute legal certification. Consult a qualified accessibility specialist and legal counsel to confirm your compliance status.
              </Text>
            </View>

            <View style={S.methodBox}>
              <Text style={S.methodTitle}>Who is affected?</Text>
              <Text style={S.methodItem}>• E-commerce websites and apps selling to EU customers</Text>
              <Text style={S.methodItem}>• Banking and financial services websites</Text>
              <Text style={S.methodItem}>• Transport services (flights, trains, buses)</Text>
              <Text style={S.methodItem}>• Streaming and media platforms</Text>
              <Text style={S.methodItem}>• Consumer electronics with digital interfaces</Text>
              <Text style={S.methodItem}>• All public sector websites (existing obligation since 2020)</Text>
            </View>
          </View>

          <View style={S.section}>
            <Text style={S.sectionTitle}>Audit Methodology</Text>
            <View style={S.methodBox}>
              <Text style={S.methodTitle}>How this report was produced</Text>
              <Text style={S.methodItem}>
                1. Automated scan using axe-core 4.x — the industry-standard WCAG testing engine used by Deque, Microsoft, and Google.
              </Text>
              <Text style={S.methodItem}>
                2. AI-assisted analysis via Claude Vision — screenshot-based review of visual layout, contrast, and UX accessibility patterns.
              </Text>
              <Text style={S.methodItem}>
                3. WCAG 2.1 Level AA mapping — each issue is mapped to specific success criteria from the Web Content Accessibility Guidelines.
              </Text>
            </View>

            <View style={[S.methodBox, { marginTop: 10 }]}>
              <Text style={S.methodTitle}>Limitations</Text>
              <Text style={S.methodItem}>
                Automated tools detect approximately 30–40% of WCAG issues. This report should be supplemented with manual testing by an accessibility specialist and user testing with people with disabilities for comprehensive compliance verification.
              </Text>
            </View>
          </View>

          <View style={S.section}>
            <Text style={S.sectionTitle}>Standards Referenced</Text>
            <View style={[S.categoryRow, S.categoryRowHeader]}>
              <Text style={[S.categoryHeaderText, { flex: 2 }]}>Standard</Text>
              <Text style={[S.categoryHeaderText, { flex: 2 }]}>Description</Text>
            </View>
            {[
              ['WCAG 2.1 Level AA', 'Web Content Accessibility Guidelines — primary technical standard'],
              ['EN 301 549 v3.2.1', 'European standard for ICT accessibility, references WCAG 2.1'],
              ['EAA / Directive 2019/882', 'EU law requiring digital products meet EN 301 549'],
              ['ARIA 1.2', 'Accessible Rich Internet Applications specification'],
            ].map(([std, desc], i) => (
              <View key={i} style={[S.categoryRow, { backgroundColor: i % 2 === 0 ? C.pageBg : C.sectionBg }]}>
                <Text style={[S.categoryName, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>{std}</Text>
                <Text style={[S.categoryName, { fontSize: 8, color: C.slate }]}>{desc}</Text>
              </View>
            ))}
          </View>
        </View>
        <PageFooter auditDate={auditDate} reportId={analysis.id} />
      </Page>

      {/* ── ISSUES FOUND ─────────────────────────────────────────────────── */}
      {sortedIssues.length > 0 && (
        <Page size="A4" style={S.page}>
          <PageHeader url={analysis.url} pageLabel="Issues Found" />
          <View style={S.body}>
            <View style={S.section}>
              <Text style={S.sectionTitle}>
                Accessibility Issues — {sortedIssues.length} total
              </Text>

              {sortedIssues.map((issue, i) => {
                const cfg = impactConfig(issue.impact);
                const wcagTags = issue.wcagCriteria.filter((t) => t.startsWith('wcag')).slice(0, 6);
                return (
                  <View key={i} style={S.issueBlock} wrap={false}>
                    <View style={[S.issueHeader, { backgroundColor: cfg.bg }]}>
                      <Text style={[S.issueTitle, { color: C.dark }]}>
                        {(issue.id ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                      <View style={[S.issueBadge, { backgroundColor: cfg.color }]}>
                        <Text style={{ color: '#FFFFFF', fontSize: 7, fontFamily: 'Helvetica-Bold' }}>
                          {cfg.label}
                        </Text>
                      </View>
                    </View>
                    <View style={S.issueBody}>
                      <Text style={S.issueDescription}>{issue.description}</Text>
                      {wcagTags.length > 0 && (
                        <View style={S.issueTagRow}>
                          {wcagTags.map((tag, j) => (
                            <View key={j} style={S.issueTag}>
                              <Text>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          <PageFooter auditDate={auditDate} reportId={analysis.id} />
        </Page>
      )}

      {/* ── NO ISSUES ────────────────────────────────────────────────────── */}
      {sortedIssues.length === 0 && (
        <Page size="A4" style={S.page}>
          <PageHeader url={analysis.url} pageLabel="Issues Found" />
          <View style={S.body}>
            <View style={[S.statusBox, { backgroundColor: C.emeraldBg, borderLeftColor: C.emerald }]}>
              <Text style={[S.statusBoxTitle, { color: C.emerald }]}>
                ✓ No Accessibility Issues Detected
              </Text>
              <Text style={[S.statusBoxText, { color: C.emerald }]}>
                The automated scan found no WCAG 2.1 AA violations on this page. We recommend scheduling regular audits and supplementing with manual testing.
              </Text>
            </View>
          </View>
          <PageFooter auditDate={auditDate} reportId={analysis.id} />
        </Page>
      )}

      {/* ── REMEDIATION PRIORITIES ───────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <PageHeader url={analysis.url} pageLabel="Remediation & Sign-Off" />
        <View style={S.body}>

          {priorityIssues.length > 0 && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>Remediation Priority List</Text>
              <Text style={{ fontSize: 8, color: C.slateLight, marginBottom: 10 }}>
                Fix these critical and serious issues first. Each directly blocks users with disabilities from accessing content.
              </Text>

              <View style={[S.categoryRow, S.categoryRowHeader]}>
                <Text style={[S.categoryHeaderText, { width: 20 }]}>#</Text>
                <Text style={[S.categoryHeaderText, { flex: 3 }]}>Issue</Text>
                <Text style={[S.categoryHeaderText, { flex: 1, textAlign: 'center' }]}>Severity</Text>
                <Text style={[S.categoryHeaderText, { flex: 1, textAlign: 'right' }]}>Priority</Text>
              </View>

              {priorityIssues.map((issue, i) => {
                const cfg = impactConfig(issue.impact);
                return (
                  <View key={i} style={[S.remRow, { backgroundColor: i % 2 === 0 ? C.pageBg : C.sectionBg }]}>
                    <Text style={S.remNum}>{i + 1}</Text>
                    <Text style={[S.remTitle, { flex: 3 }]}>
                      {(issue.id ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                    <Text style={[S.remImpact, { color: cfg.color }]}>{cfg.label}</Text>
                    <Text style={[S.remPriority, { color: i < 3 ? C.red : C.amber }]}>
                      {i < 3 ? 'IMMEDIATE' : 'HIGH'}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Recommended next steps */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Recommended Next Steps</Text>
            <View style={S.methodBox}>
              {[
                `1. Fix all Critical and Serious issues listed above before ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.`,
                '2. Commission manual testing with assistive technologies (screen readers, keyboard navigation).',
                '3. Conduct user testing with people who have visual, motor, and cognitive disabilities.',
                '4. Schedule a follow-up automated audit to verify remediation progress.',
                '5. Publish an Accessibility Statement on your website as required by EN 301 549.',
              ].map((step, i) => (
                <Text key={i} style={[S.methodItem, { marginBottom: 5 }]}>{step}</Text>
              ))}
            </View>
          </View>

          {/* Sign-off */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Sign-Off</Text>
            <View style={S.signOffBox}>
              <View style={S.signOffRow}>
                {[
                  { label: 'Reviewed by (name)', line: true },
                  { label: 'Title / Role', line: true },
                  { label: 'Date', line: true },
                ].map((f, i) => (
                  <View key={i} style={S.signOffField}>
                    <Text style={S.signOffLabel}>{f.label}</Text>
                    <View style={S.signOffLine} />
                  </View>
                ))}
              </View>
              <View style={[S.signOffRow, { marginTop: 20 }]}>
                <View style={S.signOffField}>
                  <Text style={S.signOffLabel}>Signature</Text>
                  <View style={S.signOffLine} />
                </View>
                <View style={S.signOffField}>
                  <Text style={S.signOffLabel}>Organisation</Text>
                  <View style={S.signOffLine} />
                </View>
                <View style={S.signOffField} />
              </View>
              <Text style={[S.methodItem, { marginTop: 12, fontFamily: 'Helvetica' }]}>
                By signing above, I confirm I have reviewed this report and that remediation actions are being tracked.
              </Text>
            </View>
          </View>
        </View>
        <PageFooter auditDate={auditDate} reportId={analysis.id} />
      </Page>
    </Document>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function generateCompliancePDF(
  analysis: Analysis,
  agencyName?: string,
): Promise<Buffer> {
  return renderToBuffer(
    <ComplianceDocument analysis={analysis} agencyName={agencyName} />,
  ) as unknown as Buffer;
}
