'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Image, Globe, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ResourceAudit } from '@/types/analysis';

function IssueBadge({ issue }: { issue: string }) {
  let cls = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  if (issue.includes('CLS')) cls = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
  else if (issue.includes('WebP') || issue.includes('AVIF')) cls = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  return <Badge className={`text-xs border ${cls}`}>{issue}</Badge>;
}

export function ResourceAuditSection({
  resourceAudit,
}: {
  resourceAudit?: ResourceAudit | null;
}) {
  if (!resourceAudit) return null;

  const imageIssueCount = resourceAudit.imageIssues.length;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Resource Audit</h2>

      {/* Sub-section 1: Render-Blocking Resources */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Render-Blocking Resources
            </span>
            <Badge
              className={
                resourceAudit.renderBlocking.length === 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
              }
            >
              {resourceAudit.renderBlocking.length} found
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resourceAudit.renderBlocking.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No render-blocking resources detected.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {resourceAudit.renderBlocking.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <Badge className="shrink-0 bg-muted text-muted-foreground border border-border">
                      {item.type}
                    </Badge>
                    <code className="truncate text-foreground" title={item.url}>
                      {item.url.length > 70 ? `…${item.url.slice(-70)}` : item.url}
                    </code>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded px-3 py-2">
                Render-blocking resources delay First Contentful Paint. Add async/defer to scripts and consider inlining critical CSS.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sub-section 2: Image Audit */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Image className="h-4 w-4 text-orange-500" />
            Image Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Total: {resourceAudit.totalImages} &nbsp;|&nbsp; Lazy: {resourceAudit.lazyImages} &nbsp;|&nbsp; With issues: {imageIssueCount}
          </p>
          {imageIssueCount === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              All images pass basic checks.
            </p>
          ) : (
            <ul className="space-y-2">
              {resourceAudit.imageIssues.slice(0, 10).map((img, i) => (
                <li key={i} className="space-y-1">
                  <code className="block text-xs text-muted-foreground truncate" title={img.src}>
                    {img.src.length > 60 ? `…${img.src.slice(-60)}` : img.src}
                  </code>
                  <div className="flex flex-wrap gap-1">
                    {img.issues.map((issue, j) => (
                      <IssueBadge key={j} issue={issue} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Sub-section 3: Third-Party Resources */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-orange-500" />
            Third-Party Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resourceAudit.thirdParty.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No third-party resources detected.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left pb-2 font-medium">Domain</th>
                      <th className="text-right pb-2 font-medium">Requests</th>
                      <th className="text-left pb-2 pl-4 font-medium">Types</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourceAudit.thirdParty.map((tp, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 font-mono text-foreground">{tp.domain}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{tp.count}</td>
                        <td className="py-1.5 pl-4">
                          <div className="flex flex-wrap gap-1">
                            {tp.types.map((t, j) => (
                              <Badge key={j} className="text-xs bg-muted text-muted-foreground border border-border">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Each third-party domain adds a DNS lookup. Consider self-hosting critical resources.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sub-section 4: Mixed Content */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Mixed Content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resourceAudit.mixedContent.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              All resources use HTTPS.
            </p>
          ) : (
            <>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {resourceAudit.mixedContent.length} HTTP resource{resourceAudit.mixedContent.length > 1 ? 's' : ''} found on an HTTPS page
              </p>
              <ul className="space-y-1.5">
                {resourceAudit.mixedContent.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <Badge className="shrink-0 bg-muted text-muted-foreground border border-border">
                      {item.tag}
                    </Badge>
                    <code className="truncate text-foreground" title={item.url}>
                      {item.url.length > 70 ? `…${item.url.slice(-70)}` : item.url}
                    </code>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                HTTP resources on an HTTPS page are blocked by modern browsers.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
