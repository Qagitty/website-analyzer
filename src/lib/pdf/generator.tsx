import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
  type DocumentProps,
} from '@react-pdf/renderer';
import type { Analysis, LighthouseScores, AccessibilityIssue } from '@/types/analysis';

export interface Branding {
  agencyName?: string;
  brandColor?: string;
  showPoweredBy?: boolean;
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
    case 'lcp':  return value < 2500  ? 'Good' : 'Needs work';
    case 'cls':  return value < 0.1   ? 'Good' : 'Needs work';
    case 'ttfb': return value < 800   ? 'Good' : 'Needs work';
    case 'fid':  return value < 100   ? 'Good' : 'Needs work';
    default:     return '';
  }
}

function vitalColor(metric: string, value: number): string {
  const good = vitalLabel(metric, value) === 'Good';
  return good ? '#16a34a' : '#dc2626';
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

function impactColor(impact: string): string {
  switch (impact) {
    case 'critical': return '#dc2626';
    case 'serious':  return '#ea580c';
    case 'moderate': return '#d97706';
    default:         return '#6b7280';
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(brandColor: string) {
  return StyleSheet.create({
    page: {
      backgroundColor: '#ffffff',
      paddingTop: 40,
      paddingBottom: 40,
      paddingLeft: 40,
      paddingRight: 40,
      fontFamily: 'Helvetica',
    },

    // Header bar
    headerBar: {
      backgroundColor: brandColor,
      marginTop: -40,
      marginLeft: -40,
      marginRight: -40,
      marginBottom: 24,
      paddingTop: 20,
      paddingBottom: 20,
      paddingLeft: 40,
      paddingRight: 40,
    },
    headerAgency: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
    },
    headerTagline: {
      color: '#e0e7ff',
      fontSize: 9,
      marginTop: 2,
    },

    // Cover page
    coverUrl: {
      fontSize: 20,
      color: '#111827',
      fontFamily: 'Helvetica-Bold',
      marginBottom: 6,
      wordBreak: 'break-all',
    },
    coverSubtitle: {
      fontSize: 12,
      color: '#6b7280',
      marginBottom: 4,
    },
    coverDate: {
      fontSize: 9,
      color: '#9ca3af',
      marginBottom: 24,
    },

    // Score boxes row
    scoresRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 24,
    },
    scoreBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 6,
      paddingTop: 12,
      paddingBottom: 12,
      paddingLeft: 10,
      paddingRight: 10,
      alignItems: 'center',
    },
    scoreNumber: {
      fontSize: 28,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 2,
    },
    scoreLabel: {
      fontSize: 8,
      color: '#6b7280',
      textAlign: 'center',
    },

    // AI summary
    summaryBox: {
      backgroundColor: '#eef2ff',
      borderRadius: 6,
      padding: 14,
      marginBottom: 24,
    },
    summaryText: {
      fontSize: 10,
      color: '#312e81',
      lineHeight: 1.5,
    },

    // Footer
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 40,
      right: 40,
    },
    footerText: {
      fontSize: 8,
      color: '#9ca3af',
      textAlign: 'center',
    },

    // Section pages
    sectionHeading: {
      fontSize: 16,
      fontFamily: 'Helvetica-Bold',
      color: brandColor,
      marginBottom: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },

    // Table
    tableRow: {
      flexDirection: 'row',
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
      alignItems: 'center',
    },
    tableCell: {
      fontSize: 10,
      color: '#111827',
    },
    tableCellMuted: {
      fontSize: 10,
      color: '#6b7280',
    },
    tableCellWide: {
      flex: 2,
      fontSize: 10,
      color: '#111827',
    },

    // Vitals label badge
    vitalBadge: {
      borderRadius: 4,
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 6,
      paddingRight: 6,
    },
    vitalBadgeText: {
      fontSize: 8,
      color: '#ffffff',
      fontFamily: 'Helvetica-Bold',
    },

    // Recommendation bullet
    bulletRow: {
      flexDirection: 'row',
      marginBottom: 10,
      gap: 8,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 3,
    },
    bulletContent: {
      flex: 1,
    },
    bulletTitle: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      marginBottom: 2,
    },
    bulletText: {
      fontSize: 9,
      color: '#6b7280',
      lineHeight: 1.4,
    },

    // Issue card
    issueCard: {
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 6,
      padding: 10,
      marginBottom: 8,
    },
    issueHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      gap: 8,
    },
    issueBadge: {
      borderRadius: 4,
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 6,
      paddingRight: 6,
    },
    issueBadgeText: {
      fontSize: 7,
      color: '#ffffff',
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
    },
    issueTitle: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      flex: 1,
    },
    issueDescription: {
      fontSize: 9,
      color: '#6b7280',
      lineHeight: 1.4,
      marginBottom: 4,
    },
    issueRec: {
      fontSize: 9,
      color: '#374151',
      lineHeight: 1.4,
      backgroundColor: '#f9fafb',
      padding: 6,
      borderRadius: 4,
    },

    // Quick wins
    quickWinRow: {
      flexDirection: 'row',
      marginBottom: 6,
      gap: 8,
      alignItems: 'flex-start',
    },
    quickWinCheck: {
      fontSize: 10,
      color: '#16a34a',
      fontFamily: 'Helvetica-Bold',
    },
    quickWinText: {
      fontSize: 10,
      color: '#111827',
      flex: 1,
      lineHeight: 1.4,
    },

    // Stats row
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statBox: {
      flex: 1,
      borderRadius: 6,
      padding: 10,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 22,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
    },
    statLabel: {
      fontSize: 8,
      color: '#6b7280',
      textAlign: 'center',
    },
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeaderBar({
  styles,
  brandColor,
  agencyName,
}: {
  styles: ReturnType<typeof makeStyles>;
  brandColor: string;
  agencyName?: string;
}) {
  return (
    <View style={styles.headerBar}>
      <Text style={styles.headerAgency}>{agencyName ?? 'WebAnalyzer'}</Text>
      {agencyName && (
        <Text style={styles.headerTagline}>Website Analysis Report</Text>
      )}
    </View>
  );
}

