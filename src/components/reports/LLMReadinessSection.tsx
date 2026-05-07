import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';

interface Props {
  scores: {
    llmReadiness?: number;
    llmChecks?: Record<string, boolean>;
    llmSignals?: string[];
  };
}

const CHECK_LABELS: Record<string, string> = {
  hasStructuredData: 'Structured Data (JSON-LD)',
  hasMetaDescription: 'Meta Description',
  hasOpenGraph: 'Open Graph Tags',
  hasSitemap: 'Sitemap Linked',
  allowsAIBots: 'AI Bots Allowed',
  hasCleanHeadings: 'Clean Heading Structure',
  hasSufficientContent: 'Sufficient Content',
  hasCanonical: 'Canonical URL',
};

const CHECK_ORDER = [
  'hasStructuredData',
  'hasMetaDescription',
  'hasOpenGraph',
  'hasSitemap',
  'allowsAIBots',
  'hasCleanHeadings',
  'hasSufficientContent',
  'hasCanonical',
];

function scoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 80) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

export function LLMReadinessSection({ scores }: Props) {
  if (scores.llmReadiness === undefined) return null;

  const { llmReadiness, llmChecks, llmSignals } = scores;
  const checksToRender = llmChecks ?? {};

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">AI &amp; LLM Readiness</h2>
        <Badge variant={scoreBadgeVariant(llmReadiness)}>
          <span className={scoreColor(llmReadiness)}>{llmReadiness}/100</span>
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        How well this page is optimised for AI crawlers (ChatGPT, Claude, Perplexity, Google AI).
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Readiness Checks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {CHECK_ORDER.map((key) => {
              const passing = checksToRender[key] ?? false;
              return (
                <li key={key} className="flex items-center gap-3 px-6 py-3">
                  {passing ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <span className={passing ? 'text-sm' : 'text-sm text-muted-foreground'}>
                    {CHECK_LABELS[key] ?? key}
                  </span>
                  <span className="ml-auto text-xs font-medium">
                    {passing ? (
                      <span className="text-green-600">Pass</span>
                    ) : (
                      <span className="text-muted-foreground">Fail</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {llmSignals && llmSignals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              How to improve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {llmSignals.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-yellow-500 mt-0.5 shrink-0">•</span>
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
