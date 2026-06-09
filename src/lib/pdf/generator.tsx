import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
  type DocumentProps,
} from '@react-pdf/renderer';
import type { Analysis, LighthouseScores, AccessibilityIssue, AIInsight } from '@/types/analysis';

export interface Branding {
  agencyName?: string;
  brandColor?: string;
  showPoweredBy?: boolean;
  /** Signed URL for agency logo (resolved before calling generateReportPDF) */
  logoUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | undefined | null): string {
  if (score == null) return '#6b7280';
  if (score >= 90) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

function vitalLabel(metric: string, value: number): string {
  switch (metric) {
    case 'lcp':  return value < 2500 ? 'Good' : 'Needs work';
    case 'cls':  return value < 0.1  ? 'Good' : 'Needs work';
    case 'ttfb': return value < 800  ? 'Good' : 'Needs work';
    case 'fid':  return value < 100  ? 'Good' : 'Needs work';
    default:     return '';
  }
}

function vitalColor(metric: string, value: number): string {
  return vitalLabel(metric, value) === 'Good' ? '#16a34a' : '#dc2626';
}

function formatVitalValue(metric: string, value: number): string {
  switch (metric) {
    case 'lcp':  return `${(value / 1000).toFixed(1)}s`;
    case 'cls':  return value.toFixed(3);
    case 'ttfb': return `${value}ms`;
    case 'fid':  return `${value}ms`;
    default:     return String(value);
  }
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return '#dc2626';
    case 'high':     return '#ea580c';
    case 'medium':   return '#d97706';
    default:         return '#6b7280';
  }
}

function effortColor(effort: string): string {
  switch (effort) {
    case 'low':    return '#16a34a';
    case 'medium': return '#d97706';
    case 'high':   return '#dc2626';
    default:       return '#6b7280';
  }
}

function effortTime(effort: string): string {
  switch (effort) {
    case 'low':    return '~15 min';
    case 'medium': return '~2 hrs';
    case 'high':   return '1–2 days';
    default:       return '';
  }
}

function impactColor(impact: string): string {
  switch (impact) {
    case 'critical': return '#dc2626';
    case 'serious':  return '#ea580c';
    case 'moderate': return '#d97706';
    default:         return '#6b7280';
  }
}

function categoryIcon(category: string): string {
  switch (category) {
    case 'performance':   return '⚡';
    case 'accessibility': return '♿';
    case 'seo':           return '🔍';
    case 'security':      return '🔒';
    case 'ux':            return '🎨';
    default:              return '•';
  }
}

