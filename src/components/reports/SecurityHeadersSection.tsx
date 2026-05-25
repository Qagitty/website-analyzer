'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { SecurityHeaderResult } from '@/types/analysis';

const SEVERITY_COLORS = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
} as const;

export function SecurityHeadersSection({
  securityHeaders,
}: {
  securityHeaders?: SecurityHeaderResult[] | null;
}) {
  if (!securityHeaders?.length) return null;

  const presentCount = securityHeaders.filter(h => h.present).length;
  const total = securityHeaders.length;

  const scoreBadgeClass =
    presentCount >= 5
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
      : presentCount >= 3
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
      : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Security Headers</h2>
        <Badge className={scoreBadgeClass}>
          {presentCount}/{total} headers present
        </Badge>
      </div>
      <Card className="bg-card border border-border">
        <CardContent className="pt-4 divide-y divide-border">
          {securityHeaders.map(h => (
            <div
              key={h.header}
              className="py-3 flex flex-col sm:flex-row sm:items-start gap-2"
            >
              <div className="flex items-center gap-2 min-w-[260px]">
                {h.present ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <code className="text-xs font-mono text-foreground">{h.header}</code>
                {!h.present && (
                  <Badge className={`text-xs border ${SEVERITY_COLORS[h.severity]}`}>
                    {h.severity}
                  </Badge>
                )}
              </div>
              <div className="flex-1 space-y-1">
                {h.present ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ Present
                    {h.value
                      ? `: ${h.value.slice(0, 60)}${h.value.length > 60 ? '…' : ''}`
                      : ''}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">{h.description}</p>
                    <p className="text-xs font-mono text-indigo-400 bg-indigo-500/5 rounded px-2 py-1 border border-indigo-500/10">
                      {h.recommendation}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
