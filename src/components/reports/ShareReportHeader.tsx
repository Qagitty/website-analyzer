import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { Analysis } from '@/types/analysis';

export function ShareReportHeader({ analysis }: { analysis: Analysis }) {
  const duration = analysis.completed_at && analysis.started_at
    ? Math.round(
        (new Date(analysis.completed_at).getTime() - new Date(analysis.started_at).getTime()) / 1000
      )
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{analysis.url}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analyzed {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
            {duration && <> · {duration}s</>}
          </p>
        </div>
        <Badge variant="default">Completed</Badge>
      </div>
      {typeof analysis.ai_summary === 'string' && analysis.ai_summary.trim().length > 5 && (
        <p className="text-muted-foreground leading-relaxed">{analysis.ai_summary}</p>
      )}
    </div>
  );
}
