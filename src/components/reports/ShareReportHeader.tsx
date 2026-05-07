import { formatDistanceToNow } from 'date-fns';
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
          <h1 className="text-2xl font-bold truncate text-foreground">{analysis.url}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analyzed {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
            {duration && <span className="text-muted-foreground"> · {duration}s</span>}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Completed
        </span>
      </div>
      {typeof analysis.ai_summary === 'string' && analysis.ai_summary.trim().length > 5 && (
        <p className="text-muted-foreground leading-relaxed">{analysis.ai_summary}</p>
      )}
    </div>
  );
}
