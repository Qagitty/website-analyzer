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

function truncatePdfUrl(url: string, max = 70): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const full = u.hostname + u.pathname;
    return full.length <= max ? full : full.slice(0, max - 1) + '…';
  } catch {
    return url.length > max ? url.slice(0, max - 1) + '…' : url;
  }
}

function metricStatusColor(status: string): string {
  if (status === 'good') return '#16a34a';
  if (status === 'needs-improvement') return '#d97706';
  if (status === 'poor') return '#dc2626';
  return '#9ca3af';
}

function metricStatusLabel(status: string): string {
  if (status === 'good') return 'Good';
  if (status === 'needs-improvement') return 'Needs work';
  if (status === 'poor') return 'Poor';
  return 'N/A';
}

function formatAuditMetricValue(m: { value: number | null; unit: string }): string {
  if (m.value == null) return 'N/A';
  if (m.unit === 'ms') return m.value >= 1000 ? `${(m.value / 1000).toFixed(1)}s` : `${m.value}ms`;
  if (m.unit === 'score') return m.value.toFixed(m.value < 1 ? 2 : 0);
  return String(m.value);
}

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
  const audit = (ls as any)?.performanceAudit;
  const isFetchOnly = !ls?.measurementMode || ls.measurementMode === 'fetch-only';
  const modeLabel = isFetchOnly ? 'Fetch-only (no real browser)' : 'Browser lab';

  // Opportunities: top 4 by severity order
  const opportunities: Array<{ title: string; recommendation: string; estimatedSavingsMs?: number; severity: string }> =
    ((ls as any)?.opportunities ?? []).slice(0, 4);

  const criticalIssues: Array<{ metric: string; fix: string }> =
    (analysis.ai_insights?.performance?.criticalIssues ?? []).slice(0, 4);

  // Build metrics table rows — prefer performanceAudit.metrics, fall back to legacy fields
  const metricRows: Array<{ label: string; value: string; status: string; source: string }> = [];

  if (audit?.metrics) {
    const m = audit.metrics;
    const order = ['ttfb', 'lcp', 'cls', 'tbt', 'fcp', 'inp'] as const;
    for (const key of order) {
      const metric = m[key];
      if (!metric || metric.status === 'unavailable') continue;
      metricRows.push({
        label: metric.name,
        value: formatAuditMetricValue(metric),
        status: metric.status,
        source: metric.source === 'estimated' ? `Est. · ${metric.confidence} confidence` : metric.source === 'fetch-timing' ? 'HTTP timing' : metric.source,
      });
    }
  } else {
    // Legacy fallback
    if (ls?.ttfb != null) metricRows.push({ label: 'TTFB', value: `${ls.ttfb}ms`, status: ls.ttfb < 800 ? 'good' : ls.ttfb < 1800 ? 'needs-improvement' : 'poor', source: 'HTTP timing' });
    const lcpVal = ls?.estimatedLcp ?? ls?.lcp;
    if (lcpVal != null) metricRows.push({ label: 'LCP (estimated)', value: `~${lcpVal >= 1000 ? (lcpVal / 1000).toFixed(1) + 's' : lcpVal + 'ms'}`, status: lcpVal < 2500 ? 'good' : lcpVal < 4000 ? 'needs-improvement' : 'poor', source: 'Estimated' });
  }

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} logoUrl={branding.logoUrl} pageLabel="Performance" />
      <Text style={styles.sectionHeading}>Performance</Text>

      {/* Overview row: score + mode */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <View style={{ alignItems: 'center', minWidth: 60 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 28, color: scoreColor(ls?.performance) }}>{ls?.performance ?? '–'}</Text>
          <Text style={{ fontSize: 7, color: '#6b7280' }}>out of 100</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
            <View style={{ height: 8, width: `${ls?.performance ?? 0}%`, backgroundColor: scoreColor(ls?.performance), borderRadius: 4 }} />
          </View>
          <Text style={{ fontSize: 7, color: '#6b7280' }}>Measurement: {modeLabel}</Text>
          {isFetchOnly && <Text style={{ fontSize: 7, color: '#d97706', marginTop: 2 }}>TTFB is real · LCP is estimated · CLS/TBT/FCP/INP not available in fetch-only mode</Text>}
        </View>
      </View>

      {/* Metrics table */}
      {metricRows.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.sectionSubheading}>Core Metrics</Text>
          <View style={[styles.tableRow, { backgroundColor: '#f9fafb' }]}>
            <View style={{ flex: 3 }}><Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Metric</Text></View>
            <View style={{ flex: 1 }}><Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Value</Text></View>
            <View style={{ flex: 1 }}><Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Status</Text></View>
            <View style={{ flex: 2 }}><Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Source</Text></View>
          </View>
          {metricRows.map((row, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <View style={{ flex: 3 }}><Text style={styles.tableCell}>{row.label}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.tableCell}>{row.value}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={[styles.vitalBadge, { backgroundColor: metricStatusColor(row.status) }]}>
                  <Text style={styles.vitalBadgeText}>{metricStatusLabel(row.status)}</Text>
                </View>
              </View>
              <View style={{ flex: 2 }}><Text style={[styles.tableCell, { color: '#9ca3af', fontSize: 7 }]}>{row.source}</Text></View>
            </View>
          ))}
        </View>
      )}

      {/* Top opportunities */}
      {opportunities.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.sectionSubheading}>Top Opportunities</Text>
          {opportunities.map((opp, i) => (
            <View key={i} style={styles.bulletRow} wrap={false}>
              <View style={[styles.bulletDot, { backgroundColor: opp.severity === 'critical' ? '#dc2626' : opp.severity === 'high' ? '#d97706' : '#6366f1' }]} />
              <View style={styles.bulletContent}>
                <Text style={styles.bulletTitle}>{opp.title}</Text>
                <Text style={styles.bulletText}>{opp.recommendation}</Text>
                {opp.estimatedSavingsMs != null && (
                  <Text style={{ fontSize: 7, color: '#6366f1', marginTop: 1 }}>
                    ~{opp.estimatedSavingsMs >= 1000 ? `${(opp.estimatedSavingsMs / 1000).toFixed(1)}s` : `${opp.estimatedSavingsMs}ms`} potential saving
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* AI recommendations fallback when no structured opportunities */}
      {opportunities.length === 0 && criticalIssues.length > 0 && (
        <View>
          <Text style={styles.sectionSubheading}>Top Recommendations</Text>
          {criticalIssues.map((issue, i) => (
            <View key={i} style={styles.bulletRow} wrap={false}>
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
  const accessibilityAudit = (analysis.lighthouse_scores as any)?.accessibilityAudit as import('@/types/accessibility').AccessibilityAuditResult | undefined;
  const legacyIssues = (analysis.accessibility_issues ?? []) as AccessibilityIssue[];
  const aiAcc = analysis.ai_insights?.accessibility;

  const interpretedMap: Record<string, { plainEnglish?: string }> = {};
  if (aiAcc?.interpretedIssues) {
    for (const ii of aiAcc.interpretedIssues as Array<{ originalId?: string; plainEnglish?: string }>) {
      if (ii.originalId) interpretedMap[ii.originalId] = ii;
    }
  }

  // ── v2 path ────────────────────────────────────────────────────────────────
  if (accessibilityAudit) {
    const { findings, score, scoreBreakdown, manualReviewItems, mode } = accessibilityAudit;
    const priority = findings
      .filter(f => f.status === 'confirmed' || f.status === 'likely')
      .sort((a, b) => {
        const order = { critical: 0, serious: 1, moderate: 2, minor: 3, 'manual-review': 4 };
        return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
      });
    const displayFindings = priority.slice(0, 5);

    return (
      <Page size="A4" style={styles.page}>
        <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} logoUrl={branding.logoUrl} pageLabel="Accessibility" />
        <Text style={styles.sectionHeading}>Accessibility</Text>

        {/* Score + mode */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <View style={{ alignItems: 'center', minWidth: 60 }}>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444' }}>
              {score}
            </Text>
            <Text style={{ fontSize: 9, color: '#6b7280' }}>/100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, color: '#6b7280', marginBottom: 3 }}>
              Mode: {mode === 'static-html-only' ? 'Static HTML scan' : mode}
            </Text>
            <Text style={{ fontSize: 8, color: '#9ca3af', lineHeight: 1.4 }}>
              Static analysis only — not a legal WCAG compliance certification. Manual testing with screen readers required.
            </Text>
          </View>
        </View>

        {/* Severity summary */}
        <View style={styles.statsRow}>
          {[
            { label: 'Critical',  count: scoreBreakdown.confirmedCritical + scoreBreakdown.likelyCritical,  bg: '#fef2f2', border: '#fecaca' },
            { label: 'Serious',   count: scoreBreakdown.confirmedSerious  + scoreBreakdown.likelySerious,   bg: '#fff7ed', border: '#fed7aa' },
            { label: 'Moderate',  count: scoreBreakdown.confirmedModerate + scoreBreakdown.likelyModerate,  bg: '#fffbeb', border: '#fde68a' },
            { label: 'Manual',    count: scoreBreakdown.manualReviewItems, bg: '#eff6ff', border: '#bfdbfe' },
          ].map(({ label, count, bg, border }) => (
            <View key={label} style={[styles.statBox, { backgroundColor: bg, borderColor: border }]}>
              <Text style={styles.statNumber}>{count}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Top findings */}
        {displayFindings.map((finding, i) => {
          const ai = interpretedMap[finding.id];
          const description = ai?.plainEnglish ?? finding.what;
          return (
            <View key={i} style={styles.issueCard} wrap={false}>
              <View style={styles.issueHeader}>
                <View style={[styles.issueBadge, { backgroundColor: impactColor(finding.impact) }]}>
                  <Text style={styles.issueBadgeText}>{finding.severity}</Text>
                </View>
                <Text style={styles.issueTitle}>
                  {finding.id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
                <Text style={{ fontSize: 8, color: '#6b7280', marginLeft: 4 }}>{finding.wcag}</Text>
              </View>
              <Text style={styles.issueDescription}>{description}</Text>
              {finding.howToFix && (
                <Text style={{ fontSize: 8, color: '#4b5563', marginTop: 3 }}>Fix: {finding.howToFix.slice(0, 200)}</Text>
              )}
            </View>
          );
        })}

        {priority.length > 5 && (
          <Text style={[styles.tableCellMuted, { marginTop: 6, textAlign: 'center' }]}>
            + {priority.length - 5} more findings — view the full report online
          </Text>
        )}

        {/* Manual review checklist (partial) */}
        {manualReviewItems.length > 0 && (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#374151', marginBottom: 4 }}>Manual Testing Required</Text>
            {manualReviewItems.slice(0, 5).map((item, i) => (
              <Text key={i} style={{ fontSize: 8, color: '#6b7280', marginBottom: 2 }}>☐ {item}</Text>
            ))}
            {manualReviewItems.length > 5 && (
              <Text style={{ fontSize: 8, color: '#9ca3af' }}>+ {manualReviewItems.length - 5} more in online report</Text>
            )}
          </View>
        )}

        <PageFooter styles={styles} showPoweredBy={branding.showPoweredBy} agencyName={branding.agencyName} />
      </Page>
    );
  }

  // ── Legacy path ────────────────────────────────────────────────────────────
  const issues = legacyIssues;
  const critical = issues.filter((i) => i.impact === 'critical').length;
  const serious  = issues.filter((i) => i.impact === 'serious').length;
  const moderate = issues.filter((i) => i.impact === 'moderate').length;
  const displayIssues = issues.slice(0, 6);

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} logoUrl={branding.logoUrl} pageLabel="Accessibility" />
      <Text style={styles.sectionHeading}>Accessibility</Text>

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

      <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 8 }}>
        Based on static HTML analysis only — not a legal compliance certification.
      </Text>

      <PageFooter styles={styles} showPoweredBy={branding.showPoweredBy} agencyName={branding.agencyName} />
    </Page>
  );
}

// ─── SEO Page ─────────────────────────────────────────────────────────────────

function SEOPage({
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
  const seoAudit = (analysis.lighthouse_scores as any)?.seoAudit as import('@/types/seo').SeoAuditResult | undefined;
  if (!seoAudit) return null;

  const { score, summary, findings, coverage, metadata, indexability, structuredData } = seoAudit;

  const SCOLOR = score === null ? '#9ca3af' : score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  // Top findings to show (failed/warning, sorted by severity)
  const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const priorityFindings = findings
    .filter(f => f.status === 'failed' || f.status === 'warning')
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
    .slice(0, 6);

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} logoUrl={branding.logoUrl} pageLabel="SEO" />
      <Text style={styles.sectionHeading}>SEO Audit</Text>

      {/* Score + mode */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <View style={{ alignItems: 'center', minWidth: 60 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: SCOLOR }}>
            {score !== null ? score : '–'}
          </Text>
          <Text style={{ fontSize: 9, color: '#6b7280' }}>/100</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, color: '#6b7280', marginBottom: 3 }}>
            Mode: Fetch-only · {coverage.percentage}% coverage ({coverage.executedChecks}/{coverage.supportedChecks} checks)
          </Text>
          <Text style={{ fontSize: 8, color: '#9ca3af', lineHeight: 1.4 }}>
            Static analysis from HTML + HTTP headers + robots.txt + sitemap.xml. JS-rendered metadata not detected.
          </Text>
        </View>
      </View>

      {/* Summary tiles */}
      <View style={styles.statsRow}>
        {[
          { label: 'Critical', count: summary.critical,   bg: '#fef2f2', border: '#fecaca' },
          { label: 'High',     count: summary.high,       bg: '#fff7ed', border: '#fed7aa' },
          { label: 'Warnings', count: summary.medium + summary.low, bg: '#fffbeb', border: '#fde68a' },
          { label: 'Passed',   count: summary.passed,     bg: '#f0fdf4', border: '#bbf7d0' },
        ].map(({ label, count, bg, border }) => (
          <View key={label} style={[styles.statBox, { backgroundColor: bg, borderColor: border }]}>
            <Text style={styles.statNumber}>{count}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Metadata row */}
      <View style={{ marginBottom: 10 }}>
        <Text style={[styles.subsectionHeading, { fontSize: 10, marginBottom: 4 }]}>Metadata</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[
            { k: 'Title', v: metadata.titleStatus, extra: metadata.titleLength ? `${metadata.titleLength}ch` : '' },
            { k: 'Description', v: metadata.descriptionStatus, extra: metadata.descriptionLength ? `${metadata.descriptionLength}ch` : '' },
            { k: 'H1', v: metadata.h1Count === 1 ? 'good' : metadata.h1Count === 0 ? 'missing' : 'multiple', extra: '' },
            { k: 'lang', v: metadata.htmlLang ? 'good' : 'missing', extra: metadata.htmlLang ?? '' },
            { k: 'Indexable', v: indexability.isIndexable ? 'good' : 'noindex', extra: '' },
            { k: 'Schema', v: structuredData.found ? 'good' : 'none', extra: structuredData.count > 0 ? `${structuredData.count}` : '' },
          ].map(({ k, v, extra }) => {
            const isGood = v === 'good';
            const dotColor = isGood ? '#16a34a' : (v === 'missing' || v === 'multiple' || v === 'noindex') ? '#dc2626' : '#d97706';
            return (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                <Text style={{ fontSize: 8, color: '#374151' }}>{k}: </Text>
                <Text style={{ fontSize: 8, color: dotColor, fontWeight: 'bold' }}>{v}{extra ? ` (${extra})` : ''}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Priority findings */}
      {priorityFindings.length > 0 && (
        <>
          <Text style={[styles.subsectionHeading, { fontSize: 10, marginBottom: 6 }]}>
            Priority Issues ({priorityFindings.length} shown)
          </Text>
          {priorityFindings.map((finding, i) => (
            <View key={i} style={styles.issueCard} wrap={false}>
              <View style={styles.issueHeader}>
                <View style={[styles.issueBadge, {
                  backgroundColor: finding.severity === 'critical' ? '#fef2f2' : finding.severity === 'high' ? '#fff7ed' : '#fffbeb',
                }]}>
                  <Text style={styles.issueBadgeText}>{finding.severity}</Text>
                </View>
                <Text style={[styles.issueTitle, { flex: 1 }]} numberOfLines={2}>{finding.title}</Text>
              </View>
              {finding.description && (
                <Text style={styles.issueDesc} numberOfLines={2}>{finding.description}</Text>
              )}
              {finding.recommendation && (
                <Text style={[styles.issueDesc, { color: '#4f46e5', marginTop: 2 }]} numberOfLines={1}>
                  → {finding.recommendation}
                </Text>
              )}
            </View>
          ))}
        </>
      )}

      {priorityFindings.length === 0 && (
        <View style={{ padding: 12, backgroundColor: '#f0fdf4', borderRadius: 6, marginTop: 8 }}>
          <Text style={{ fontSize: 10, color: '#16a34a', textAlign: 'center' }}>
            No critical or high-priority SEO issues detected.
          </Text>
        </View>
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
  const hasSeoAudit      = !!(analysis.lighthouse_scores as any)?.seoAudit;

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
      {hasSeoAudit && (
        <SEOPage
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
