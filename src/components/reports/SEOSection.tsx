'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Info, Eye, Globe, FileSearch, Shield, Smartphone, Link2, Database, Share2 } from 'lucide-react';
import type { ScoreCheckItem } from '@/types/analysis';
import type { SeoAuditResult, SeoFinding, SeoFindingStatus, SeoSeverity, SeoCategory } from '@/types/seo';

// ─── Legacy fallback (old reports with only 7-check scoreBreakdown) ───────────

interface LegacySeoProps {
  score: number;
  checks: ScoreCheckItem[];
}

function LegacySEOSection({ score, checks }: LegacySeoProps) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-foreground">SEO</h2>
        <span className={`text-3xl font-black ${color}`}>{score}</span>
        <Badge variant="outline" className="text-xs text-muted-foreground">Legacy score</Badge>
      </div>
      <Card className="border-border bg-card">
        <CardContent className="pt-4 space-y-2">
          {checks.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {c.passed
                ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              }
              <div>
                <span className={c.passed ? 'text-foreground' : 'text-foreground font-medium'}>{c.label}</span>
                {c.details && <p className="text-muted-foreground text-xs mt-0.5">{c.details}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  seoAudit?: SeoAuditResult | null;
  legacyScore?: number;
  legacyChecks?: ScoreCheckItem[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<SeoFindingStatus, React.ReactNode> = {
  'passed':        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
  'failed':        <XCircle className="h-4 w-4 text-red-400 shrink-0" />,
  'warning':       <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />,
  'manual-review': <Eye className="h-4 w-4 text-blue-400 shrink-0" />,
  'unavailable':   <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />,
  'not-applicable':<Info className="h-4 w-4 text-muted-foreground shrink-0" />,
};

const STATUS_BADGE_CLS: Record<SeoFindingStatus, string> = {
  'passed':        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  'failed':        'bg-red-500/10 text-red-400 border border-red-500/20',
  'warning':       'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  'manual-review': 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'unavailable':   'bg-secondary text-muted-foreground border border-border',
  'not-applicable':'bg-secondary text-muted-foreground border border-border',
};

const SEV_BADGE_CLS: Record<SeoSeverity, string> = {
  critical: 'bg-red-500/10 text-red-300 border border-red-500/20 text-xs',
  high:     'bg-orange-500/10 text-orange-300 border border-orange-500/20 text-xs',
  medium:   'bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs',
  low:      'bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs',
  info:     'bg-secondary text-muted-foreground border border-border text-xs',
};

const CATEGORY_ICON: Record<SeoCategory, React.ReactNode> = {
  metadata:         <FileSearch className="h-3.5 w-3.5" />,
  indexability:     <Shield className="h-3.5 w-3.5" />,
  canonical:        <Link2 className="h-3.5 w-3.5" />,
  hreflang:         <Globe className="h-3.5 w-3.5" />,
  headings:         <span className="text-xs font-bold">H</span>,
  'structured-data':<Database className="h-3.5 w-3.5" />,
  'internal-links': <Link2 className="h-3.5 w-3.5" />,
  crawlability:     <Globe className="h-3.5 w-3.5" />,
  images:           <FileSearch className="h-3.5 w-3.5" />,
  social:           <Share2 className="h-3.5 w-3.5" />,
  url:              <Link2 className="h-3.5 w-3.5" />,
  mobile:           <Smartphone className="h-3.5 w-3.5" />,
  content:          <FileSearch className="h-3.5 w-3.5" />,
  other:            <Info className="h-3.5 w-3.5" />,
};

const CATEGORY_LABEL: Record<SeoCategory, string> = {
  metadata: 'Metadata',
  indexability: 'Indexability',
  canonical: 'Canonical',
  hreflang: 'Hreflang',
  headings: 'Headings',
  'structured-data': 'Structured Data',
  'internal-links': 'Internal Links',
  crawlability: 'Crawlability',
  images: 'Images',
  social: 'Social',
  url: 'URL Quality',
  mobile: 'Mobile',
  content: 'Content',
  other: 'Other',
};

const SCORE_COLOR = (n: number | null) =>
  n === null ? 'text-muted-foreground' : n >= 80 ? 'text-emerald-400' : n >= 50 ? 'text-amber-400' : 'text-red-400';

// ─── Individual finding card ──────────────────────────────────────────────────

function FindingCard({ finding }: { finding: SeoFinding }) {
  const [open, setOpen] = useState(false);
  const isActionable = finding.status === 'failed' || finding.status === 'warning';

  return (
    <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="mt-0.5">{STATUS_ICON[finding.status]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-foreground leading-snug">{finding.title}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${SEV_BADGE_CLS[finding.severity]}`}>
              {finding.severity}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLS[finding.status]}`}>
              {finding.status === 'manual-review' ? 'manual review' : finding.status}
            </span>
          </div>
          {!open && finding.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{finding.description}</p>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
          {finding.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{finding.description}</p>
          )}

          {/* Evidence */}
          {finding.evidence.length > 0 && (
            <div className="space-y-1">
              {finding.evidence.map((ev, i) => (
                <div key={i} className="rounded bg-muted/40 px-3 py-2 text-xs font-mono text-foreground/80 break-all">
                  {ev.html && <div><span className="text-muted-foreground">Found: </span>{ev.html.slice(0, 200)}</div>}
                  {ev.actual && <div><span className="text-muted-foreground">Actual: </span>{ev.actual}</div>}
                  {ev.expected && <div><span className="text-muted-foreground">Expected: </span>{ev.expected}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          {isActionable && finding.recommendation && (
            <div className="rounded-md bg-indigo-500/8 border border-indigo-500/20 px-3 py-2">
              <p className="text-xs font-medium text-indigo-300 mb-0.5">Recommendation</p>
              <p className="text-sm text-foreground">{finding.recommendation}</p>
            </div>
          )}

          {/* How to verify */}
          {finding.howToVerify && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">How to verify: </span>{finding.howToVerify}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Score breakdown table ────────────────────────────────────────────────────

function ScoreBreakdownTable({ breakdown }: { breakdown: SeoAuditResult['scoreBreakdown'] }) {
  return (
    <div className="space-y-2">
      {breakdown.map(b => (
        <div key={b.category} className="flex items-center gap-3">
          <div className="w-36 shrink-0">
            <span className="text-xs text-muted-foreground capitalize">{b.category.replace(/-/g, ' ')}</span>
          </div>
          <div className="flex-1">
            <Progress
              value={b.score ?? 0}
              className="h-1.5 bg-white/10"
            />
          </div>
          <div className="w-10 text-right">
            <span className={`text-xs font-bold ${SCORE_COLOR(b.score)}`}>
              {b.score !== null ? b.score : '–'}
            </span>
          </div>
          <div className="w-8 text-right">
            <span className="text-xs text-muted-foreground">{Math.round(b.weight * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SEOSection({ seoAudit, legacyScore, legacyChecks }: Props) {
  const [activeFilter, setActiveFilter] = useState<SeoFindingStatus | 'all'>('all');
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Fall back to legacy when no v1 audit present
  if (!seoAudit) {
    if (legacyScore !== undefined && legacyChecks?.length) {
      return <LegacySEOSection score={legacyScore} checks={legacyChecks} />;
    }
    return null;
  }

  const score = seoAudit.score;
  const { summary, findings, coverage, scoreBreakdown, metadata, indexability, structuredData } = seoAudit;

  // Sort findings: failed > warning > manual-review > passed > unavailable > n/a
  const SEV_RANK: Record<SeoSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const STATUS_RANK: Record<SeoFindingStatus, number> = {
    'failed': 0, 'warning': 1, 'manual-review': 2, 'passed': 3, 'unavailable': 4, 'not-applicable': 5,
  };
  const sorted = [...findings].sort((a, b) => {
    const sr = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return sr !== 0 ? sr : SEV_RANK[a.severity] - SEV_RANK[b.severity];
  });

  const filtered = activeFilter === 'all' ? sorted : sorted.filter(f => f.status === activeFilter);

  const totalIssues = summary.critical + summary.high + summary.medium + summary.low;

  const FILTERS = ([
    { key: 'all' as const,           label: 'All',           count: findings.length },
    { key: 'failed' as const,        label: 'Failed',        count: findings.filter(f => f.status === 'failed').length },
    { key: 'warning' as const,       label: 'Warnings',      count: findings.filter(f => f.status === 'warning').length },
    { key: 'manual-review' as const, label: 'Manual Review', count: summary.manualReview },
    { key: 'passed' as const,        label: 'Passed',        count: summary.passed },
  ] satisfies Array<{ key: SeoFindingStatus | 'all'; label: string; count?: number }>).filter(f => f.count! > 0 || f.key === 'all');

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">SEO Audit</h2>
          <div className="flex items-center gap-2">
            <span className={`text-4xl font-black ${SCORE_COLOR(score)}`}>
              {score !== null ? score : '–'}
            </span>
            <span className="text-muted-foreground text-sm">/100</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
            <Globe className="h-3 w-3" />
            Fetch-only audit
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
            {coverage.percentage}% coverage
          </Badge>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Critical', count: summary.critical, cls: 'text-red-400' },
          { label: 'High', count: summary.high, cls: 'text-orange-400' },
          { label: 'Warnings', count: summary.medium + summary.low, cls: 'text-amber-400' },
          { label: 'Passed', count: summary.passed, cls: 'text-emerald-400' },
        ].map(tile => (
          <Card key={tile.label} className="border-border bg-card">
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-2xl font-bold ${tile.cls}`}>{tile.count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tile.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Metadata snapshot */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <FileSearch className="h-4 w-4" /> Metadata Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2 flex-wrap">
            <MetaBadge label="Title" status={metadata.titleStatus} value={metadata.title} length={metadata.titleLength} />
            <MetaBadge label="Description" status={metadata.descriptionStatus} value={metadata.description} length={metadata.descriptionLength} />
            <MetaBadge label="H1" status={metadata.h1Count === 1 ? 'good' : metadata.h1Count === 0 ? 'missing' : 'multiple'} value={metadata.h1} />
            {metadata.htmlLang && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs">
                <span className="text-muted-foreground">lang=</span><span className="font-mono">{metadata.htmlLang}</span>
              </span>
            )}
          </div>

          {/* OG + Twitter quick summary */}
          <div className="flex gap-2 flex-wrap text-xs">
            {Object.keys(metadata.ogTags).length > 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Open Graph ({Object.keys(metadata.ogTags).length} tags)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <XCircle className="h-3 w-3" /> No Open Graph tags
              </span>
            )}
            {metadata.twitterTags['twitter:card'] ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Twitter Card ({metadata.twitterTags['twitter:card']})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <XCircle className="h-3 w-3" /> No Twitter Card
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Indexability + Structured Data quick status */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Shield className={`h-6 w-6 shrink-0 ${indexability.isIndexable ? 'text-emerald-400' : 'text-red-400'}`} />
            <div>
              <p className="text-sm font-medium text-foreground">
                {indexability.isIndexable ? 'Page is indexable' : 'Page has noindex directive'}
              </p>
              {indexability.effectiveDirectives.length > 0 && (
                <p className="text-xs text-muted-foreground font-mono">{indexability.effectiveDirectives.join(', ')}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Database className={`h-6 w-6 shrink-0 ${structuredData.found ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-sm font-medium text-foreground">
                {structuredData.found
                  ? `${structuredData.count} schema item${structuredData.count !== 1 ? 's' : ''}: ${structuredData.types.slice(0,3).join(', ')}${structuredData.types.length > 3 ? ' + more' : ''}`
                  : 'No structured data found'}
              </p>
              {structuredData.syntaxErrors > 0 && (
                <p className="text-xs text-red-400">{structuredData.syntaxErrors} syntax error{structuredData.syntaxErrors > 1 ? 's' : ''}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score breakdown (collapsible) */}
      {scoreBreakdown.length > 0 && (
        <Card className="border-border bg-card">
          <button
            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors rounded-t-lg"
            onClick={() => setShowBreakdown(o => !o)}
          >
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Score Breakdown by Category</CardTitle>
            {showBreakdown ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showBreakdown && (
            <CardContent className="pt-0 pb-4">
              <ScoreBreakdownTable breakdown={scoreBreakdown} />
            </CardContent>
          )}
        </Card>
      )}

      {/* Findings list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-foreground">
            Findings <span className="text-sm font-normal text-muted-foreground ml-1">{findings.length} total</span>
          </h3>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeFilter === f.key
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-secondary text-muted-foreground border border-border hover:bg-white/10'
                }`}
              >
                {f.label}{f.count !== undefined ? ` (${f.count})` : ''}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No findings match this filter.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => <FindingCard key={f.id} finding={f} />)}
          </div>
        )}
      </div>

      {/* Coverage + limitations */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Audit coverage</span>
            <span className="text-sm font-medium text-foreground">{coverage.executedChecks} / {coverage.supportedChecks} checks executed</span>
          </div>
          {coverage.limitations.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition-colors">
                {coverage.limitations.length} coverage limitation{coverage.limitations.length > 1 ? 's' : ''}
              </summary>
              <ul className="mt-2 space-y-1 pl-4 list-disc">
                {coverage.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ─── MetaBadge helper ─────────────────────────────────────────────────────────

function MetaBadge({ label, status, value, length }: {
  label: string;
  status: string;
  value: string | null;
  length?: number | null;
}) {
  const isGood = status === 'good';
  const cls = isGood
    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    : status === 'missing' || status === 'empty'
      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${cls}`} title={value ?? undefined}>
      {isGood ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      <span className="font-medium">{label}</span>
      {length !== undefined && length !== null && <span className="opacity-70">({length}ch)</span>}
      {status !== 'good' && <span className="capitalize opacity-80">· {status.replace(/-/g,' ')}</span>}
    </span>
  );
}
