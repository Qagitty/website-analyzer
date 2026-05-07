import { Card, CardContent } from '@/components/ui/card';

interface Props {
  analyses: any[];
  settings: { credits: number; credits_used: number } | null;
}

export function StatsOverview({ analyses, settings }: Props) {
  const completed = analyses.filter((a) => a.status === 'completed');
  const avgScore = completed.length
    ? Math.round(
        completed.reduce((sum, a) => sum + (a.lighthouse_scores?.performance ?? 0), 0) /
          completed.length
      )
    : null;

  const stats = [
    {
      label: 'Total Analyses',
      value: analyses.length,
      sub: `${analyses.filter((a) => a.status === 'completed').length} completed`,
    },
    {
      label: 'Avg Performance',
      value: avgScore != null ? `${avgScore}/100` : '—',
      sub: avgScore != null ? `across ${completed.length} completed scan${completed.length !== 1 ? 's' : ''}` : 'no completed scans yet',
    },
    {
      label: 'Credits Remaining',
      value: settings?.credits ?? 0,
      sub: 'analyses you can run',
    },
    {
      label: 'Credits Used',
      value: settings?.credits_used ?? 0,
      sub: 'analyses run so far',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div
              className={`text-2xl md:text-3xl font-bold tabular-nums ${
                stat.label === 'Credits Remaining'
                  ? (stat.value as number) <= 1
                    ? 'text-amber-400'
                    : 'text-foreground'
                  : 'text-foreground'
              }`}
            >
              {stat.value}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{stat.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
