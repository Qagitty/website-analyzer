'use client';

import { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, MinusCircle,
  ChevronDown, ChevronUp, Globe, Zap, Monitor, Clock,
  FileCode2, FileImage, Type, Info, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreGauge } from '@/components/reports/ScoreGauge';
import type { LighthouseScores, ResourceAudit } from '@/types/analysis';
import type {
  PerformanceMetric,
  MetricStatus,
  PerformanceScoreBreakdown,
  PerformanceOpportunity,
  DetectedResource,
} from '@/types/performance';

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_ORDER = ['ttfb', 'lcp', 'cls', 'tbt', 'fcp', 'inp'] as const;

const QUICK_WIN_IDS = new Set([
  'images-missing-lazy-loading', 'images-missing-dimensions',
  'missing-font-display', 'missing-preconnect', 'above-fold-lazy-image',
  'missing-font-preload',
]);
const MEDIUM_EFFORT_IDS = new Set([
  'images-legacy-format', 'images-missing-srcset',
  'render-blocking-stylesheets', 'missing-compression', 'poor-cache-headers',
  'large-inline-scripts',
]);
// Everything else → engineering work (TTFB, large HTML, render-blocking scripts, third-party)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function truncateUrl(url: string, max = 55): string {
  try {
    const u = new URL(url);
    const full = u.hostname + u.pathname;
    return full.length <= max ? full : full.slice(0, max - 1) + '…';
  } catch {
    return url.length > max ? url.slice(0, max - 1) + '…' : url;
  }
}

