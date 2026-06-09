'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { LighthouseScores } from '@/types/analysis';

interface Props {
  url: string;
  scores: LighthouseScores;
  aiSummary: string | null;
  /** ISO timestamp of when the analysis completed */
  completedAt: string | null;
}

/* ---------- helpers ---------- */

function gradeFromScore(s: number): { letter: string; label: string; color: string; ring: string } {
  if (s >= 90) return { letter: 'A', label: 'Excellent', color: 'text-emerald-400', ring: 'border-emerald-500' };
  if (s >= 75) return { letter: 'B', label: 'Good',      color: 'text-emerald-400', ring: 'border-emerald-500' };
  if (s >= 60) return { letter: 'C', label: 'Fair',      color: 'text-amber-400',   ring: 'border-amber-500'   };
  if (s >= 45) return { letter: 'D', label: 'Poor',      color: 'text-orange-400',  ring: 'border-orange-500'  };
  return              { letter: 'F', label: 'Critical',  color: 'text-red-400',     ring: 'border-red-500'     };
}

function scoreColor(s: number): string {
  if (s >= 90) return 'text-emerald-400';
  if (s >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBarColor(s: number): string {
  if (s >= 90) return 'bg-emerald-500';
  if (s >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

interface ScoreRowProps {
  label: string;
  score: number;
  icon: string;
}

function ScoreRow({ label, score, icon }: ScoreRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-6 text-center shrink-0">{icon}</span>
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-semibold w-10 text-right tabular-nums ${scoreColor(score)}`}>
        {score}
      </span>
    </div>
  );
}

/* ---------- component ---------- */

export function ExecSummarySection({ url, scores, aiSummary, completedAt }: Props) {
  const avg = Math.round(
    (scores.performance + scores.accessibility + scores.bestPractices + scores.seo) / 4,
  );
  const grade = gradeFromScore(avg);
  const domain = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  const date = completedAt
    ? new Date(completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <section className="space-y-4">
      {/* Title row */}
      <div>
        <h2 className="text-2xl font-bold">Executive Summary</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {domain}{date ? ` · Analysed ${date}` : ''}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Overall grade */}
        <Card className="bg-card border border-border flex flex-col items-center justify-center py-8 md:py-10">
          <CardContent className="p-0 flex flex-col items-center gap-2">
            <div
              className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${grade.ring}`}
            >
              <span className={`text-4xl font-extrabold leading-none ${grade.color}`}>
                {grade.letter}
              </span>
            </div>
            <p className={`text-sm font-semibold ${grade.color}`}>{grade.label}</p>
            <p className="text-xs text-muted-foreground">Overall score {avg}/100</p>
          </CardContent>
        </Card>

        {/* Score bars */}
        <Card className="bg-card border border-border md:col-span-2">
          <CardContent className="pt-6 space-y-3">
            <ScoreRow label="Performance"    score={scores.performance}    icon="⚡" />
            <ScoreRow label="Accessibility"  score={scores.accessibility}  icon="♿" />
            <ScoreRow label="Best Practices" score={scores.bestPractices}  icon="✅" />
            <ScoreRow label="SEO"            score={scores.seo}            icon="🔍" />
            {typeof scores.llmReadiness === 'number' && (
              <ScoreRow label="AI-Readiness" score={scores.llmReadiness}   icon="🤖" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plain-language summary */}
      {aiSummary && (
        <Card className="bg-indigo-500/5 border border-indigo-500/20">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">💬</span>
              <p className="text-sm leading-relaxed text-muted-foreground">{aiSummary}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
