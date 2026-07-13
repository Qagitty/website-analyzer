'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  serious:  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
  moderate: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  minor:    'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
};

const STATUS_LABELS: Record<string, string> = {
  open:                  'Open',
  in_progress:           'In Progress',
  resolved:              'Resolved',
  verification_required: 'Needs Verification',
  verified:              'Verified',
  accepted_risk:         'Accepted Risk',
  not_applicable:        'Not Applicable',
};

interface Finding {
  id:            string;
  title:         string;
  impact:        string;
  severity?:     string;
  status:        string;
  page_url:      string;
  wcag_level?:   string;
  wcag_criteria?: string[];
  pour_principle?: string;
}

interface Props {
  assessmentId: string;
  onSelectFinding?: (finding: Finding) => void;
}

export function AccessibilityFindingsList({ assessmentId, onSelectFinding }: Props) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [filterStatus, setFilterStatus]   = useState<string>('');
  const [filterImpact, setFilterImpact]   = useState<string>('');
  const [filterLevel, setFilterLevel]     = useState<string>('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: '25' });
    if (filterStatus) params.set('status', filterStatus);
    if (filterImpact) params.set('impact', filterImpact);
    if (filterLevel)  params.set('wcag_level', filterLevel);

    fetch(`/api/accessibility/assessments/${assessmentId}/findings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setFindings(Array.isArray(d.findings) ? d.findings : []);
        setTotal(typeof d.total === 'number' ? d.total : 0);
      })
      .catch(() => setFindings([]))
      .finally(() => setLoading(false));
  }, [assessmentId, page, filterStatus, filterImpact, filterLevel]);

  const impactLabel = (f: Finding) => f.impact ?? f.severity ?? 'unknown';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <fieldset>
        <legend className="sr-only">Filter accessibility findings</legend>
        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger aria-label="Filter by status" className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="accepted_risk">Accepted Risk</SelectItem>
              <SelectItem value="not_applicable">Not Applicable</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterImpact} onValueChange={(v) => { setFilterImpact(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger aria-label="Filter by impact" className="w-[140px]">
              <SelectValue placeholder="All impacts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All impacts</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="serious">Serious</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterLevel} onValueChange={(v) => { setFilterLevel(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger aria-label="Filter by WCAG level" className="w-[140px]">
              <SelectValue placeholder="WCAG level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="AA">AA</SelectItem>
              <SelectItem value="AAA">AAA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      <p className="text-sm text-muted-foreground">{total} finding{total !== 1 ? 's' : ''}</p>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : findings.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No findings match the current filters.
        </Card>
      ) : (
        <ul className="space-y-2" role="list" aria-label="Accessibility findings">
          {findings.map((f) => (
            <li key={f.id}>
              <button
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelectFinding?.(f)}
                aria-label={`Finding: ${f.title}, impact: ${impactLabel(f)}, status: ${STATUS_LABELS[f.status] ?? f.status}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{f.page_url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={IMPACT_COLORS[impactLabel(f)] ?? ''}>
                      {impactLabel(f)}
                    </Badge>
                    {f.wcag_level && (
                      <Badge variant="outline" className="text-xs">
                        WCAG {f.wcag_level}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {STATUS_LABELS[f.status] ?? f.status}
                    </Badge>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {total > 25 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 25 >= total}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