function classifyThirdParty(domain: string): string {
  const d = domain.toLowerCase();
  if (/googletagmanager|google-analytics|segment|heap|mixpanel|hotjar|amplitude|matomo|plausible/.test(d)) return 'Analytics';
  if (/fonts\.googleapis|fonts\.gstatic|typekit|fonts\.bunny/.test(d)) return 'Web Fonts';
  if (/cdn\.jsdelivr|cdnjs\.cloudflare|unpkg\.com|skypack/.test(d)) return 'CDN';
  if (/facebook\.com|connect\.facebook|twitter\.com|linkedin\.com/.test(d)) return 'Social';
  if (/doubleclick|googlesyndication|adservice|adsense|googleads/.test(d)) return 'Advertising';
  if (/stripe\.com|paypal\.com|braintree|checkout\.com/.test(d)) return 'Payments';
  if (/intercom\.io|crisp\.chat|tawk\.to|zopim|zendesk/.test(d)) return 'Chat';
  if (/youtube\.com|vimeo\.com|wistia\.com/.test(d)) return 'Video';
  return 'Other';
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MetricStatus, {
  icon: React.ElementType;
  label: string;
  textClass: string;
  borderClass: string;
}> = {
  'good':              { icon: CheckCircle2,  label: 'Good',             textClass: 'text-emerald-500',         borderClass: 'border-emerald-500/20'   },
  'needs-improvement': { icon: AlertTriangle, label: 'Needs improvement', textClass: 'text-amber-500',           borderClass: 'border-amber-500/20'     },
  'poor':              { icon: XCircle,       label: 'Poor',             textClass: 'text-red-500',             borderClass: 'border-red-500/20'       },
  'unavailable':       { icon: MinusCircle,   label: 'Not measured',     textClass: 'text-muted-foreground/40', borderClass: 'border-border opacity-60' },
};

const CONFIDENCE_CLASS: Record<string, string> = {
  high:   'text-emerald-500/70',
  medium: 'text-amber-500/70',
  low:    'text-orange-500/70',
  none:   'text-muted-foreground/40',
};

const SOURCE_LABEL: Record<string, string> = {
  'browser-lab':  'Browser lab',
  'fetch-timing': 'HTTP fetch timing',
  'estimated':    'Estimated (heuristic)',
  'not-measured': 'Not measured',
};

// ─── MetricCard ───────────────────────────────────────────────────────────────

function formatMetricValue(metric: PerformanceMetric): string {
  if (metric.value == null) return 'N/A';
  if (metric.unit === 'ms') return metric.value >= 1000 ? `${(metric.value / 1000).toFixed(1)} s` : `${metric.value} ms`;
  if (metric.unit === 'score') return metric.value.toFixed(metric.value < 1 ? 2 : 0);
  return String(metric.value);
}

function formatThreshold(t: PerformanceMetric['threshold']): string | null {
  if (!t) return null;
  const v = t.good;
  if (t.unit === 'ms') return v >= 1000 ? `${v / 1000} s` : `${v} ms`;
  return String(v);
}

function MetricCard({ metric }: { metric: PerformanceMetric }) {
  const { borderClass, textClass } = STATUS_CONFIG[metric.status];
  const value = formatMetricValue(metric);
  const threshold = formatThreshold(metric.threshold);

  return (
    <article
      className={`rounded-xl border p-4 bg-card space-y-2.5 ${borderClass}`}
      aria-label={`${metric.name}: ${value}, ${STATUS_CONFIG[metric.status].label}`}
    >
      <div className="flex items-start justify-between gap-2 min-h-[1.75rem]">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{metric.name}</p>
        <div className={`flex items-center gap-1 text-xs font-medium ${STATUS_CONFIG[metric.status].textClass}`} aria-label={`Status: ${STATUS_CONFIG[metric.status].label}`}>
          {(() => { const { icon: Icon } = STATUS_CONFIG[metric.status]; return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />; })()}
          <span>{STATUS_CONFIG[metric.status].label}</span>
        </div>
      </div>

      <p className={`text-2xl font-bold tabular-nums leading-none ${metric.status === 'unavailable' ? 'text-muted-foreground/30' : 'text-foreground'}`}>
        {value}
      </p>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{metric.description}</p>

      {threshold && (
        <p className="text-xs text-muted-foreground/60">
          Target ≤ <span className={`font-medium ${textClass}`}>{threshold}</span>
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap border-t border-border/40 pt-2" aria-label={`Source: ${SOURCE_LABEL[metric.source]}, confidence: ${metric.confidence}`}>
        <span className={`text-[10px] font-semibold ${CONFIDENCE_CLASS[metric.confidence]}`}>
          {metric.confidence.charAt(0).toUpperCase() + metric.confidence.slice(1)} confidence
        </span>
        <span className="text-[10px] text-muted-foreground/30" aria-hidden>·</span>
        <span className="text-[10px] text-muted-foreground/50">Source: {SOURCE_LABEL[metric.source]}</span>
      </div>
    </article>
  );
}

// ─── LegacyMetrics: fallback for old reports without performanceAudit ─────────

function LegacyMetrics({ scores }: { scores: LighthouseScores }) {
  const rows = [
    { label: 'TTFB', value: scores.ttfb != null ? fmtMs(scores.ttfb) : 'N/A', source: 'HTTP fetch', confidence: 'high', status: scores.ttfb != null ? (scores.ttfb < 800 ? 'good' : scores.ttfb < 1800 ? 'needs-improvement' : 'poor') as MetricStatus : 'unavailable' as MetricStatus },
    { label: 'LCP', value: scores.estimatedLcp != null ? `~${fmtMs(scores.estimatedLcp)}` : scores.lcp != null ? `~${fmtMs(scores.lcp)}` : 'N/A', source: 'Estimated', confidence: 'low', status: (scores.estimatedLcp ?? scores.lcp) != null ? ((scores.estimatedLcp ?? scores.lcp)! < 2500 ? 'good' : (scores.estimatedLcp ?? scores.lcp)! < 4000 ? 'needs-improvement' : 'poor') as MetricStatus : 'unavailable' as MetricStatus },
    { label: 'CLS', value: 'N/A', source: 'Not measured', confidence: 'none', status: 'unavailable' as MetricStatus },
    { label: 'FCP', value: 'N/A', source: 'Not measured', confidence: 'none', status: 'unavailable' as MetricStatus },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">Core Metrics</h3>
        <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px]">Legacy — limited data</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map(row => {
          const cfg = STATUS_CONFIG[row.status];
          const Icon = cfg.icon;
          return (
            <div key={row.label} className={`rounded-xl border p-3 bg-card space-y-1 ${cfg.borderClass}`}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{row.label}</p>
              <p className={`text-xl font-bold tabular-nums ${row.status === 'unavailable' ? 'text-muted-foreground/30' : 'text-foreground'}`}>{row.value}</p>
              <div className={`flex items-center gap-1 text-xs ${cfg.textClass}`}>
                <Icon className="h-3 w-3 shrink-0" aria-hidden /><span>{cfg.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/40">Source: {row.source}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Performance Overview ─────────────────────────────────────────────────────

function PerformanceOverview({
  scores, analysisUrl, completedAt,
}: { scores: LighthouseScores; analysisUrl?: string; completedAt?: string }) {
  const isFetchOnly = !scores.measurementMode || scores.measurementMode === 'fetch-only';
  const isLegacy = !scores.performanceAudit && !scores.measurementMode;
  const variance = scores.performanceVariance ?? 0;
  const stabilityLabel = variance < 200 ? 'High' : variance < 600 ? 'Medium' : 'Low';
  const stabilityClass = variance < 200 ? 'text-emerald-500' : variance < 600 ? 'text-amber-500' : 'text-red-500';

  const overallConfidence = isFetchOnly ? 'Medium (fetch-only)' : 'High';
  const deviceProfile = 'Desktop (1440 × 900)';
  const modeLabel = isFetchOnly ? 'Fetch-only  (no real browser)' : 'Browser lab';

  return (
    <Card className="bg-card border border-border">
      <CardContent className="pt-5 pb-5">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Score gauge */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ScoreGauge score={scores.performance} label="Performance" size="lg" showLabel />
            {isLegacy && (
              <Badge className="text-[9px] bg-muted text-muted-foreground border border-border">Legacy result</Badge>
            )}
          </div>

          {/* Meta grid */}
          <div className="flex-1 grid grid-cols-1 xs:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            <MetaRow label="Measurement mode" value={modeLabel} valueClass={isFetchOnly ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500'} />
            <MetaRow label="Device profile" value={deviceProfile} icon={<Monitor className="h-3 w-3" />} />
            {analysisUrl && (
              <MetaRow label="Tested URL" value={truncateUrl(analysisUrl)} title={analysisUrl} valueClass="font-mono text-xs" />
            )}
            {completedAt && (
              <MetaRow label="Measured" value={new Date(completedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} icon={<Clock className="h-3 w-3" />} />
            )}
            <MetaRow label="Overall confidence" value={overallConfidence} valueClass={isFetchOnly ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500'} />
            {scores.ttfbSamples && scores.ttfbSamples.length === 3 && (
              <MetaRow
                label="TTFB stability"
                value={`${stabilityLabel} (${scores.ttfbSamples[0]}/${scores.ttfbSamples[1]}/${scores.ttfbSamples[2]} ms)`}
                valueClass={stabilityClass}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaRow({ label, value, valueClass, icon, title }: {
  label: string; value: string; valueClass?: string; icon?: React.ReactNode; title?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground/50">{icon}</span>}
        <p className={`text-xs font-medium text-foreground break-all ${valueClass ?? ''}`} title={title}>{value}</p>
      </div>
    </div>
  );
}

// ─── Score gauges strip (other categories) ────────────────────────────────────

function ScoreStrip({ scores }: { scores: LighthouseScores }) {
  const items = [
    { label: 'Accessibility', value: scores.accessibility },
    { label: 'Best Practices', value: scores.bestPractices },
    { label: 'SEO', value: scores.seo },
  ];
  return (
    <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
      {items.map(({ label, value }) => (
        <ScoreGauge key={label} score={value} label={label} size="md" showLabel />
      ))}
    </div>
  );
}

// ─── Main Findings (compact, critical + high only) ────────────────────────────

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-amber-500',
  medium:   'bg-blue-500',
  low:      'bg-muted-foreground/40',
};

function MainFindings({ opportunities }: { opportunities: PerformanceOpportunity[] }) {
  const urgent = opportunities.filter(o => o.severity === 'critical' || o.severity === 'high');
  if (urgent.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-foreground">Main Findings</h3>
        <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 text-xs">{urgent.length} urgent</Badge>
      </div>
      <div className="space-y-2">
        {urgent.map(opp => (
          <div key={opp.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${SEVERITY_DOT[opp.severity] ?? 'bg-muted-foreground/40'}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{opp.title}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${CONFIDENCE_CLASS[opp.confidence]}`}>
                  {opp.confidence} confidence
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{opp.description}</p>
              {opp.evidence.length > 0 && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono line-clamp-1">{opp.evidence[0]}</p>
              )}
            </div>
            {opp.estimatedSavingsMs != null && (
              <span className="text-[10px] shrink-0 bg-orange-50 dark:bg-orange-950/30 text-orange-500 border border-orange-200 dark:border-orange-900/40 rounded px-1.5 py-0.5 self-start">
                ~{fmtMs(opp.estimatedSavingsMs)} saving
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Resource Summary ─────────────────────────────────────────────────────────

function ResourceSummaryInline({ resourceAudit, htmlBytes }: { resourceAudit: ResourceAudit; htmlBytes?: number }) {
  const [expanded, setExpanded] = useState(false);
  const PAGE_SIZE = 5;

  const detectedResources: DetectedResource[] = (resourceAudit as any).detectedResources ?? [];
  const visibleResources = expanded ? detectedResources : detectedResources.slice(0, PAGE_SIZE);

  const lazyPct = resourceAudit.totalImages > 0
    ? Math.round((resourceAudit.lazyImages / resourceAudit.totalImages) * 100)
    : null;

  const stats = [
    { label: 'HTML size',   value: htmlBytes != null ? fmtBytes(htmlBytes) : '—',  warn: htmlBytes != null && htmlBytes > 300_000 },
    { label: 'Scripts',     value: String(resourceAudit.totalScripts ?? 0),          warn: (resourceAudit.totalScripts ?? 0) > 20 },
    { label: 'Stylesheets', value: String(resourceAudit.totalStylesheets ?? 0),     warn: false },
    { label: 'Images',      value: String(resourceAudit.totalImages ?? 0),           warn: false },
    { label: 'Lazy images', value: lazyPct != null ? `${lazyPct}%` : '—',           warn: lazyPct != null && lazyPct < 40 && (resourceAudit.totalImages ?? 0) > 3 },
    { label: '3rd-party',   value: `${resourceAudit.thirdParty?.length ?? 0} domains`, warn: (resourceAudit.thirdParty?.length ?? 0) > 5 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-foreground">Resource Summary</h3>
        <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Resource counts are parsed from HTML. Sub-resource sizes require a real browser.">
          Fetch-only · counts from HTML
        </Badge>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-2.5 space-y-1 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums ${s.warn ? 'text-amber-500' : 'text-foreground'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sub-resource sizes not available notice */}
      <p className="text-[10px] text-muted-foreground/40">
        JS/CSS/image/font byte sizes are not available in fetch-only mode — use Lighthouse or WebPageTest for a full resource waterfall.
      </p>

      {/* Largest resources table */}
      {detectedResources.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Detected Resources</span>
            <span className="text-[10px] text-muted-foreground/50">{detectedResources.length} found · sizes require browser</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" role="table" aria-label="Detected resources">
              <thead className="bg-muted/20">
                <tr>
                  <th scope="col" className="text-left px-3 py-2 font-semibold text-muted-foreground">Resource</th>
                  <th scope="col" className="text-left px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap">Type</th>
                  <th scope="col" className="text-center px-2 py-2 font-semibold text-muted-foreground">Blocking</th>
                  <th scope="col" className="text-center px-2 py-2 font-semibold text-muted-foreground">3rd pty</th>
                  <th scope="col" className="text-left px-2 py-2 font-semibold text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {visibleResources.map((r, i) => {
                  const notes: string[] = [];
                  if (r.type === 'image') {
                    if (!r.hasWidth || !r.hasHeight) notes.push('Missing dimensions');
                    if (!r.hasLazy) notes.push('No lazy loading');
                    if (!r.hasModernFormat) notes.push('Legacy format');
                  }
                  return (
                    <tr key={i} className={r.isRenderBlocking ? 'bg-amber-500/5' : ''}>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground max-w-[240px] truncate" title={r.url}>
                        {truncateUrl(r.url, 50)}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground/60 whitespace-nowrap">{r.type}</td>
                      <td className="px-2 py-1.5 text-center">
                        {r.isRenderBlocking
                          ? <span className="text-amber-500 text-[10px] font-semibold">Yes</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r.isThirdParty
                          ? <span className="text-blue-500 text-[10px] font-semibold">Yes</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {notes.length > 0
                          ? <span className="text-[10px] text-amber-600 dark:text-amber-400">{notes.join(' · ')}</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {detectedResources.length > PAGE_SIZE && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/10 hover:bg-muted/30"
            >
              {expanded
                ? <><ChevronUp className="h-3 w-3" /> Show fewer</>
                : <><ChevronDown className="h-3 w-3" /> Show all {detectedResources.length} resources</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Third-party Impact ───────────────────────────────────────────────────────

function ThirdPartyImpact({ thirdParty, renderBlocking }: {
  thirdParty: { domain: string; count: number; types: string[] }[];
  renderBlocking: { url: string; type: string }[];
}) {
  if (thirdParty.length === 0) return null;
  const blockingDomains = new Set(renderBlocking.map(r => { try { return new URL(r.url).hostname; } catch { return ''; } }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">Third-party Impact</h3>
        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">{thirdParty.length} domains</Badge>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" role="table" aria-label="Third-party domains">
            <thead className="bg-muted/30">
              <tr>
                <th scope="col" className="text-left px-3 py-2 font-semibold text-muted-foreground">Domain</th>
                <th scope="col" className="text-left px-3 py-2 font-semibold text-muted-foreground">Category</th>
                <th scope="col" className="text-center px-3 py-2 font-semibold text-muted-foreground">Requests</th>
                <th scope="col" className="text-left px-3 py-2 font-semibold text-muted-foreground">Types</th>
                <th scope="col" className="text-center px-3 py-2 font-semibold text-muted-foreground">Blocking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {thirdParty.map(tp => {
                const isBlocking = blockingDomains.has(tp.domain);
                return (
                  <tr key={tp.domain} className={isBlocking ? 'bg-amber-500/5' : ''}>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{tp.domain}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/70">
                        {classifyThirdParty(tp.domain)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground/70">{tp.count}</td>
                    <td className="px-3 py-2 text-muted-foreground/50 text-[10px]">{tp.types.join(', ')}</td>
                    <td className="px-3 py-2 text-center">
                      {isBlocking
                        ? <span className="text-amber-500 font-semibold text-[10px]">Yes</span>
                        : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/40">
        Each third-party domain requires a separate DNS lookup, TCP handshake, and TLS negotiation before the first request can be sent.
        Blocking third-party scripts delay first render directly.
      </p>
    </div>
  );
}

// ─── Recommended Actions ──────────────────────────────────────────────────────

function ActionList({ items, icon, emptyText }: { items: PerformanceOpportunity[]; icon: React.ReactNode; emptyText: string }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground/50 italic">{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {items.map(opp => (
        <li key={opp.id} className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug">{opp.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opp.recommendation}</p>
            {opp.estimatedSavingsMs != null && (
              <p className="text-[10px] text-orange-500 mt-0.5">~{fmtMs(opp.estimatedSavingsMs)} potential saving</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecommendedActions({ opportunities }: { opportunities: PerformanceOpportunity[] }) {
  const [tab, setTab] = useState<'quick' | 'medium' | 'engineering'>('quick');

  const quickWins = opportunities.filter(o => QUICK_WIN_IDS.has(o.id));
  const mediumEffort = opportunities.filter(o => MEDIUM_EFFORT_IDS.has(o.id));
  const engineeringWork = opportunities.filter(o => !QUICK_WIN_IDS.has(o.id) && !MEDIUM_EFFORT_IDS.has(o.id));

  const tabs = [
    { id: 'quick' as const, label: 'Quick Wins', count: quickWins.length, icon: <Zap className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> },
    { id: 'medium' as const, label: 'Medium Effort', count: mediumEffort.length, icon: <Info className="h-3.5 w-3.5 text-amber-500" aria-hidden /> },
    { id: 'engineering' as const, label: 'Engineering', count: engineeringWork.length, icon: <Shield className="h-3.5 w-3.5 text-orange-500" aria-hidden /> },
  ];

  const current = tab === 'quick' ? quickWins : tab === 'medium' ? mediumEffort : engineeringWork;
  const currentIcon = tab === 'quick'
    ? <Zap className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
    : tab === 'medium'
    ? <Info className="h-3.5 w-3.5 text-amber-500" aria-hidden />
    : <Shield className="h-3.5 w-3.5 text-orange-500" aria-hidden />;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground">Recommended Actions</h3>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-1" role="tablist" aria-label="Action categories">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count > 0 && (
              <span className={`rounded-full px-1 text-[10px] font-bold ${tab === t.id ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-500' : 'bg-muted text-muted-foreground/60'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab}>
        {tab === 'quick' && <p className="text-xs text-muted-foreground/60 mb-3">Low effort, high confidence — these can typically be addressed in under 30 minutes.</p>}
        {tab === 'medium' && <p className="text-xs text-muted-foreground/60 mb-3">Moderate effort — typically 1–4 hours each, often involving tooling or build configuration.</p>}
        {tab === 'engineering' && <p className="text-xs text-muted-foreground/60 mb-3">Architectural changes — require server configuration, infrastructure, or significant code refactoring. Test in staging first.</p>}
        <ActionList items={current} icon={currentIcon} emptyText="No items in this category." />
      </div>
    </div>
  );
}

// ─── Technical Details (expandable) ──────────────────────────────────────────

function TechnicalDetails({
  scores, breakdown, warnings,
}: {
  scores: LighthouseScores;
  breakdown?: PerformanceScoreBreakdown[];
  warnings?: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
        aria-controls="perf-technical-details"
      >
        <span>Technical Details</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
      </button>

      {open && (
        <div id="perf-technical-details" className="px-4 pb-4 space-y-5 border-t border-border">
          {/* Warnings / limitations */}
          {warnings && warnings.length > 0 && (
            <div className="pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Measurement Limitations</p>
              <ul className="space-y-1.5">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <Info className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" aria-hidden />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Score breakdown */}
          {breakdown && breakdown.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score Calculation</p>
              <p className="text-xs text-muted-foreground/60">Each factor is normalized 0–100, multiplied by its weight, then summed.</p>
              {breakdown.map(item => {
                const norm = item.normalizedScore ?? 0;
                const barColor = norm >= 80 ? 'bg-emerald-500' : norm >= 50 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-foreground/80">{item.category}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-muted-foreground/50">{(item.weight * 100).toFixed(0)}% weight</span>
                        <span className="text-xs font-bold text-foreground w-6 text-right">{item.normalizedScore ?? '–'}</span>
                      </div>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={norm} aria-valuemin={0} aria-valuemax={100}>
                      <div className={`h-1 rounded-full ${barColor}`} style={{ width: `${norm}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">{item.reason}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Raw values table */}
          <div className="space-y-2 pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Raw Values</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                { label: 'Score version', value: scores.scoreVersion ?? '—' },
                { label: 'Measurement mode', value: scores.measurementMode ?? 'fetch-only' },
                { label: 'TTFB (median)', value: scores.ttfb != null ? `${scores.ttfb} ms` : '—' },
                { label: 'Est. LCP', value: scores.estimatedLcp != null ? `~${scores.estimatedLcp} ms` : '—' },
                { label: 'TTFB variance', value: scores.performanceVariance != null ? `±${scores.performanceVariance} ms` : '—' },
                { label: 'LLM Readiness', value: scores.llmReadiness != null ? `${scores.llmReadiness}/100` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded border border-border bg-card p-2">
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">{label}</p>
                  <p className="font-mono font-medium text-foreground/80 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PerformanceSectionProps {
  scores: LighthouseScores;
  resourceAudit?: ResourceAudit | null;
  htmlBytes?: number | null;
  analysisUrl?: string;
  completedAt?: string;
}

export function PerformanceSection({ scores, resourceAudit, htmlBytes, analysisUrl, completedAt }: PerformanceSectionProps) {
  const isFetchOnly = !scores.measurementMode || scores.measurementMode === 'fetch-only';
  const audit = scores.performanceAudit;
  const opportunities: PerformanceOpportunity[] = (scores as any).opportunities ?? [];
  const breakdown: PerformanceScoreBreakdown[] | undefined = audit?.scoreBreakdown;
  const warnings: string[] | undefined = audit?.warnings;

  return (
    <section className="space-y-6" aria-labelledby="performance-heading">
      {/* Section heading */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 id="performance-heading" className="text-2xl font-bold text-foreground">Performance</h2>
        {isFetchOnly && (
          <Badge
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs"
            title="Analysis uses HTTP fetch and HTML parsing only. No real browser. LCP is estimated; CLS, TBT, FCP, INP are unavailable."
          >
            Fetch-only · No browser
          </Badge>
        )}
        {scores.scoreVersion && (
          <span className="text-xs text-muted-foreground/50">score {scores.scoreVersion}</span>
        )}
      </div>

      {/* 1. Performance Overview */}
      <PerformanceOverview scores={scores} analysisUrl={analysisUrl} completedAt={completedAt} />

      {/* Other category scores */}
      <ScoreStrip scores={scores} />

      {/* 2. Core Metrics */}
      {audit ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">Core Metrics</h3>
            {isFetchOnly && (
              <p className="text-xs text-muted-foreground/60">TTFB is real · LCP is estimated · CLS/TBT/FCP/INP unavailable</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {METRIC_ORDER.map(key => (
              <MetricCard key={key} metric={audit.metrics[key]} />
            ))}
          </div>
        </div>
      ) : (
        <LegacyMetrics scores={scores} />
      )}

      {/* 3. Main Findings */}
      {opportunities.length > 0 && <MainFindings opportunities={opportunities} />}

      {/* 4. Resource Summary + Largest Resources */}
      {resourceAudit && (
        <ResourceSummaryInline
          resourceAudit={resourceAudit}
          htmlBytes={htmlBytes ?? undefined}
        />
      )}

      {/* 5. Third-party Impact */}
      {resourceAudit && (resourceAudit.thirdParty?.length ?? 0) > 0 && (
        <ThirdPartyImpact
          thirdParty={resourceAudit.thirdParty}
          renderBlocking={resourceAudit.renderBlocking}
        />
      )}

      {/* 6. Recommended Actions */}
      {opportunities.length > 0 && <RecommendedActions opportunities={opportunities} />}

      {/* 7. Technical Details (expandable) */}
      <TechnicalDetails scores={scores} breakdown={breakdown} warnings={warnings} />

      {/* Fetch-only disclaimer */}
      {isFetchOnly && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs space-y-1">
          <p className="font-semibold text-amber-600 dark:text-amber-400">Lab data · Field data: Unavailable</p>
          <p className="text-muted-foreground/70">
            TTFB is a real measurement (median of 3 HTTP requests from a Cloudflare edge node).
            LCP is a static estimate based on TTFB + HTML size — treat it as directional only.
            CLS, TBT, FCP, and INP cannot be measured without a real browser.
            For accurate Core Web Vitals run <strong>Lighthouse</strong> in Chrome DevTools or use <strong>WebPageTest</strong>.
          </p>
        </div>
      )}
    </section>
  );
}
