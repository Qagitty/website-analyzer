import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function RecentAnalyses({ analyses }: { analyses: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Analyses</CardTitle>
      </CardHeader>
      <CardContent>
        {analyses.length === 0 ? (
          <p className="text-muted-foreground/60 text-center py-8 text-sm">
            No analyses yet.{' '}
            <Link href="/analyze" className="text-indigo-400 hover:text-indigo-300">
              Analyze your first site
            </Link>
          </p>
        ) : (
          <div>
            {analyses.map((a) => {
              const statusClass = (() => {
                const base = 'text-xs font-medium px-2.5 py-0.5 rounded-full';
                if (a.status === 'completed') return `${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`;
                if (a.status === 'failed')    return `${base} bg-red-500/10 text-red-400 border border-red-500/20`;
                return `${base} bg-indigo-500/10 text-indigo-300 border border-indigo-500/20`;
              })();
              return (
                <Link
                  key={a.id}
                  href={a.status === 'completed' ? `/reports/${a.id}` : `/analyze/${a.id}`}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0 hover:bg-white/[0.02] px-1 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.url}</p>
                    <p className="text-xs text-muted-foreground/60 shrink-0">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {a.lighthouse_scores && (
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {a.lighthouse_scores.performance}
                      </span>
                    )}
                    <span className={statusClass}>{a.status}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
