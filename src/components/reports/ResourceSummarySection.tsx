'use client';

import { useState } from 'react';
import { FileCode2, FileImage, Type, Globe, Zap, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ResourceAudit } from '@/types/analysis';
import type { DetectedResource } from '@/types/performance';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function truncateUrl(url: string, max = 60): string {
  if (url.length <= max) return url;
  const half = Math.floor(max / 2);
  return url.slice(0, half) + '…' + url.slice(-half);
}

const TYPE_ICON: Record<string, React.ElementType> = {
  script:     FileCode2,
  stylesheet: FileCode2,
  image:      FileImage,
  font:       Type,
  iframe:     Globe,
  other:      Globe,
};

const TYPE_LABEL: Record<string, string> = {
  script:     'Script',
  stylesheet: 'Stylesheet',
  image:      'Image',
  font:       'Font',
  iframe:     'iFrame',
  other:      'Other',
};

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({
  label, value, subLabel, highlight,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  highlight?: 'warn' | 'ok';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${
        highlight === 'warn' ? 'text-amber-500' :
        highlight === 'ok'   ? 'text-emerald-500' :
        'text-foreground'
      }`}>
        {value}
      </p>
      {subLabel && <p className="text-[10px] text-muted-foreground/60">{subLabel}</p>}
    </div>
  );
}

// ── Detected resources table ──────────────────────────────────────────────────

function DetectedResourcesTable({ resources }: { resources: DetectedResource[] }) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_SHOWN = 10;
  const visible = showAll ? resources : resources.slice(0, DEFAULT_SHOWN);

  if (resources.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">
          Detected Resources
          <span className="ml-2 text-xs text-muted-foreground/50 font-normal">
            ({resources.length} detected from HTML · sizes require browser measurement)
          </span>
        </h3>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" role="table" aria-label="Detected resources">
            <thead className="bg-muted/30">
              <tr>
                <th scope="col" className="text-left px-3 py-2 font-semibold text-muted-foreground">Resource URL</th>
                <th scope="col" className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Type</th>
                <th scope="col" className="text-center px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Blocking</th>
                <th scope="col" className="text-center px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">3rd party</th>
                <th scope="col" className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Size</th>
                <th scope="col" className="text-left px-3 py-2 font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {visible.map((r, i) => {
                const Icon = TYPE_ICON[r.type] ?? Globe;
                const notes: string[] = [];
                if (r.type === 'image') {
                  if (!r.hasWidth || !r.hasHeight) notes.push('Missing dimensions (CLS risk)');
                  if (!r.hasLazy) notes.push('No lazy loading');
                  if (!r.hasModernFormat) notes.push('Legacy format');
                  if (!r.hasSrcset) notes.push('No srcset');
                }

                return (
                  <tr
                    key={i}
                    className={`${r.isRenderBlocking ? 'bg-amber-500/5' : ''} hover:bg-muted/20`}
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground max-w-[280px]">
                      <span title={r.url}>{truncateUrl(r.url)}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Icon className="h-3 w-3 shrink-0" aria-hidden />
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.isRenderBlocking ? (
                        <span className="flex items-center justify-center gap-1 text-amber-500" aria-label="Render-blocking">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          <span className="sr-only">Yes</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30" aria-label="Not render-blocking">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.isThirdParty ? (
                        <span className="flex items-center justify-center gap-1 text-blue-500" aria-label="Third party">
                          <Globe className="h-3 w-3" aria-hidden />
                          <span className="sr-only">Yes</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30" aria-label="First party">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground/40" aria-label="Size not available in fetch-only mode">
                      N/A
                    </td>
                    <td className="px-3 py-2">
                      {notes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {notes.map((n, ni) => (
                            <span
                              key={ni}
                              className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15 rounded px-1 py-0.5"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {resources.length > DEFAULT_SHOWN && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAll
            ? <><ChevronUp className="h-3 w-3" /> Show fewer</>
            : <><ChevronDown className="h-3 w-3" /> Show all {resources.length} resources</>
          }
        </button>
      )}

      <p className="text-[10px] text-muted-foreground/40">
        Transferred size, decoded size, and load duration are not available in fetch-only mode.
        Run Lighthouse or WebPageTest for full resource waterfall data.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  resourceAudit?: ResourceAudit | null;
  htmlBytes?: number | null;
}

export function ResourceSummarySection({ resourceAudit, htmlBytes }: Props) {
  if (!resourceAudit) return null;

  const detectedCount =
    (resourceAudit.totalScripts ?? 0) +
    (resourceAudit.totalStylesheets ?? 0) +
    (resourceAudit.totalImages ?? 0) +
    1; // HTML document

  const renderBlockingCount = resourceAudit.renderBlocking?.length ?? 0;
  const thirdPartyCount = resourceAudit.thirdParty?.length ?? 0;
  const lazyPct = resourceAudit.totalImages > 0
    ? Math.round((resourceAudit.lazyImages / resourceAudit.totalImages) * 100)
    : null;

  const detectedResources: DetectedResource[] = (resourceAudit as any).detectedResources ?? [];

  return (
    <section className="space-y-5" aria-labelledby="resource-summary-heading">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 id="resource-summary-heading" className="text-2xl font-bold text-foreground">
          Resource Summary
        </h2>
        <Badge
          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs"
          title="Resource counts are detected from HTML. Sub-resource sizes and timing require browser measurement."
        >
          Fetch-only · counts from HTML
        </Badge>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="HTML size"
          value={htmlBytes != null ? fmtBytes(htmlBytes) : '—'}
          subLabel="transferred"
          highlight={htmlBytes != null && htmlBytes > 300_000 ? 'warn' : htmlBytes != null ? 'ok' : undefined}
        />
        <StatCard
          label="Detected requests"
          value={detectedCount}
          subLabel="from HTML (est.)"
        />
        <StatCard
          label="Scripts"
          value={resourceAudit.totalScripts ?? 0}
          subLabel={`${resourceAudit.asyncScripts ?? 0} async · ${resourceAudit.deferScripts ?? 0} defer`}
        />
        <StatCard
          label="Stylesheets"
          value={resourceAudit.totalStylesheets ?? 0}
        />
        <StatCard
          label="Images"
          value={resourceAudit.totalImages ?? 0}
          subLabel={lazyPct != null ? `${lazyPct}% lazy` : undefined}
          highlight={lazyPct != null && lazyPct < 30 && (resourceAudit.totalImages ?? 0) > 3 ? 'warn' : undefined}
        />
        <StatCard
          label="3rd-party domains"
          value={thirdPartyCount}
          highlight={thirdPartyCount > 6 ? 'warn' : thirdPartyCount > 0 ? undefined : 'ok'}
        />
      </div>

      {/* Sub-resource byte breakdown notice */}
      <Card className="bg-card border border-border">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'JS bytes', icon: FileCode2 },
              { label: 'CSS bytes', icon: FileCode2 },
              { label: 'Image bytes', icon: FileImage },
              { label: 'Font bytes', icon: Type },
              { label: '3rd-party bytes', icon: Globe },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="text-center space-y-1">
                <Icon className="h-4 w-4 text-muted-foreground/30 mx-auto" aria-hidden />
                <p className="text-xs text-muted-foreground/40 font-medium">{label}</p>
                <p className="text-xs text-muted-foreground/30">Not measured</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-3">
            Individual resource sizes require browser measurement. Use Lighthouse or WebPageTest for a full breakdown.
          </p>
        </CardContent>
      </Card>

      {/* Render-blocking banner */}
      {renderBlockingCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
          <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-medium text-amber-600 dark:text-amber-400">
              {renderBlockingCount} render-blocking resource{renderBlockingCount > 1 ? 's' : ''} detected
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {resourceAudit.renderBlocking.slice(0, 3).map(r => r.url).join(', ')}
              {renderBlockingCount > 3 ? ` +${renderBlockingCount - 3} more` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Third-party summary */}
      {resourceAudit.thirdParty && resourceAudit.thirdParty.length > 0 && (
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
              Third-party domains ({resourceAudit.thirdParty.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {resourceAudit.thirdParty.map(tp => (
                <span
                  key={tp.domain}
                  className="text-xs bg-muted/50 border border-border rounded px-2 py-1 text-muted-foreground"
                >
                  {tp.domain}
                  <span className="ml-1 text-muted-foreground/50">({tp.count})</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detected resources table */}
      {detectedResources.length > 0 && (
        <DetectedResourcesTable resources={detectedResources} />
      )}
    </section>
  );
}
