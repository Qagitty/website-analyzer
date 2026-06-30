'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { SecurityHeaderResult as LegacySecurityHeaderResult } from '@/types/analysis';
import type {
  SecurityHeadersAuditResult,
  SecurityHeaderAnalysisResult,
  SecurityHeaderFinding,
  SecurityHeaderStatus,
  SecurityHeaderSeverity,
  RedirectHop,
  SecurityHeaderScoreBreakdown,
} from '@/types/security-headers';
import type { CrawledPage } from '@/types/analysis';

// ── Colour helpers ─────────────────────────────────────────────────────────────

function statusBg(status: SecurityHeaderStatus): string {
  switch (status) {
    case 'strong': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'present': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'weak': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'malformed': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'conflicting': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'missing': return 'bg-red-500/10 text-red-400 border-red-500/20';
    default: return 'bg-secondary/60 text-muted-foreground border-border';
  }
}

function statusIcon(status: SecurityHeaderStatus) {
  switch (status) {
    case 'strong': return <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
    case 'present': return <ShieldCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    case 'weak': return <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    case 'malformed': return <ShieldAlert className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
    case 'conflicting': return <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
    case 'missing': return <ShieldX className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    default: return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

function severityBadge(sev: SecurityHeaderSeverity) {
  const cls = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/20',
    high:     'bg-orange-500/15 text-orange-400 border-orange-500/20',
    medium:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
    low:      'bg-blue-500/15 text-blue-400 border-blue-500/20',
    info:     'bg-secondary/60 text-muted-foreground border-border',
  }[sev] ?? 'bg-secondary/60 text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {sev}
    </span>
  );
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function rolloutLabel(risk: string, safe: boolean) {
  if (safe) return <span className="text-[10px] text-emerald-400">Safe to apply</span>;
  const cls = risk === 'low' ? 'text-blue-400' : risk === 'medium' ? 'text-amber-400' : 'text-red-400';
  return <span className={`text-[10px] ${cls}`}>Risk: {risk}</span>;
}

// ── Finding card ───────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: SecurityHeaderFinding }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/20 transition-colors"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="mt-0.5">{statusIcon(finding.status)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{finding.title}</span>
            {severityBadge(finding.severity)}
            {rolloutLabel(finding.rolloutRisk, finding.safeToApplyDirectly)}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{finding.description}</p>
        </div>
        <div className="shrink-0 mt-0.5 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 bg-secondary/10 px-4 py-3 space-y-3">
          {finding.recommendation && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Recommendation</p>
              <p className="text-sm">{finding.recommendation}</p>
            </div>
          )}

          {finding.weaknesses && finding.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Weaknesses found</p>
              <ul className="space-y-1">
                {finding.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
                    <span className="mt-0.5">·</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {finding.detectedValues && finding.detectedValues.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Observed value(s)</p>
              {finding.detectedValues.map((v, i) => (
                <code key={i} className="block text-[11px] text-emerald-300/80 bg-black/30 rounded px-2 py-1 font-mono break-all mt-1">{v}</code>
              ))}
            </div>
          )}

          {finding.verificationSteps && finding.verificationSteps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Verification steps</p>
              <ol className="space-y-1">
                {finding.verificationSteps.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="shrink-0 font-mono text-orange-500">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Header row in summary table ────────────────────────────────────────────────

function HeaderRow({ h }: { h: SecurityHeaderAnalysisResult }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="border-b border-border/40 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-2">
            {statusIcon(h.status)}
            <span className="text-xs font-mono text-foreground">{h.displayName}</span>
          </div>
        </td>
        <td className="py-2.5 px-3">
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${statusBg(h.status)}`}>
            {h.status}
          </span>
        </td>
        <td className="py-2.5 px-3 max-w-[200px]">
          {h.normalizedValue ? (
            <code className="text-[11px] font-mono text-emerald-300/80 truncate block">{
              h.normalizedValue.length > 60 ? h.normalizedValue.slice(0, 60) + '…' : h.normalizedValue
            }</code>
          ) : (
            <span className="text-xs text-muted-foreground/60 italic">not set</span>
          )}
        </td>
        <td className="py-2.5 px-3 text-right">
          {h.weight > 0 ? (
            <span className="text-xs font-mono text-muted-foreground">{h.earnedPoints}/{h.weight}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">info only</span>
          )}
        </td>
        <td className="py-2.5 px-3">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border/40">
          <td colSpan={5} className="px-4 py-3 bg-secondary/10">
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">{h.reason}</p>
              {h.recommendation && h.recommendation !== h.reason && (
                <div className="rounded bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 px-3 py-2">
                  <span className="text-orange-500 font-medium">Recommendation: </span>
                  <span className="text-foreground/80">{h.recommendation}</span>
                </div>
              )}
              {h.applicability === 'not-applicable' && (
                <p className="text-muted-foreground/60 italic">This header does not apply to this response.</p>
              )}
              {h.rawValues.length > 0 && (
                <div>
                  <p className="text-muted-foreground/70 mb-1">Raw value(s):</p>
                  {h.rawValues.map((v, i) => (
                    <code key={i} className="block text-[11px] font-mono text-foreground/70 bg-black/20 rounded px-2 py-0.5 mt-0.5 break-all">{v}</code>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Redirect chain evidence ────────────────────────────────────────────────────

function RedirectChain({ chain }: { chain: RedirectHop[] }) {
  const [open, setOpen] = useState(false);
  if (chain.length <= 1) return null;

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary/20 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-medium">Redirect chain ({chain.length} hop{chain.length !== 1 ? 's' : ''})</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {chain.map((hop, i) => (
            <div key={i} className="px-4 py-2.5 bg-secondary/5">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold ${hop.status < 300 ? 'text-emerald-400' : hop.status < 400 ? 'text-amber-400' : 'text-red-400'}`}>
                  {hop.status}
                </span>
                <code className="text-xs font-mono text-muted-foreground break-all">{hop.url}</code>
                {hop.location && (
                  <span className="text-xs text-orange-500 shrink-0">→ {hop.location}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Score breakdown ────────────────────────────────────────────────────────────

function ScoreBreakdownTable({ breakdown }: { breakdown: SecurityHeaderScoreBreakdown[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary/20 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-medium">Score breakdown</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border/60 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/20 border-b border-border/40">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Header</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Applicability</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(breakdown) ? breakdown : []).map(b => (
                <tr key={b.headerName} className="border-b border-border/40">
                  <td className="px-3 py-2 font-mono text-foreground/80">{b.displayName}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${statusBg(b.status)}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{b.applicability}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {b.weight > 0 ? (
                      <span className={b.earnedPoints === b.weight ? 'text-emerald-400' : b.earnedPoints > 0 ? 'text-amber-400' : 'text-red-400'}>
                        {b.earnedPoints}/{b.weight}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── V2 Audit UI ────────────────────────────────────────────────────────────────

function SecurityHeadersV2({ audit }: { audit: SecurityHeadersAuditResult }) {
  const { score, scoreVersion, testedUrl, finalUrl, redirectChain, headers, findings, scoreBreakdown: rawScoreBreakdown, coverage, summary, warnings, errors } = audit;
  const scoreBreakdown = Array.isArray(rawScoreBreakdown) ? rawScoreBreakdown : [];

  const primaryHeaders = Object.values(headers).filter(h => h.applicability === 'required');
  const infoHeaders = Object.values(headers).filter(h => h.applicability !== 'required');

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Security Headers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {testedUrl !== finalUrl ? (
              <>Redirected → <code className="font-mono text-xs">{finalUrl}</code></>
            ) : (
              <code className="font-mono text-xs">{finalUrl}</code>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-4xl font-bold tabular-nums ${scoreColor(score)}`}>
              {score !== null ? score : '—'}
            </div>
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
          <div className="space-y-1">
            <span className="block text-[10px] bg-secondary/60 border border-border text-muted-foreground px-2 py-0.5 rounded font-mono">
              {scoreVersion}
            </span>
            <span className="block text-[10px] text-muted-foreground text-right">{coverage.percentage}% coverage</span>
          </div>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {summary.strong > 0 && (
          <span className="flex items-center gap-1 text-xs rounded-full border px-3 py-1 bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="h-3 w-3" />{summary.strong} strong
          </span>
        )}
        {summary.present > 0 && (
          <span className="flex items-center gap-1 text-xs rounded-full border px-3 py-1 bg-blue-500/10 border-blue-500/20 text-blue-400">
            <ShieldCheck className="h-3 w-3" />{summary.present} present
          </span>
        )}
        {summary.weak > 0 && (
          <span className="flex items-center gap-1 text-xs rounded-full border px-3 py-1 bg-amber-500/10 border-amber-500/20 text-amber-400">
            <ShieldAlert className="h-3 w-3" />{summary.weak} weak
          </span>
        )}
        {summary.malformed > 0 && (
          <span className="flex items-center gap-1 text-xs rounded-full border px-3 py-1 bg-orange-500/10 border-orange-500/20 text-orange-400">
            <AlertTriangle className="h-3 w-3" />{summary.malformed} malformed
          </span>
        )}
        {summary.missing > 0 && (
          <span className="flex items-center gap-1 text-xs rounded-full border px-3 py-1 bg-red-500/10 border-red-500/20 text-red-400">
            <ShieldX className="h-3 w-3" />{summary.missing} missing
          </span>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}
            </p>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-red-400">{e}</p>
          ))}
        </div>
      )}

      {/* Priority findings */}
      {findings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Priority findings</h3>
          {findings.map(f => <FindingCard key={f.id} finding={f} />)}
        </div>
      )}

      {/* Required headers table */}
      {primaryHeaders.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Required headers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/20 border-b border-border/40">
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Header</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Current value</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Points</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {primaryHeaders.map(h => <HeaderRow key={h.headerName} h={h} />)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional / informational headers */}
      {infoHeaders.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Additional headers</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Not scored. These require manual review and context-specific configuration.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/20 border-b border-border/40">
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Header</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Current value</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium" />
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {infoHeaders.map(h => <HeaderRow key={h.headerName} h={h} />)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <RedirectChain chain={redirectChain} />

      {scoreBreakdown.length > 0 && <ScoreBreakdownTable breakdown={scoreBreakdown} />}

      {coverage.limitations.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-secondary/10 px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Coverage notes</p>
          {coverage.limitations.map((l, i) => (
            <p key={i} className="text-xs text-muted-foreground/70">· {l}</p>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground/50 border-t border-border/40 pt-3">
        This audit checks HTTP response headers from a single fetch. It does not constitute a penetration test and does not guarantee protection against all attack vectors. High-risk headers must be tested in staging before production deployment.
      </p>
    </section>
  );
}

// ── Legacy fallback (old boolean format) ─────────────────────────────────────

function pagePathLabel(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname === '/' ? u.hostname : u.hostname + u.pathname).replace(/\/$/, '');
  } catch {
    return url;
  }
}

function PageBreakdown({ headerName, crawledPages }: { headerName: string; crawledPages: CrawledPage[] }) {
  const pagesWithData = crawledPages.filter(p => p.securityHeaders?.length);
  if (!pagesWithData.length) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <p className="text-xs font-medium text-muted-foreground">Pages scanned</p>
      <div className="space-y-1">
        {pagesWithData.map(page => {
          const result = page.securityHeaders!.find(h => h.header === headerName);
          const isPresent = result?.present ?? false;
          return (
            <div key={page.url} className="flex items-start gap-2 text-xs rounded-md bg-secondary/40 px-2.5 py-2">
              {isPresent
                ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                : <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-foreground font-medium truncate">{page.title}</p>
                <p className="text-muted-foreground/70 font-mono truncate text-[11px]">{pagePathLabel(page.url)}</p>
                {isPresent && result?.value && (
                  <p className="text-emerald-500/80 mt-1 font-mono break-all text-[11px]">
                    {result.value.length > 80 ? result.value.slice(0, 80) + '…' : result.value}
                  </p>
                )}
              </div>
              <span className={`shrink-0 font-medium text-[11px] mt-0.5 ${isPresent ? 'text-emerald-500' : 'text-red-400'}`}>
                {isPresent ? 'present' : 'missing'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegacyHeaderCard({ h, crawledPages }: { h: LegacySecurityHeaderResult; crawledPages: CrawledPage[] }) {
  const [open, setOpen] = useState(false);
  const severityCls = {
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
    medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }[h.severity] ?? '';

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start gap-3">
          {h.present
            ? <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            : <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold font-mono">{h.header}</span>
              {!h.present && (
                <span className={`text-[10px] font-semibold uppercase tracking-wide rounded border px-1.5 py-0.5 ${severityCls}`}>
                  {h.severity}
                </span>
              )}
              {h.present && <span className="text-xs text-emerald-500 font-medium">present</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{h.description}</p>
            {!h.present && <p className="text-xs text-foreground/80 mt-1 italic">{h.recommendation}</p>}
            {h.present && h.value && (
              <code className="text-[11px] font-mono text-emerald-400/80 mt-1 block break-all">
                {h.value.length > 120 ? h.value.slice(0, 120) + '…' : h.value}
              </code>
            )}
            {crawledPages.length > 0 && (
              <button
                type="button"
                className="mt-2 text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors py-1 pr-2"
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
              >
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Pages
              </button>
            )}
            {open && <PageBreakdown headerName={h.header} crawledPages={crawledPages} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityHeadersLegacy({
  securityHeaders,
  crawledPages,
}: {
  securityHeaders: LegacySecurityHeaderResult[];
  crawledPages: CrawledPage[];
}) {
  const present = securityHeaders.filter(h => h.present).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Security Headers</h2>
        <span className={`text-sm font-semibold ${present === securityHeaders.length ? 'text-emerald-400' : present > securityHeaders.length / 2 ? 'text-amber-400' : 'text-red-400'}`}>
          {present}/{securityHeaders.length} present
        </span>
      </div>
      <div className="grid gap-3">
        {securityHeaders.map(h => <LegacyHeaderCard key={h.header} h={h} crawledPages={crawledPages} />)}
      </div>
    </section>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function SecurityHeadersSection({
  securityHeadersAudit,
  securityHeaders,
  crawledPages = [],
}: {
  securityHeadersAudit?: SecurityHeadersAuditResult;
  securityHeaders?: LegacySecurityHeaderResult[];
  crawledPages?: CrawledPage[];
}) {
  if (securityHeadersAudit) return <SecurityHeadersV2 audit={securityHeadersAudit} />;
  if (securityHeaders && securityHeaders.length > 0) {
    return <SecurityHeadersLegacy securityHeaders={securityHeaders} crawledPages={crawledPages} />;
  }
  return null;
}
