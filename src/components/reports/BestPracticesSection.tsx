'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle,
  HelpCircle, Info, Eye, Shield, Lock, Globe, ExternalLink,
  AlertCircle, Layers, Cookie, Monitor, FileCode, Zap,
} from 'lucide-react';
import type { ScoreCheckItem } from '@/types/analysis';
import type {
  BestPracticesAuditResult,
  BestPracticeFinding,
  BestPracticeFindingStatus,
  BestPracticeSeverity,
  BestPracticeCategory,
  SecurityHeaderDetail,
} from '@/types/best-practices';

// ─── Legacy fallback ──────────────────────────────────────────────────────────

interface LegacyProps { score: number; checks: ScoreCheckItem[] }

function LegacyBestPracticesSection({ score, checks }: LegacyProps) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-foreground">Best Practices</h2>
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
  bestPracticesAudit?: BestPracticesAuditResult | null;
  legacyScore?: number;
  legacyChecks?: ScoreCheckItem[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<BestPracticeFindingStatus, React.ReactNode> = {
  'passed':         <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
  'failed':         <XCircle className="h-4 w-4 text-red-400 shrink-0" />,
  'warning':        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />,
  'manual-review':  <Eye className="h-4 w-4 text-blue-400 shrink-0" />,
  'unavailable':    <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />,
  'not-applicable': <Info className="h-4 w-4 text-muted-foreground shrink-0" />,
};

const STATUS_BADGE_CLS: Record<BestPracticeFindingStatus, string> = {
  'passed':         'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  'failed':         'bg-red-500/10 text-red-400 border border-red-500/20',
  'warning':        'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  'manual-review':  'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'unavailable':    'bg-secondary text-muted-foreground border border-border',
  'not-applicable': 'bg-secondary text-muted-foreground border border-border',
};

const SEV_BADGE_CLS: Record<BestPracticeSeverity, string> = {
  critical: 'bg-red-500/10 text-red-300 border border-red-500/20 text-xs',
  high:     'bg-orange-500/10 text-orange-300 border border-orange-500/20 text-xs',
  medium:   'bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs',
  low:      'bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs',
  info:     'bg-secondary text-muted-foreground border border-border text-xs',
};

const CATEGORY_ICON: Record<BestPracticeCategory, React.ReactNode> = {
  'security-headers':   <Shield className="h-3.5 w-3.5" />,
  'https':              <Lock className="h-3.5 w-3.5" />,
  'mixed-content':      <AlertCircle className="h-3.5 w-3.5" />,
  'third-party':        <ExternalLink className="h-3.5 w-3.5" />,
  'external-links':     <Globe className="h-3.5 w-3.5" />,
  'deprecated-api':     <FileCode className="h-3.5 w-3.5" />,
  'resource-integrity': <Layers className="h-3.5 w-3.5" />,
  'cookies':            <Cookie className="h-3.5 w-3.5" />,
  'iframes':            <Monitor className="h-3.5 w-3.5" />,
  'pwa':                <Zap className="h-3.5 w-3.5" />,
  'runtime':            <HelpCircle className="h-3.5 w-3.5" />,
  'resilience':         <Shield className="h-3.5 w-3.5" />,
  'other':              <Info className="h-3.5 w-3.5" />,
};

const CATEGORY_LABEL: Record<BestPracticeCategory, string> = {
  'security-headers':   'Security Headers',
  'https':              'HTTPS',
  'mixed-content':      'Mixed Content',
  'third-party':        'Third-Party',
  'external-links':     'External Links',
  'deprecated-api':     'Deprecated APIs',
  'resource-integrity': 'Resource Integrity',
  'cookies':            'Cookies',
  'iframes':            'iframes',
  'pwa':                'PWA',
  'runtime':            'Runtime',
  'resilience':         'Resilience',
  'other':              'Other',
};

const SCORE_COLOR = (n: number | null) =>
  n === null ? 'text-muted-foreground' : n >= 80 ? 'text-emerald-400' : n >= 50 ? 'text-amber-400' : 'text-red-400';

// ─── Security header row ──────────────────────────────────────────────────────

function HeaderRow({ h }: { h: SecurityHeaderDetail }) {
  const [open, setOpen] = useState(false);

  const strengthColor =
    h.strength === 'strong'   ? 'text-emerald-400' :
    h.strength === 'moderate' ? 'text-amber-400'   :
    h.strength === 'weak'     ? 'text-red-400'     : 'text-muted-foreground';

  const dot =
    h.present && (h.strength === 'strong' || h.strength === 'moderate')
      ? 'bg-emerald-500'
      : h.present
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-sm font-mono text-foreground flex-1 truncate">{h.header}</span>
        {h.present
          ? <span className={`text-xs font-medium ${strengthColor}`}>{h.strength}</span>
          : <span className="text-xs font-medium text-red-400">absent</span>
        }
        {h.rolloutRisk === 'high' && !h.present && (
          <span className="text-xs bg-orange-500/10 text-orange-300 border border-orange-500/20 px-1.5 py-0.5 rounded">
            staged rollout
          </span>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/50">
          {h.value && (
            <p className="text-xs font-mono text-muted-foreground bg-muted/30 rounded px-2 py-1 mt-3 break-all">{h.value}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">{h.recommendation}</p>
          {h.notes && (
            <p className="text-xs text-blue-400 flex items-start gap-1.5">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              {h.notes}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {!h.safeToApplyDirectly && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Requires staged rollout — do not copy-paste
              </span>
            )}
            {h.safeToApplyDirectly && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Safe to apply directly
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Individual finding card ──────────────────────────────────────────────────

function FindingCard({ finding }: { finding: BestPracticeFinding }) {
  const [open, setOpen] = useState(false);

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
            {finding.severity !== 'info' && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${SEV_BADGE_CLS[finding.severity]}`}>
                {finding.severity}
              </span>
            )}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLS[finding.status]}`}>
              {finding.status === 'manual-review' ? 'manual review' : finding.status}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-secondary text-muted-foreground border border-border">
              {CATEGORY_ICON[finding.category]}
              {CATEGORY_LABEL[finding.category]}
            </span>
          </div>
          {!open && finding.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{finding.description}</p>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/50 space-y-3 pt-3">
          {finding.description && (
            <p className="text-sm text-muted-foreground">{finding.description}</p>
          )}

          {finding.recommendation && (
            <div className="rounded-md bg-orange-600/5 border border-orange-500/15 px-3 py-2">
              <p className="text-xs font-medium text-orange-400 mb-1">Recommendation</p>
              <p className="text-sm text-foreground">{finding.recommendation}</p>
              {!finding.safeToApplyDirectly && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-2">
                  <AlertTriangle className="h-3 w-3" />
                  Do not apply directly — requires testing in a staging environment first.
                </p>
              )}
            </div>
          )}

          {finding.evidence.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evidence</p>
              {finding.evidence.slice(0, 3).map((e, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground bg-muted/30 rounded px-2 py-1 break-all">
                  {e.html ?? e.actual ?? e.resourceUrl ?? e.headerName ?? '—'}
                </div>
              ))}
            </div>
          )}

          {finding.verificationSteps.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Verification</p>
              <ol className="space-y-1">
                {finding.verificationSteps.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-orange-500 font-mono shrink-0">{i + 1}.</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Source: <span className="text-foreground">{finding.source}</span></span>
            <span>Confidence: <span className="text-foreground">{finding.confidence}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category score bar ───────────────────────────────────────────────────────

function CategoryBar({ cat }: { cat: BestPracticesAuditResult['categoryScores'][number] }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 flex items-center gap-1.5">
        <span className="text-muted-foreground">{CATEGORY_ICON[cat.category as BestPracticeCategory] ?? null}</span>
        <span className="text-xs text-muted-foreground capitalize truncate">
          {CATEGORY_LABEL[cat.category as BestPracticeCategory] ?? cat.category}
        </span>
      </div>
      <div className="flex-1">
        <Progress value={cat.score ?? 0} className="h-1.5 bg-white/10" />
      </div>
      <div className="w-10 text-right">
        <span className={`text-xs font-bold ${SCORE_COLOR(cat.score)}`}>
          {cat.score !== null ? cat.score : '—'}
        </span>
      </div>
      <div className="w-8 text-right">
        <span className="text-xs text-muted-foreground">{Math.round(cat.weight * 100)}%</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BestPracticesSection({ bestPracticesAudit, legacyScore, legacyChecks }: Props) {
  const [activeFilter, setActiveFilter] = useState<BestPracticeFindingStatus | 'all'>('all');
  const [showHeaders, setShowHeaders] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!bestPracticesAudit) {
    if (legacyScore !== undefined && legacyChecks?.length) {
      return <LegacyBestPracticesSection score={legacyScore} checks={legacyChecks} />;
    }
    return null;
  }

  const { score, summary, findings, coverage, categoryScores, securityHeaders, isHttps } = bestPracticesAudit;

  const STATUS_RANK: Record<BestPracticeFindingStatus, number> = {
    'failed': 0, 'warning': 1, 'manual-review': 2, 'passed': 3, 'unavailable': 4, 'not-applicable': 5,
  };
  const SEV_RANK: Record<BestPracticeSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

  const sorted = [...findings].sort((a, b) => {
    const sr = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return sr !== 0 ? sr : SEV_RANK[a.severity] - SEV_RANK[b.severity];
  });

  const filtered = activeFilter === 'all' ? sorted : sorted.filter(f => f.status === activeFilter);

  const FILTERS = ([
    { key: 'all' as const,           label: 'All',           count: findings.length },
    { key: 'failed' as const,        label: 'Failed',        count: findings.filter(f => f.status === 'failed').length },
    { key: 'warning' as const,       label: 'Warnings',      count: findings.filter(f => f.status === 'warning').length },
    { key: 'manual-review' as const, label: 'Manual Review', count: summary.manualReview },
    { key: 'passed' as const,        label: 'Passed',        count: summary.passed },
  ] satisfies Array<{ key: BestPracticeFindingStatus | 'all'; label: string; count?: number }>)
    .filter(f => f.count! > 0 || f.key === 'all');

  const headersPresent = securityHeaders.filter(h => h.present).length;
  const headersBad = securityHeaders.filter(h => !h.present).length;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">Best Practices</h2>
          <span className={`text-4xl font-black ${SCORE_COLOR(score)}`}>{score ?? '—'}</span>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {bestPracticesAudit.scoreVersion}
          </Badge>
          {!isHttps && (
            <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs">HTTP only</Badge>
          )}
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          {summary.critical > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-300 border border-red-500/20 text-xs font-medium">
              <XCircle className="h-3 w-3" /> {summary.critical} critical
            </span>
          )}
          {summary.high > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 text-xs font-medium">
              <AlertTriangle className="h-3 w-3" /> {summary.high} high
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium">
              <AlertTriangle className="h-3 w-3" /> {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
            </span>
          )}
          {summary.passed > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
              <CheckCircle2 className="h-3 w-3" /> {summary.passed} passed
            </span>
          )}
        </div>
      </div>

      {/* Security Headers Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-500" />
              Security Headers
              <span className={`text-sm font-semibold ${headersPresent >= 5 ? 'text-emerald-400' : headersPresent >= 3 ? 'text-amber-400' : 'text-red-400'}`}>
                {headersPresent}/{securityHeaders.length} present
              </span>
            </CardTitle>
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              onClick={() => setShowHeaders(o => !o)}
            >
              {showHeaders ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showHeaders ? 'Hide details' : 'Show details'}
            </button>
          </div>
          {/* Quick header status dots */}
          <div className="flex flex-wrap gap-2 pt-1">
            {securityHeaders.map(h => (
              <span
                key={h.header}
                title={`${h.header}: ${h.present ? h.strength : 'absent'}`}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono border ${
                  h.present && (h.strength === 'strong' || h.strength === 'moderate')
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : h.present
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  h.present && (h.strength === 'strong' || h.strength === 'moderate')
                    ? 'bg-emerald-400' : h.present ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                {h.header.replace('Content-Security-Policy', 'CSP')
                         .replace('Strict-Transport-Security', 'HSTS')
                         .replace('X-Content-Type-Options', 'XCTO')
                         .replace('Referrer-Policy', 'Referrer')
                         .replace('Permissions-Policy', 'Permissions')
                         .replace('X-Frame-Options', 'XFO')
                         .replace('Cross-Origin-Opener-Policy', 'COOP')}
              </span>
            ))}
          </div>
        </CardHeader>
        {showHeaders && (
          <CardContent className="pt-0 space-y-2">
            {securityHeaders.map(h => <HeaderRow key={h.header} h={h} />)}
            {headersBad > 0 && (
              <p className="text-xs text-amber-400 flex items-start gap-1.5 pt-1">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                {headersBad} header{headersBad !== 1 ? 's' : ''} absent. See recommendations above before adding — some headers require staged rollout.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Score Breakdown */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Score Breakdown</CardTitle>
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              onClick={() => setShowBreakdown(o => !o)}
            >
              {showBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showBreakdown ? 'Hide' : 'Show'}
            </button>
          </div>
        </CardHeader>
        {showBreakdown && (
          <CardContent className="pt-0 space-y-2">
            {categoryScores
              .filter(c => c.score !== null)
              .map(c => <CategoryBar key={c.category} cat={c} />)
            }
          </CardContent>
        )}
      </Card>

      {/* Findings filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeFilter === f.key
                ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-400 border-orange-300 dark:border-orange-900/50'
                : 'bg-secondary text-muted-foreground border-border hover:border-muted-foreground'
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className="ml-1.5 opacity-70">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Finding cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No findings match this filter.
          </div>
        )}
        {filtered.map(f => <FindingCard key={f.id} finding={f} />)}
      </div>

      {/* Coverage notice */}
      <Card className="border-border/50 bg-card/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Audit coverage: {coverage.percentage}% ({coverage.executedChecks}/{coverage.supportedChecks} checks executed)
              </p>
              <p className="text-xs text-muted-foreground">
                This audit runs in static/fetch-only mode. {coverage.unavailableChecks} check{coverage.unavailableChecks !== 1 ? 's' : ''} require a real browser and are marked unavailable — they do not affect the score.
              </p>
              <ul className="mt-1 space-y-0.5">
                {coverage.limitations.slice(0, 3).map((l, i) => (
                  <li key={i} className="text-xs text-muted-foreground/70 flex gap-1.5">
                    <span className="shrink-0">•</span>{l}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
