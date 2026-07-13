'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, XCircle, AlertCircle } from 'lucide-react';

const RESULT_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pass:          { label: 'Pass',          icon: CheckCircle2,  className: 'text-emerald-600' },
  fail:          { label: 'Fail',          icon: XCircle,       className: 'text-red-600' },
  partial:       { label: 'Partial',       icon: AlertCircle,   className: 'text-amber-600' },
  not_tested:    { label: 'Not Tested',    icon: Circle,        className: 'text-muted-foreground' },
  not_applicable:{ label: 'N/A',           icon: Circle,        className: 'text-muted-foreground' },
};

export interface ManualCheckItem {
  id:             string;
  resultId?:      string;
  name:           string;
  description:    string;
  wcag_criteria?: string[];
  result:         string;
  notes?:         string;
  reviewed_at?:   string;
}

interface Props {
  checks:       ManualCheckItem[];
  onSelectCheck?: (check: ManualCheckItem) => void;
}

export function AccessibilityManualCheckGrid({ checks, onSelectCheck }: Props) {
  const totalChecks = checks.length;
  const done        = checks.filter((c) => c.result === 'pass' || c.result === 'fail' || c.result === 'partial' || c.result === 'not_applicable').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {done}/{totalChecks} checks reviewed
        </p>
        {totalChecks > 0 && (
          <Badge variant="outline" className={done === totalChecks ? 'text-emerald-600' : 'text-amber-600'}>
            {done === totalChecks ? 'All reviewed' : 'In progress'}
          </Badge>
        )}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list" aria-label="Manual accessibility checks">
        {checks.map((check) => {
          const config = RESULT_CONFIG[check.result] ?? RESULT_CONFIG.not_tested;
          const Icon   = config.icon;

          return (
            <li key={check.id}>
              <button
                className="w-full text-left"
                onClick={() => onSelectCheck?.(check)}
                aria-label={`Manual check: ${check.name}, result: ${config.label}`}
              >
                <Card className="hover:border-indigo-500/40 transition-colors h-full">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{check.name}</p>
                      <Icon
                        className={`h-4 w-4 shrink-0 mt-0.5 ${config.className}`}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{check.description}</p>
                    {check.wcag_criteria && check.wcag_criteria.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {check.wcag_criteria.slice(0, 3).map((c) => (
                          <Badge key={c} variant="outline" className="text-xs px-1">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className={`text-xs font-medium ${config.className}`}>{config.label}</p>
                  </CardContent>
                </Card>
              </button>
            </li>
          );
        })}
      </ul>

      {checks.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          No manual checks available for this assessment.
        </Card>
      )}
    </div>
  );
}
