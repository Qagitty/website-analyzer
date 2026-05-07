import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AccessibilityIssue } from '@/types/analysis';

const IMPACT_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  serious: 'destructive',
  moderate: 'secondary',
  minor: 'outline',
};

export function AccessibilitySection({ issues }: { issues: AccessibilityIssue[] }) {
  const critical = issues.filter((i) => i.impact === 'critical' || i.impact === 'serious');

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Accessibility</h2>
        <Badge variant={critical.length > 0 ? 'destructive' : 'default'}>
          {issues.length} issue{issues.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {issues.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-green-600 font-medium">
            No accessibility issues found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{issue.id}</CardTitle>
                  <Badge variant={IMPACT_VARIANT[issue.impact] ?? 'secondary'}>
                    {issue.impact}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{issue.description}</p>
                {issue.nodes.length > 0 && (
                  <div className="bg-muted rounded p-2">
                    <p className="text-xs font-medium mb-1">Affected elements:</p>
                    {issue.nodes.map((node, j) => (
                      <code key={j} className="text-xs block truncate">{node}</code>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
