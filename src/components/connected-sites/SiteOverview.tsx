'use client';

import { Globe, Clock, Shield, Zap, FileSearch, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConnectedSiteStatusBadge } from './ConnectedSiteStatusBadge';
import type { ConnectedSiteWithDetails } from '@/types/connected-sites';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  site: ConnectedSiteWithDetails;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10 border border-indigo-500/20">
            <Icon className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SiteOverview({ site }: Props) {
  const status = site.site_connection_status?.[0] ?? null;
  const activeKey = site.connected_site_keys?.find((k) => k.status === 'active');

  const heartbeat = site.last_heartbeat_at ?? status?.last_seen_at ?? null;
  const heartbeatLabel = heartbeat
    ? formatDistanceToNow(new Date(heartbeat), { addSuffix: true })
    : 'Never';

  const verifiedLabel = site.verified_at
    ? formatDistanceToNow(new Date(site.verified_at), { addSuffix: true })
    : '—';

  return (
    <div className="space-y-6">
      {/* Connection status banner */}
      {!site.is_enabled && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-300">
          This site is currently disabled. Enable it in Settings to resume data collection.
        </div>
      )}
      {site.verification_status === 'unverified' && (
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 text-sm text-indigo-300">
          This site has not been verified yet. Go to the Installation tab to add the script and verify ownership.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Shield} label="Verification" value={site.verification_status} sub={verifiedLabel} />
        <StatCard icon={Activity} label="Last seen" value={heartbeatLabel} sub={status?.sdk_version ? `v${status.sdk_version}` : undefined} />
        <StatCard icon={Globe} label="Environment" value={site.environment ?? 'production'} />
        <StatCard
          icon={Zap}
          label="Script load"
          value={status?.script_load_status?.replace(/_/g, ' ') ?? 'unknown'}
        />
      </div>

      {/* Site details */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Site details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Origin</p>
              <p className="font-mono text-foreground">{site.normalized_origin}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Root URL</p>
              <p className="font-mono text-foreground truncate">{site.root_url}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Active key prefix</p>
              <p className="font-mono text-foreground">{activeKey?.key_prefix ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Verification method</p>
              <p className="text-foreground capitalize">
                {site.verification_method?.replace('_', ' ') ?? '—'}
              </p>
            </div>
          </div>

          {/* Feature flags */}
          <div className="border-t border-border/50 pt-3">
            <p className="text-xs text-muted-foreground mb-2">Active features</p>
            <div className="flex flex-wrap gap-2">
              {site.telemetry_enabled && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Telemetry
                </Badge>
              )}
              {site.indexing_diagnostics_enabled && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Indexing diagnostics
                </Badge>
              )}
              {site.crawler_visibility_enabled && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Crawler visibility
                </Badge>
              )}
              {!site.telemetry_enabled && !site.indexing_diagnostics_enabled && !site.crawler_visibility_enabled && (
                <p className="text-xs text-muted-foreground">No features enabled — configure in Settings</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key history */}
      {site.connected_site_keys && site.connected_site_keys.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Site key history</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {site.connected_site_keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                >
                  <div>
                    <p className="font-mono text-sm text-foreground">{key.key_prefix}…</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                      {key.last_used_at &&
                        ` · Last used ${formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}`}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      key.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : key.status === 'rotated'
                        ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }
                  >
                    {key.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