// Sort insights by priority × impact descending
function sortInsights(insights: AIInsight[]): AIInsight[] {
  const pw: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return [...insights].sort((a, b) => {
    const wa = (pw[a.priority] ?? 1) * (a.impactScore ?? 5);
    const wb = (pw[b.priority] ?? 1) * (b.impactScore ?? 5);
    return wb - wa;
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(brandColor: string) {
  return StyleSheet.create({
    page: {
      backgroundColor: '#ffffff',
      paddingTop: 40,
      paddingBottom: 48,
      paddingLeft: 40,
      paddingRight: 40,
      fontFamily: 'Helvetica',
    },

    // Header bar (appears on every page)
    headerBar: {
      backgroundColor: brandColor,
      marginTop: -40,
      marginLeft: -40,
      marginRight: -40,
      marginBottom: 24,
      paddingTop: 12,
      paddingBottom: 12,
      paddingLeft: 40,
      paddingRight: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerAgency: {
      color: '#ffffff',
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
    },
    headerTagline: {
      color: '#c7d2fe',
      fontSize: 8,
    },

    // Footer
    footer: {
      position: 'absolute',
      bottom: 16,
      left: 40,
      right: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: '#f3f4f6',
      paddingTop: 6,
    },
    footerText: {
      fontSize: 7,
      color: '#9ca3af',
    },

    // Cover page
    coverUrl: {
      fontSize: 22,
      color: '#111827',
      fontFamily: 'Helvetica-Bold',
      marginBottom: 4,
      wordBreak: 'break-all',
    },
    coverSubtitle: {
      fontSize: 11,
      color: '#6b7280',
      marginBottom: 4,
    },
    coverDate: {
      fontSize: 9,
      color: '#9ca3af',
      marginBottom: 20,
    },

    // Score boxes row
    scoresRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    scoreBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 6,
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 8,
      paddingRight: 8,
      alignItems: 'center',
    },
    scoreNumber: {
      fontSize: 26,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 2,
    },
    scoreLabel: {
      fontSize: 7,
      color: '#6b7280',
      textAlign: 'center',
    },

    // AI summary box
    summaryBox: {
      backgroundColor: '#eef2ff',
      borderRadius: 6,
      padding: 12,
      marginBottom: 16,
    },
    summaryText: {
      fontSize: 9,
      color: '#312e81',
      lineHeight: 1.5,
    },

    // Section heading
    sectionHeading: {
      fontSize: 16,
      fontFamily: 'Helvetica-Bold',
      color: brandColor,
      marginBottom: 14,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    sectionSubheading: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      marginBottom: 8,
      marginTop: 4,
    },

    // Table rows
    tableRow: {
      flexDirection: 'row',
      paddingTop: 7,
      paddingBottom: 7,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
      alignItems: 'center',
    },
    tableCell: {
      fontSize: 9,
      color: '#111827',
    },
    tableCellMuted: {
      fontSize: 9,
      color: '#6b7280',
    },

    // Vitals
    vitalBadge: {
      borderRadius: 3,
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 5,
      paddingRight: 5,
      alignSelf: 'flex-start',
    },
    vitalBadgeText: {
      fontSize: 7,
      color: '#ffffff',
      fontFamily: 'Helvetica-Bold',
    },

    // Bullet recommendation
    bulletRow: {
      flexDirection: 'row',
      marginBottom: 8,
      gap: 6,
    },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginTop: 4,
      shrink: 0,
    },
    bulletContent: {
      flex: 1,
    },
    bulletTitle: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      marginBottom: 2,
    },
    bulletText: {
      fontSize: 8,
      color: '#6b7280',
      lineHeight: 1.4,
    },

    // Fix roadmap card
    roadmapCard: {
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 5,
      marginBottom: 7,
      overflow: 'hidden',
    },
    roadmapCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 7,
      paddingBottom: 7,
      paddingLeft: 10,
      paddingRight: 10,
      gap: 7,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
    },
    roadmapPriorityBar: {
      width: 3,
      borderRadius: 2,
      alignSelf: 'stretch',
      minHeight: 28,
    },
    roadmapIcon: {
      fontSize: 10,
    },
    roadmapTitle: {
      flex: 1,
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
    },
    roadmapBadge: {
      borderRadius: 3,
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 5,
      paddingRight: 5,
    },
    roadmapBadgeText: {
      fontSize: 6.5,
      fontFamily: 'Helvetica-Bold',
      color: '#ffffff',
      textTransform: 'uppercase',
    },
    roadmapBody: {
      paddingTop: 6,
      paddingBottom: 7,
      paddingLeft: 20,
      paddingRight: 10,
    },
    roadmapDesc: {
      fontSize: 8,
      color: '#6b7280',
      lineHeight: 1.4,
      marginBottom: 5,
    },
    roadmapRecBox: {
      backgroundColor: '#f9fafb',
      borderRadius: 3,
      padding: 6,
      marginBottom: 4,
    },
    roadmapRecText: {
      fontSize: 8,
      color: '#374151',
      lineHeight: 1.4,
    },
    roadmapMeta: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    roadmapMetaTag: {
      fontSize: 7,
      color: '#9ca3af',
    },

    // Issue card (accessibility)
    issueCard: {
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 5,
      padding: 8,
      marginBottom: 6,
    },
    issueHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
      gap: 6,
    },
    issueBadge: {
      borderRadius: 3,
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 5,
      paddingRight: 5,
    },
    issueBadgeText: {
      fontSize: 6.5,
      color: '#ffffff',
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
    },
    issueTitle: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      flex: 1,
    },
    issueDescription: {
      fontSize: 8,
      color: '#6b7280',
      lineHeight: 1.4,
    },

    // Quick wins
    quickWinRow: {
      flexDirection: 'row',
      marginBottom: 5,
      gap: 6,
      alignItems: 'flex-start',
    },
    quickWinCheck: {
      fontSize: 9,
      color: '#16a34a',
      fontFamily: 'Helvetica-Bold',
    },
    quickWinText: {
      fontSize: 9,
      color: '#111827',
      flex: 1,
      lineHeight: 1.4,
    },

    // Stats row
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    statBox: {
      flex: 1,
      borderRadius: 5,
      padding: 8,
      alignItems: 'center',
      borderWidth: 1,
    },
    statNumber: {
      fontSize: 20,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
    },
    statLabel: {
      fontSize: 7,
      color: '#6b7280',
      textAlign: 'center',
    },

    // Screenshot
    screenshotContainer: {
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 16,
    },
    screenshotImage: {
      width: '100%',
      objectFit: 'contain',
    },
    screenshotCaption: {
      fontSize: 8,
      color: '#9ca3af',
      textAlign: 'center',
      padding: 6,
      backgroundColor: '#f9fafb',
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
    },
  });
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function HeaderBar({
  styles,
  brandColor,
  agencyName,
  logoUrl,
  pageLabel,
}: {
  styles: ReturnType<typeof makeStyles>;
  brandColor: string;
  agencyName?: string;
  logoUrl?: string;
  pageLabel?: string;
}) {
  return (
    <View style={styles.headerBar} fixed>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {logoUrl && (
          <Image
            src={logoUrl}
            style={{ height: 22, maxWidth: 70, objectFit: 'contain' }}
          />
        )}
        <Text style={styles.headerAgency}>{agencyName ?? 'WebAnalyzer'}</Text>
      </View>
      {pageLabel && <Text style={styles.headerTagline}>{pageLabel}</Text>}
    </View>
  );
}

