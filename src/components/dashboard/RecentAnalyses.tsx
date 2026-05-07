import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function RecentAnalyses({ analyses }: { analyses: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Analyses</CardTitle>
      </CardHeader>
      <CardContent>
        {analyses.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No analyses yet.{' '}
            <Link href="/analyze" className="text-primary hover:underline">
              Analyze your first site
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {analyses.map((a) => (
              <Link
                key={a.id}
                href={a.status === 'completed' ? `/reports/${a.id}` : `/analyze/${a.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {a.lighthouse_scores && (
                    <span className="text-sm font-semibold tabular-nums">
                      {a.lighthouse_scores.performance}
                    </span>
                  )}
                  <Badge
                    variant={
                      a.status === 'completed' ? 'default' :
                      a.status === 'failed' ? 'destructive' : 'secondary'
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