function PageFooter({
  styles,
  showPoweredBy,
  agencyName,
}: {
  styles: ReturnType<typeof makeStyles>;
  showPoweredBy: boolean;
  agencyName?: string;
}) {
  const show = showPoweredBy || !agencyName;
  if (!show) return null;
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Generated by WebAnalyzer</Text>
    </View>
  );
}

// ─── Page 1: Cover ────────────────────────────────────────────────────────────

function CoverPage({
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
  const ls = analysis.lighthouse_scores;
  const scores = [
    { label: 'Performance',    value: ls?.performance   ?? null },
    { label: 'Accessibility',  value: ls?.accessibility ?? null },
    { label: 'SEO',            value: ls?.seo           ?? null },
    { label: 'Best Practices', value: ls?.bestPractices ?? null },
  ];

  const dateStr = analysis.completed_at
    ? new Date(analysis.completed_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : new Date(analysis.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} />

      <Text style={styles.coverUrl}>{analysis.url}</Text>
      <Text style={styles.coverSubtitle}>Website Analysis Report</Text>
      <Text style={styles.coverDate}>Analyzed on {dateStr}</Text>

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

      {analysis.ai_summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{analysis.ai_summary}</Text>
        </View>
      )}

      <PageFooter
        styles={styles}
        showPoweredBy={branding.showPoweredBy}
        agencyName={branding.agencyName}
      />
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
  ];

  const criticalIssues: Array<{ metric: string; fix: string }> =
    (analysis.ai_insights?.performance?.criticalIssues ?? []).slice(0, 3);

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} />
      <Text style={styles.sectionHeading}>Performance</Text>

      {/* Core Web Vitals table */}
      <View style={{ marginBottom: 20 }}>
        {/* Header row */}
        <View style={[styles.tableRow, { backgroundColor: '#f9fafb' }]}>
          <View style={{ flex: 2 }}>
            <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Metric</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Value</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Status</Text>
          </View>
        </View>

        {vitals.map(({ key, label }) => {
          const val = ls[key] as number;
          const fVal = formatVitalValue(key, val);
          const label2 = vitalLabel(key, val);
          const color = vitalColor(key, val);
          return (
            <View key={key} style={styles.tableRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.tableCell}>{label}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableCell}>{fVal}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.vitalBadge, { backgroundColor: color, alignSelf: 'flex-start' }]}>
                  <Text style={styles.vitalBadgeText}>{label2}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Recommendations */}
      {criticalIssues.length > 0 && (
        <View>
          <Text style={[styles.sectionHeading, { fontSize: 12, marginBottom: 12 }]}>
            Top Recommendations
          </Text>
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

      <PageFooter
        styles={styles}
        showPoweredBy={branding.showPoweredBy}
        agencyName={branding.agencyName}
      />
    </Page>
  );
}