function PageFooter({
  styles,
  showPoweredBy,
  agencyName,
  pageNum,
}: {
  styles: ReturnType<typeof makeStyles>;
  showPoweredBy: boolean;
  agencyName?: string;
  pageNum?: string;
}) {
  const show = showPoweredBy || !agencyName;
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{show ? 'Generated by WebAnalyzer' : (agencyName ?? '')}</Text>
      {pageNum && <Text style={styles.footerText}>{pageNum}</Text>}
    </View>
  );
}

// ─── Page 1: Cover ────────────────────────────────────────────────────────────

function CoverPage({
  analysis,
  branding,
  styles,
  brandColor,
  screenshotUrl,
}: {
  analysis: Analysis;
  branding: Required<Branding>;
  styles: ReturnType<typeof makeStyles>;
  brandColor: string;
  screenshotUrl?: string;
}) {
  const ls = analysis.lighthouse_scores;
  const scores = [
    { label: 'Performance',    value: ls?.performance   ?? null },
    { label: 'Accessibility',  value: ls?.accessibility ?? null },
    { label: 'SEO',            value: ls?.seo           ?? null },
    { label: 'Best Practices', value: ls?.bestPractices ?? null },
  ];

  const dateStr = analysis.completed_at
    ? new Date(analysis.completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date(analysis.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} logoUrl={branding.logoUrl} />

      <Text style={styles.coverUrl}>{analysis.url}</Text>
      <Text style={styles.coverSubtitle}>Website Analysis Report</Text>
      <Text style={styles.coverDate}>Analyzed on {dateStr}</Text>

      {/* Score boxes */}
      <View style={styles.scoresRow}>
        {scores.map((s) => (
          <View key={s.label} style={styles.scoreBox}>
            <Text style={[styles.scoreNumber, { color: scoreColor(s.value) }]}>
              {s.value ?? '—'}
            </Text>
            <Text style={styles.scoreLabel}>{s.label}</Text>
            {s.value != null && (
              <Text style={[styles.scoreLabel, { color: '#9ca3af', marginTop: 1 }]}>/100</Text>
            )}
          </View>
        ))}
      </View>

      {/* AI summary */}
      {analysis.ai_summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{analysis.ai_summary}</Text>
        </View>
      )}

      {/* Screenshot thumbnail */}
      {screenshotUrl && (
        <View style={styles.screenshotContainer}>
          <Image src={screenshotUrl} style={[styles.screenshotImage, { maxHeight: 220 }]} />
          <Text style={styles.screenshotCaption}>Screenshot captured at time of analysis</Text>
        </View>
      )}

      <PageFooter styles={styles} showPoweredBy={branding.showPoweredBy} agencyName={branding.agencyName} />
    </Page>
  );
}

