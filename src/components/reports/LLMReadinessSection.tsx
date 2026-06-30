'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  LlmReadinessAuditResult,
  LlmReadinessFinding,
  LlmReadinessStatus,
  LlmReadinessSeverity,
  AiCrawlerCategory,
} from '@/types/llm-readiness';

// ─── legacy fallback ──────────────────────────────────────────────────────────

interface LegacyProps {
  scores: {
    llmReadiness?: number;
    llmChecks?: Record<string, boolean>;
    llmSignals?: string[];
  };
}

const LEGACY_CHECK_LABELS: Record<string, string> = {
  hasStructuredData: 'Structured Data (JSON-LD)',
  hasMetaDescription: 'Meta Description',
  hasOpenGraph: 'Open Graph Tags',
  hasSitemap: 'Sitemap Linked',
  allowsAIBots: 'AI Bots Allowed',
  hasCleanHeadings: 'Clean Heading Structure',
  hasSufficientContent: 'Sufficient Content',
  hasCanonical: 'Canonical URL',
};
const LEGACY_ORDER = Object.keys(LEGACY_CHECK_LABELS);

function LegacyLLMReadinessSection({ scores }: LegacyProps) {
  const { llmReadiness, llmChecks, llmSignals } = scores;
  if (llmReadiness === undefined) return null;
  const checks = llmChecks ?? {};
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">AI &amp; LLM Readiness</h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
          llmReadiness >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : llmReadiness >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>{llmReadiness}/100</span>
        <Badge variant="outline" className="text-xs text-muted-foreground">Legacy result</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        This report was generated with an earlier version of the LLM Readiness audit. Re-analyze the site to get a detailed v2 report.
      </p>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {LEGACY_ORDER.map(key => {
              const passing = checks[key] ?? false;
              return (
                <li key={key} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`text-lg ${passing ? 'text-emerald-400' : 'text-red-400/40'}`}>
                    {passing ? '✓' : '✗'}
                  </span>
                  <span className={`text-sm ${passing ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {LEGACY_CHECK_LABELS[key] ?? key}
                  </span>
                  <span className={`ml-auto text-xs font-medium ${passing ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    {passing ? 'Pass' : 'Fail'}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      {llmSignals && llmSignals.length > 0 && (
        <div className="bg-card border border-orange-200 dark:border-orange-900/40 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">How to improve</p>
          <ul className="space-y-1.5">
            {llmSignals.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-orange-500 mt-0.5 shrink-0">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── v2 helpers ───────────────────────────────────────────────────────────────

function statusColor(status: LlmReadinessStatus) {
  switch (status) {
    case 'passed':        return 'text-emerald-400';
    case 'failed':        return 'text-red-400';
    case 'warning':       return 'text-amber-400';
    case 'manual-review': return 'text-blue-400';
    default:              return 'text-muted-foreground';
  }
}

function statusDot(status: LlmReadinessStatus) {
  switch (status) {
    case 'passed':        return 'bg-emerald-400';
    case 'failed':        return 'bg-red-400';
    case 'warning':       return 'bg-amber-400';
    case 'manual-review': return 'bg-blue-400';
    default:              return 'bg-muted-foreground/40';
  }
}

function statusLabel(status: LlmReadinessStatus) {
  switch (status) {
    case 'passed':        return 'Passed';
    case 'failed':        return 'Failed';
    case 'warning':       return 'Warning';
    case 'manual-review': return 'Manual review';
    case 'not-applicable':return 'N/A';
    case 'unavailable':   return 'Unavailable';
  }
}

function severityBadgeClass(sev: LlmReadinessSeverity) {
  switch (sev) {
    case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'high':     return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'medium':   return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'low':      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default:         return 'bg-muted text-muted-foreground border-border';
  }
}

function scoreBadgeClass(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground border-border';
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-red-500/10 text-red-400 border-red-500/20';
}

function crawlerCategoryLabel(cat: AiCrawlerCategory) {
  switch (cat) {
    case 'search-retrieval': return 'Search retrieval';
    case 'model-training':   return 'Model training';
    case 'answer-generation':return 'Answer generation';
    case 'user-browsing':    return 'User browsing';
    case 'general-indexing': return 'General indexing';
    default:                 return 'Unknown';
  }
}

// ─── subcomponents ────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: LlmReadinessFinding }) {
  const [open, setOpen] = useState(false);
  const isActive = finding.status === 'failed' || finding.status === 'warning';
  if (!isActive) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${statusDot(finding.status)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{finding.title}</span>
            {finding.experimental && (
              <span className="inline-flex items-center gap-1 text-xs text-orange-500 border border-orange-200 dark:border-orange-900/40 rounded px-1.5 py-0.5">
                <FlaskConical className="h-3 w-3" /> Experimental
              </span>
            )}
            <span className={`ml-auto inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border ${severityBadgeClass(finding.severity)}`}>
              {finding.severity}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{finding.description}</p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <p className="text-sm text-muted-foreground">{finding.description}</p>
          <div className="bg-background/60 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">Recommendation</p>
            <p className="text-xs text-muted-foreground">{finding.recommendation}</p>
          </div>
          {finding.evidence.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Evidence</p>
              {finding.evidence.map((ev, i) => (
                <div key={i} className="text-xs text-muted-foreground font-mono bg-background/60 rounded px-2 py-1 truncate">
                  {ev.html ?? ev.actual ?? ev.url ?? '—'}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Source: <span className="text-foreground">{finding.source}</span></span>
            <span>Confidence: <span className="text-foreground">{finding.confidence}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryBar({ label, weight, score }: { label: string; weight: number; score: number | null }) {
  const pct = weight * 100;
  const barWidth = score !== null ? score : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{pct.toFixed(0)}% weight</span>
          <span className={`font-medium ${score === null ? 'text-muted-foreground' : score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {score !== null ? `${score}/100` : 'n/a'}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${score === null ? 'bg-muted-foreground/20' : score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  scores: {
    llmReadinessAudit?: LlmReadinessAuditResult;
    llmReadiness?: number;
    llmChecks?: Record<string, boolean>;
    llmSignals?: string[];
  };
}

type FilterKey = 'all' | 'failed' | 'warning';

export function LLMReadinessSection({ scores }: Props) {
  const audit = scores.llmReadinessAudit ?? null;

  if (!audit) {
    return <LegacyLLMReadinessSection scores={scores} />;
  }

  const [filter, setFilter] = useState<FilterKey>('all');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showCrawlers, setShowCrawlers] = useState(false);

  const { findings, categoryScores, coverage, detectedSignals, warnings, score } = audit;

  const failedCount  = findings.filter(f => f.status === 'failed').length;
  const warningCount = findings.filter(f => f.status === 'warning').length;
  const passedCount  = findings.filter(f => f.status === 'passed').length;

  const visibleFindings = findings.filter(f => {
    if (filter === 'failed')  return f.status === 'failed';
    if (filter === 'warning') return f.status === 'warning';
    return f.status === 'failed' || f.status === 'warning';
  });

  const ALL_FILTERS: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all',     label: 'All issues',  count: failedCount + warningCount },
    { key: 'failed',  label: 'Failed',      count: failedCount },
    { key: 'warning', label: 'Warnings',    count: warningCount },
  ];
  const FILTERS = ALL_FILTERS.filter(f => f.count > 0 || f.key === 'all');

  const allowedCrawlers  = detectedSignals.aiCrawlerAccess.filter(c => c.allowed === true);
  const blockedCrawlers  = detectedSignals.aiCrawlerAccess.filter(c => c.allowed === false);
  const unknownCrawlers  = detectedSignals.aiCrawlerAccess.filter(c => c.allowed === null);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">AI &amp; LLM Readiness</h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${scoreBadgeClass(score)}`}>
          {score !== null ? `${score}/100` : 'n/a'}
        </span>
        <span className="text-xs text-muted-foreground">
          Coverage {coverage.percentage}%
        </span>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {audit.scoreVersion} · {audit.auditMode}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        This score evaluates technical and content signals that <em>may</em> help AI systems crawl, parse, understand, and cite public website content.
        It does not guarantee inclusion, ranking, citation, or visibility in any AI product.
      </p>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-300">{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {failedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            {failedCount} failed
          </span>
        )}
        {warningCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {warningCount} warnings
          </span>
        )}
        {passedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {passedCount} passed
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-muted-foreground">
          {coverage.executedSignals}/{coverage.supportedSignals} signals checked
        </span>
      </div>

      {/* Detected signals summary */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detected Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
            {[
              { label: 'HTTPS',            value: detectedSignals.isHttps ? 'Yes' : 'No',         good: detectedSignals.isHttps },
              { label: 'Structured data',  value: detectedSignals.hasJsonLd ? `Yes (${detectedSignals.schemaTypes.slice(0,3).join(', ') || '—'})` : 'None', good: detectedSignals.hasJsonLd },
              { label: 'Canonical URL',    value: detectedSignals.hasCanonical ? 'Present' : 'Missing', good: detectedSignals.hasCanonical },
              { label: 'Meta description', value: detectedSignals.hasMetaDescription ? `${detectedSignals.metaDescriptionLength} chars` : 'Missing', good: detectedSignals.hasMetaDescription },
              { label: 'Open Graph',       value: detectedSignals.hasOpenGraph ? 'Present' : 'Missing', good: detectedSignals.hasOpenGraph },
              { label: 'H1 headings',      value: String(detectedSignals.h1Count), good: detectedSignals.h1Count === 1 },
              { label: 'Raw text length',  value: `${detectedSignals.rawTextLength.toLocaleString()} chars`, good: detectedSignals.rawTextLength >= 300 },
              { label: 'Author signal',    value: detectedSignals.hasAuthorSignal ? 'Detected' : 'None', good: detectedSignals.hasAuthorSignal },
              { label: 'Date signal',      value: detectedSignals.hasDateSignal ? 'Detected' : 'None', good: detectedSignals.hasDateSignal },
              { label: 'Main landmark',    value: detectedSignals.hasMainLandmark ? 'Present' : 'Missing', good: detectedSignals.hasMainLandmark },
              { label: 'robots.txt',       value: detectedSignals.robotsTxtFetched ? 'Fetched' : 'Not fetched', good: detectedSignals.robotsTxtFetched },
              { label: 'llms.txt',         value: detectedSignals.llmsTxtStatus === 'found' ? 'Found' : 'Not found', good: detectedSignals.llmsTxtStatus === 'found' },
            ].map(({ label, value, good }) => (
              <div key={label} className="flex items-center justify-between gap-2 py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-medium text-right ${good ? 'text-emerald-400' : 'text-muted-foreground'}`}>{value}</span>
              </div>
            ))}
          </div>
          {detectedSignals.pageType !== 'unknown' && (
            <p className="mt-3 text-xs text-muted-foreground">
              Detected page type: <span className="text-foreground capitalize">{detectedSignals.pageType}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Category score breakdown */}
      <Card className="bg-card border-border">
        <button
          onClick={() => setShowBreakdown(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors rounded-xl"
        >
          <span className="text-sm font-semibold text-foreground">Score by Category</span>
          {showBreakdown
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showBreakdown && (
          <CardContent className="pt-0 space-y-3">
            {categoryScores
              .filter(c => c.weight > 0)
              .sort((a, b) => b.weight - a.weight)
              .map(c => (
                <CategoryBar key={c.category} label={c.label} weight={c.weight} score={c.score} />
              ))}
          </CardContent>
        )}
      </Card>

      {/* AI Crawler access */}
      <Card className="bg-card border-border">
        <button
          onClick={() => setShowCrawlers(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">AI Crawler Access</span>
            <span className="text-xs text-muted-foreground">
              {blockedCrawlers.length > 0
                ? `${blockedCrawlers.length} blocked · ${allowedCrawlers.length} allowed`
                : allowedCrawlers.length > 0
                  ? `All ${allowedCrawlers.length} checked allowed`
                  : `${unknownCrawlers.length} unknown`}
            </span>
          </div>
          {showCrawlers
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showCrawlers && (
          <CardContent className="pt-0 space-y-2">
            <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2">
              Crawler names and behaviors change over time. Access status does not guarantee use, indexing, or inclusion by any provider.
              Blocking training crawlers while allowing search-retrieval crawlers is a valid business choice.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-1.5 font-medium">Crawler</th>
                    <th className="text-left py-1.5 font-medium">Provider</th>
                    <th className="text-left py-1.5 font-medium">Category</th>
                    <th className="text-left py-1.5 font-medium">Status</th>
                    <th className="text-left py-1.5 font-medium">Matched rule</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedSignals.aiCrawlerAccess.map(c => (
                    <tr key={c.userAgent} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 font-mono text-foreground">{c.crawlerName}</td>
                      <td className="py-1.5 text-muted-foreground">{c.provider}</td>
                      <td className="py-1.5 text-muted-foreground">{crawlerCategoryLabel(c.category)}</td>
                      <td className="py-1.5">
                        {c.allowed === null
                          ? <span className="text-muted-foreground">Unknown</span>
                          : c.allowed
                            ? <span className="text-emerald-400">Allowed</span>
                            : <span className="text-amber-400">Blocked</span>}
                      </td>
                      <td className="py-1.5 font-mono text-muted-foreground truncate max-w-[180px]">
                        {c.matchedRule ?? (c.allowed === null ? '—' : 'default')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Findings */}
      {(failedCount + warningCount) > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">Findings</h3>
            <div className="flex gap-1.5 ml-auto">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                    filter === f.key
                      ? 'bg-orange-100 dark:bg-orange-950/40 border-orange-400 dark:border-orange-800 text-orange-400'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {visibleFindings.map(f => <FindingCard key={f.id} finding={f} />)}
          </div>
        </div>
      )}

      {/* Coverage notice */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Audit mode:</strong> fetch-only. Rendered-DOM comparison and JavaScript-executed content checks are unavailable without browser infrastructure.</p>
          {coverage.limitations.slice(0, 2).map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </div>
    </section>
  );
}