// ─── Page 3: Accessibility ────────────────────────────────────────────────────

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

  const critical  = issues.filter((i) => i.impact === 'critical').length;
  const serious   = issues.filter((i) => i.impact === 'serious').length;
  const moderate  = issues.filter((i) => i.impact === 'moderate').length;

  // Merge AI interpreted issues if available
  const interpretedMap: Record<string, { plainEnglish?: string; fixExample?: string }> = {};
  if (aiAcc?.interpretedIssues) {
    for (const ii of aiAcc.interpretedIssues as Array<{ originalId?: string; plainEnglish?: string; fixExample?: string }>) {
      if (ii.originalId) interpretedMap[ii.originalId] = ii;
    }
  }

  const displayIssues = issues.slice(0, 5);

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} />
      <Text style={styles.sectionHeading}>Accessibility</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Critical',  count: critical,  color: '#fef2f2', border: '#fecaca' },
          { label: 'Serious',   count: serious,   color: '#fff7ed', border: '#fed7aa' },
          { label: 'Moderate',  count: moderate,  color: '#fffbeb', border: '#fde68a' },
          { label: 'Total',     count: issues.length, color: '#f9fafb', border: '#e5e7eb' },
        ].map(({ label, count, color, border }) => (
          <View key={label} style={[styles.statBox, { backgroundColor: color, borderWidth: 1, borderColor: border }]}>
            <Text style={styles.statNumber}>{count}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Issues list */}
      {displayIssues.map((issue, i) => {
        const ai = interpretedMap[issue.id];
        const description = ai?.plainEnglish ?? issue.description;
        const recommendation = ai?.fixExample ?? null;

        return (
          <View key={i} style={styles.issueCard}>
            <View style={styles.issueHeader}>
              <View style={[styles.issueBadge, { backgroundColor: impactColor(issue.impact) }]}>
                <Text style={styles.issueBadgeText}>{issue.impact}</Text>
              </View>
              <Text style={styles.issueTitle}>{issue.id}</Text>
            </View>
            <Text style={styles.issueDescription}>{description}</Text>
            {recommendation && (
              <Text style={styles.issueRec}>{recommendation}</Text>
            )}
          </View>
        );
      })}

      <PageFooter
        styles={styles}
        showPoweredBy={branding.showPoweredBy}
        agencyName={branding.agencyName}
      />
    </Page>
  );
}

// ─── Page 4: AI Insights ─────────────────────────────────────────────────────

function AIInsightsPage({
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
  const aiInsights = analysis.ai_insights!;
  const quickWins = (aiInsights.quickWins ?? []).slice(0, 5);
  const insights = (aiInsights.insights ?? []).slice(0, 4);

  return (
    <Page size="A4" style={styles.page}>
      <HeaderBar styles={styles} brandColor={brandColor} agencyName={branding.agencyName} />
      <Text style={styles.sectionHeading}>AI Recommendations</Text>

      {/* Quick wins */}
      {quickWins.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.bulletTitle, { fontSize: 11, marginBottom: 10, color: '#111827' }]}>
            Quick Wins
          </Text>
          {quickWins.map((win, i) => (
            <View key={i} style={styles.quickWinRow}>
              <Text style={styles.quickWinCheck}>✓</Text>
              <Text style={styles.quickWinText}>{win}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top insights */}
      {insights.length > 0 && (
        <View>
          <Text style={[styles.bulletTitle, { fontSize: 11, marginBottom: 10, color: '#111827' }]}>
            Top Issues
          </Text>
          {insights.map((insight, i) => (
            <View key={i} style={styles.issueCard}>
              <View style={styles.issueHeader}>
                <View style={[styles.issueBadge, { backgroundColor: priorityColor(insight.priority) }]}>
                  <Text style={styles.issueBadgeText}>{insight.priority}</Text>
                </View>
                <Text style={styles.issueTitle}>{insight.title}</Text>
              </View>
              <Text style={styles.issueRec}>{insight.recommendation}</Text>
            </View>
          ))}
        </View>
      )}

      <PageFooter
        styles={styles}
        showPoweredBy={branding.showPoweredBy}
        agencyName={branding.agencyName}
      />
    </Page>
  );
}

// ─── Main Document ────────────────────────────────────────────────────────────

function ReportDocument({
  analysis,
  branding,
}: {
  analysis: Analysis;
  branding: Required<Branding>;
}) {
  const brandColor = branding.brandColor;
  const styles = makeStyles(brandColor);

  const hasPerformance = analysis.lighthouse_scores != null;
  const hasAccessibility =
    analysis.accessibility_issues != null &&
    analysis.accessibility_issues.length > 0;
  const hasAIInsights = analysis.ai_insights != null;

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
      />
      {hasPerformance && (
        <PerformancePage
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
      {hasAIInsights && (
        <AIInsightsPage
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
  branding: Branding = {}
): Promise<Buffer> {
  const resolvedBranding: Required<Branding> = {
    agencyName:    branding.agencyName    ?? undefined as unknown as string,
    brandColor:    branding.brandColor    ?? '#6366f1',
    showPoweredBy: branding.showPoweredBy ?? true,
  };

  const element = React.createElement(ReportDocument, {
    analysis,
    branding: resolvedBranding,
  }) as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