// ─── Page 2: Performance ─────────────────────────────────────────────────────

function PerformancePage({
  analysis,
  branding,
  styles,
  brandColor,
}: {
  analysis: Analysis;
  branding: Required<Branding>;
  styles: ReturnType<typeof makeStyles>;
  brandColor: string;
}) {
  const ls = analysis.lighthouse_scores as LighthouseScores;

  const vitals: Array<{ key: keyof LighthouseScores; label: string }> = [
    { key: 'lcp',  label: 'Largest Contentful Paint' },
    { key: 'cls',  label: 'Cumulative Layout Shift'  },
    { key: 'ttfb', label: 'Time to First Byte'       },
    { key: 'fid',  label: 'First Input Delay'        },
  ];

  const criticalIssues: Array<{ metric: string; fix: string }> =
    (analysis.ai_insights?.performance?.criticalIssues ?? []).slice(0, 4);

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} logoUrl={branding.logoUrl} pageLabel="Performance" />
      <Text style={styles.sectionHeading}>Performance</Text>

      {/* Core Web Vitals table */}
      <View style={{ marginBottom: 18 }}>
        <View style={[styles.tableRow, { backgroundColor: '#f9fafb' }]}>
          <View style={{ flex: 2 }}>
            <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Metric</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Value</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Status</Text>
          </View>
        </View>

        {vitals.map(({ key, label }) => {
          const val = ls?.[key] as number | undefined;
          if (val == null) return null;
          return (
            <View key={key} style={styles.tableRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.tableCell}>{label}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableCell}>{formatVitalValue(key, val)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.vitalBadge, { backgroundColor: vitalColor(key, val) }]}>
                  <Text style={styles.vitalBadgeText}>{vitalLabel(key, val)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Performance score bar */}
      {ls?.performance != null && (
        <View style={{ marginBottom: 18 }}>
          <Text style={styles.sectionSubheading}>Score: {ls.performance}/100</Text>
          <View style={{ height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <View style={{
              height: 8,
              width: `${ls.performance}%`,
              backgroundColor: scoreColor(ls.performance),
              borderRadius: 4,
            }} />
          </View>
        </View>
      )}

      {/* Recommendations */}
      {criticalIssues.length > 0 && (
        <View>
          <Text style={styles.sectionSubheading}>Top Recommendations</Text>
          {criticalIssues.map((issue, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: brandColor }]} />
              <View style={styles.bulletContent}>
                <Text style={styles.bulletTitle}>{issue.metric}</Text>
                <Text style={styles.bulletText}>{issue.fix}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <PageFooter styles={styles} showPoweredBy={branding.showPoweredBy} agencyName={branding.agencyName} />
    </Page>
  );
}

// ─── Page 3: Fix Roadmap ─────────────────────────────────────────────────────

function FixRoadmapPage({
  analysis,
  branding,
  styles,
  brandColor,
}: {
  analysis: Analysis;
  branding: Required<Branding>;
  styles: ReturnType<typeof makeStyles>;
  brandColor: string;
}) {
  const rawInsights = analysis.ai_insights?.insights ?? [];
  const insights = sortInsights(rawInsights as AIInsight[]).slice(0, 10);

  const quickWins = (analysis.ai_insights?.quickWins ?? []).slice(0, 5);

  const criticalCount = insights.filter((i) => i.priority === 'critical' || i.priority === 'high').length;
  const quickWinCount = insights.filter((i) => i.effortLevel === 'low').length;

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} logoUrl={branding.logoUrl} pageLabel="Fix Roadmap" />
      <Text style={styles.sectionHeading}>Fix Roadmap</Text>

      {/* Summary stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total Issues',    count: insights.length,  bg: '#f9fafb', border: '#e5e7eb' },
          { label: 'Critical / High', count: criticalCount,    bg: '#fef2f2', border: '#fecaca' },
          { label: 'Quick Wins',      count: quickWinCount,    bg: '#f0fdf4', border: '#bbf7d0' },
        ].map(({ label, count, bg, border }) => (
          <View key={label} style={[styles.statBox, { backgroundColor: bg, borderColor: border }]}>
            <Text style={styles.statNumber}>{count}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Quick wins checklist */}
      {quickWins.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.sectionSubheading}>⚡ Quick Wins (under 30 min each)</Text>
          {quickWins.map((win, i) => (
            <View key={i} style={styles.quickWinRow}>
              <Text style={styles.quickWinCheck}>✓</Text>
              <Text style={styles.quickWinText}>{win}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Issue cards */}
      <Text style={[styles.sectionSubheading, { marginBottom: 6 }]}>
        All Issues — sorted by impact
      </Text>

      {insights.map((insight, i) => (
        <View key={i} style={styles.roadmapCard} wrap={false}>
          {/* Card header */}
          <View style={styles.roadmapCardHeader}>
            {/* Priority left bar */}
            <View style={[styles.roadmapPriorityBar, { backgroundColor: priorityColor(insight.priority) }]} />
            {/* Index */}
            <Text style={[styles.roadmapMetaTag, { width: 14 }]}>{i + 1}</Text>
            {/* Category icon */}
            <Text style={styles.roadmapIcon}>{categoryIcon(insight.category)}</Text>
            {/* Title */}
            <Text style={styles.roadmapTitle}>{insight.title}</Text>
            {/* Priority badge */}
            <View style={[styles.roadmapBadge, { backgroundColor: priorityColor(insight.priority) }]}>
              <Text style={styles.roadmapBadgeText}>{insight.priority}</Text>
            </View>
            {/* Effort badge */}
            {insight.effortLevel && (
              <View style={[styles.roadmapBadge, { backgroundColor: effortColor(insight.effortLevel) }]}>
                <Text style={styles.roadmapBadgeText}>{insight.effortLevel} · {effortTime(insight.effortLevel)}</Text>
              </View>
            )}
          </View>

          {/* Card body */}
          <View style={styles.roadmapBody}>
            <Text style={styles.roadmapDesc}>{insight.description}</Text>
            <View style={styles.roadmapRecBox}>
              <Text style={styles.roadmapRecText}>{insight.recommendation}</Text>
            </View>
            <View style={styles.roadmapMeta}>
              {insight.impactScore != null && (
                <Text style={styles.roadmapMetaTag}>Impact: {insight.impactScore}/10</Text>
              )}
              {insight.wcagReference && (
                <Text style={styles.roadmapMetaTag}>· {insight.wcagReference}</Text>
              )}
              <Text style={styles.roadmapMetaTag}>· Expected: {insight.estimatedImpact}</Text>
            </View>
          </View>
        </View>
      ))}

      <PageFooter styles={styles} showPoweredBy={branding.showPoweredBy} agencyName={branding.agencyName} />
    </Page>
  );
}

// ─── Page 4: Accessibility ────────────────────────────────────────────────────

function AccessibilityPage({
  analysis,
  branding,
  styles,
  brandColor,
}: {
  analysis: Analysis;
  branding: Required<Branding>;
  styles: ReturnType<typeof makeStyles>;
  brandColor: string;
}) {
  const issues = (analysis.accessibility_issues ?? []) as AccessibilityIssue[];
  const aiAcc = analysis.ai_insights?.accessibility;

  const critical = issues.filter((i) => i.impact === 'critical').length;
  const serious  = issues.filter((i) => i.impact === 'serious').length;
  const moderate = issues.filter((i) => i.impact === 'moderate').length;

  const interpretedMap: Record<string, { plainEnglish?: string }> = {};
  if (aiAcc?.interpretedIssues) {
    for (const ii of aiAcc.interpretedIssues as Array<{ originalId?: string; plainEnglish?: string }>) {
      if (ii.originalId) interpretedMap[ii.originalId] = ii;
    }
  }

  const displayIssues = issues.slice(0, 6);

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} logoUrl={branding.logoUrl} pageLabel="Accessibility" />
      <Text style={styles.sectionHeading}>Accessibility</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Critical',  count: critical,       bg: '#fef2f2', border: '#fecaca' },
          { label: 'Serious',   count: serious,        bg: '#fff7ed', border: '#fed7aa' },
          { label: 'Moderate',  count: moderate,       bg: '#fffbeb', border: '#fde68a' },
          { label: 'Total',     count: issues.length,  bg: '#f9fafb', border: '#e5e7eb' },
        ].map(({ label, count, bg, border }) => (
          <View key={label} style={[styles.statBox, { backgroundColor: bg, borderColor: border }]}>
            <Text style={styles.statNumber}>{count}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Issue list */}
      {displayIssues.map((issue, i) => {
        const ai = interpretedMap[issue.id];
        const description = ai?.plainEnglish ?? issue.description;
        return (
          <View key={i} style={styles.issueCard} wrap={false}>
            <View style={styles.issueHeader}>
              <View style={[styles.issueBadge, { backgroundColor: impactColor(issue.impact) }]}>
                <Text style={styles.issueBadgeText}>{issue.impact}</Text>
              </View>
              <Text style={styles.issueTitle}>
                {issue.id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
            </View>
            <Text style={styles.issueDescription}>{description}</Text>
          </View>
        );
      })}

      {issues.length > 6 && (
        <Text style={[styles.tableCellMuted, { marginTop: 6, textAlign: 'center' }]}>
          + {issues.length - 6} more issues — view the full report online
        </Text>
      )}

      <PageFooter styles={styles} showPoweredBy={branding.showPoweredBy} agencyName={branding.agencyName} />
    </Page>
  );
}

// ─── Main Document ────────────────────────────────────────────────────────────

function ReportDocument({
  analysis,
  branding,
  screenshotUrl,
}: {
  analysis: Analysis;
  branding: Required<Branding>;
  screenshotUrl?: string;
}) {
  const brandColor = branding.brandColor;
  const styles = makeStyles(brandColor);

  const hasPerformance   = analysis.lighthouse_scores != null;
  const hasRoadmap       = (analysis.ai_insights?.insights ?? []).length > 0;
  const hasAccessibility = (analysis.accessibility_issues ?? []).length > 0;

  return (
    <Document
      title={`Website Analysis — ${analysis.url}`}
      author={branding.agencyName ?? 'WebAnalyzer'}
    >
      <CoverPage
        analysis={analysis}
        branding={branding}
        styles={styles}
        brandColor={brandColor}
        screenshotUrl={screenshotUrl}
      />
      {hasPerformance && (
        <PerformancePage
          analysis={analysis}
          branding={branding}
          styles={styles}
          brandColor={brandColor}
        />
      )}
      {hasRoadmap && (
        <FixRoadmapPage
          analysis={analysis}
          branding={branding}
          styles={styles}
          brandColor={brandColor}
        />
      )}
      {hasAccessibility && (
        <AccessibilityPage
          analysis={analysis}
          branding={branding}
          styles={styles}
          brandColor={brandColor}
        />
      )}
    </Document>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateReportPDF(
  analysis: Analysis,
  branding: Branding = {},
  screenshotUrl?: string,
): Promise<Buffer> {
  const resolvedBranding: Required<Branding> = {
    agencyName:    branding.agencyName    ?? undefined as unknown as string,
    brandColor:    branding.brandColor    ?? '#6366f1',
    showPoweredBy: branding.showPoweredBy ?? true,
    logoUrl:       branding.logoUrl       ?? undefined as unknown as string,
  };

  const element = React.createElement(ReportDocument, {
    analysis,
    branding: resolvedBranding,
    screenshotUrl,
  }) as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
