import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  return 'bg-red-500/10 text-red-400 border border-red-500/20';
}

export function LLMReadinessSection({ scores }: Props) {
  if (scores.llmReadiness === undefined) return null;

  const { llmReadiness, llmChecks, llmSignals } = scores;
  const checksToRender = llmChecks ?? {};

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">AI &amp; LLM Readiness</h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadgeClass(llmReadiness)}`}>
          {llmReadiness}/100
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        How well this page is optimised for AI crawlers (ChatGPT, Claude, Perplexity, Google AI).
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Readiness Checks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-white/5">
            {CHECK_ORDER.map((key) => {
              const passing = checksToRender[key] ?? false;
              return (
                <li key={key} className="flex items-center gap-3 hover:bg-white/[0.03] rounded-lg px-3 py-2 transition-colors">
                  {passing ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400/40 shrink-0" />
                  )}
                  <span className={passing ? 'text-sm' : 'text-sm text-muted-foreground'}>
                    {CHECK_LABELS[key] ?? key}
                  </span>
                  <span className="ml-auto text-xs font-medium">
                    {passing ? (
                      <span className="text-emerald-400">Pass</span>
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
        <div className="bg-[#1C1C27] border border-indigo-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-indigo-400" />
            <span className="text-base font-semibold text-foreground">How to improve</span>
          </div>
          <ul className="space-y-2">
            {llmSignals.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                <span className="text-muted-foreground">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
