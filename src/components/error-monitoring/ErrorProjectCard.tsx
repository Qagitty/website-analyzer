'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Activity, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ErrorProject {
  id:                  string;
  name:                string;
  normalized_origin:   string;
  environment:         string;
  status:              string;
  ingestion_key_prefix: string;
  last_event_at:       string | null;
  created_at:          string;
  event_quota_monthly: number;
}

interface Props {
  project: ErrorProject;
}

export function ErrorProjectCard({ project }: Props) {
  const isActive = project.status === 'active';

  return (
    <Link
      href={`/errors/${project.id}`}
      className="flex items-center justify-between gap-4 bg-card border border-border rounded-xl p-4 hover:border-indigo-500/40 hover:bg-card/80 transition-colors group"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Activity className="h-4 w-4 text-indigo-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
            <Badge
              variant="outline"
              className={
                isActive
                  ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5'
                  : 'text-zinc-400 border-zinc-400/30'
              }
            >
              {project.status}
            </Badge>
            <Badge variant="outline" className="text-indigo-400 border-indigo-400/30 bg-indigo-400/5">
              {project.environment}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.normalized_origin}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">
              Key: <code className="font-mono">{project.ingestion_key_prefix}</code>
            </span>
            {project.last_event_at ? (
              <span className="text-xs text-muted-foreground">
                Last event {formatDistanceToNow(new Date(project.last_event_at), { addSuffix: true })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No events yet</span>
            )}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
    </Link>
  );
}
