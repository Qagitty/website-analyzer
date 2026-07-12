'use client';

import Link from 'next/link';
import { Globe, Clock, Zap, FileSearch, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConnectedSiteStatusBadge } from './ConnectedSiteStatusBadge';
import type { ConnectedSiteWithDetails, ConnectedSiteViewModel } from '@/types/connected-sites';

interface Props {
  site: ConnectedSiteWithDetails;
  viewModel: ConnectedSiteViewModel;
}

function FeaturePip({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {enabled ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <MinusCircle className="h-3 w-3 text-zinc-600" />
      )}
      {label}
    </span>
  );
}

export function ConnectedSiteCard({ site, viewModel }: Props) {
  const envColors: Record<string, string> = {
    production: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    staging: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    development: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <Link href={`/sites/${site.id}`}>
      <Card className="border-border/50 bg-card hover:border-indigo-500/30 hover:bg-card/80 transition-colors cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 border border-indigo-500/20">
                <Globe className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground truncate">{viewModel.name}</p>
                  <Badge
                    variant="outline"
                    className={envColors[viewModel.environment] ?? envColors.production}
                  >
                    {viewModel.environment}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {viewModel.origin}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ConnectedSiteStatusBadge status={site.verification_status} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/50 pt-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {viewModel.lastHeartbeatLabel}
            </span>
            {viewModel.scriptVersion && (
              <span className="text-xs text-muted-foreground font-mono">
                v{viewModel.scriptVersion}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{viewModel.connectionLabel}</span>
            <div className="ml-auto flex items-center gap-3">
              <FeaturePip label="Telemetry" enabled={viewModel.telemetryEnabled} />
              <FeaturePip label="Indexing" enabled={viewModel.indexingEnabled} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
