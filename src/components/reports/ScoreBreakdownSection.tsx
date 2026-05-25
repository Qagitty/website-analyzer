'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ScoreBreakdown, ScoreCheckItem } from '@/types/analysis';

const SCORE_BG = (s: number) =>
  s >= 80
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    : s >= 50
    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    : 'bg-red-500/10 border-red-500/20 text-red-400';

function CategoryCard({
  title,
  score,
  icon,
  checks,
}: {
  title: string;
  score: number;
  icon: string;
  checks: ScoreCheckItem[];
}) {
  const failed = checks.filter((c) => !c.passed);
  const passed = checks.filter((c) => c.passed);

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span>{icon}</span>
            {title}
          </CardTitle>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${SCORE_BG(score)}`}>
            {score}/100
          </span>
        </div>
        {failed.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {failed.length} check{failed.length !== 1 ? 's' : ''} failed &middot; {passed.length} passed
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {failed.map((c, i) => (
          <div key={i} className="rounded-md bg-red-500/5 border border-red-500/15 p-2.5">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium text-foreground">{c.label}</p>
                {c.details && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.details}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {passed.length > 0 && (
          <div className="space-y-1 pt-1">
            {passed.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>
        )}
        {failed.length === 0 && (
          <p className="text-xs text-emerald-400 font-medium">All checks passed ✓</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ScoreBreakdownSection({
  breakdown,
  scores,
}: {
  breakdown: ScoreBreakdown;
  scores: { performance: number; bestPractices: number; seo: number; accessibility: number };
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Score Breakdown</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Why each score is what it is — and exactly what to fix
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryCard title="Performance" score={scores.performance} icon="⚡" checks={breakdown.performance} />
        <CategoryCard title="Best Practices" score={scores.bestPractices} icon="🛡️" checks={breakdown.bestPractices} />
        <CategoryCard title="SEO" score={scores.seo} icon="🔍" checks={breakdown.seo} />
        <CategoryCard title="Accessibility" score={scores.accessibility} icon="♿" checks={breakdown.accessibility} />
      </div>
    </section>
  );
}
