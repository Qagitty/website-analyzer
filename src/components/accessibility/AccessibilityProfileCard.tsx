'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AccessibilityRiskBadge } from './AccessibilityRiskBadge';
import { ShieldCheck, Globe, Calendar, ChevronRight } from 'lucide-react';
import type { AccessibilityRiskLevel } from '@/types/accessibility-profile';

export interface AccessibilityProfileSummary {
  id:               string;
  name:             string;
  site_url:         string;
  status:           string;
  latest_risk_level?: AccessibilityRiskLevel | null;
  last_assessed_at?: string | null;
  assessment_count?: number;
  coverage_percent?: number;
}

interface Props {
  profile: AccessibilityProfileSummary;
  onAssess?: (profileId: string) => void;
  assessing?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:   { label: 'Active',   className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  archived: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
  paused:   { label: 'Paused',   className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
};

export function AccessibilityProfileCard({ profile, onAssess, assessing }: Props) {
  const status = STATUS_CONFIG[profile.status] ?? STATUS_CONFIG.active;

  return (
    <Card className="hover:border-indigo-500/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-indigo-500 shrink-0" aria-hidden="true" />
              <h3 className="font-semibold truncate">{profile.name}</h3>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{profile.site_url}</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={status.className}
            aria-label={`Profile status: ${status.label}`}
          >
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <AccessibilityRiskBadge level={profile.latest_risk_level} size="sm" />
          {profile.last_assessed_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              <span>
                {new Date(profile.last_assessed_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day:   'numeric',
                  year:  'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {typeof profile.coverage_percent === 'number' && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{profile.coverage_percent}%</span> page coverage
            {typeof profile.assessment_count === 'number' && profile.assessment_count > 0 && (
              <span> · {profile.assessment_count} assessment{profile.assessment_count !== 1 ? 's' : ''}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAssess?.(profile.id)}
            disabled={assessing || profile.status === 'archived'}
            aria-label={`Run new accessibility assessment for ${profile.name}`}
            className="flex-1"
          >
            {assessing ? 'Starting…' : 'Run Assessment'}
          </Button>
          <Button variant="ghost" size="sm" asChild aria-label={`View ${profile.name} profile details`}>
            <Link href={`/accessibility/${profile.id}`}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
