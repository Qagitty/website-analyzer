import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ConsoleError } from '@/types/analysis';

export function ConsoleErrorsSection({ errors }: { errors: ConsoleError[] }) {
  const errorCount = errors.filter((e) => e.type === 'error').length;
  const warnCount = errors.filter((e) => e.type === 'warning').length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Console Errors</h2>
        {errorCount > 0 && <Badge variant="destructive">{errorCount} errors</Badge>}
        {warnCount > 0 && <Badge variant="secondary">{warnCount} warnings</Badge>}
      </div>

      {errors.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-green-600 font-medium">
            No console errors found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {errors.map((err, i) => (
            <Card key={i} className={err.type === 'error' ? 'border-red-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Badge
                    variant={err.type === 'error' ? 'destructive' : 'secondary'}
                    className="shrink-0 mt-0.5"
                  >
                    {err.type}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-mono break-all">{err.message}</p>
                    {err.source && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {err.source}{err.line ? `:${err.line}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
