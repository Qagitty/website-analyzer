'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BASE_URL = 'https://website-analyzer-eta.vercel.app/api/v1';

function CodeBlock({ code, id }: { code: string; id: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative rounded-lg bg-background border border-border">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded bg-accent hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className="overflow-x-auto p-4 pr-12 text-sm text-foreground font-mono leading-relaxed whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono ${
        method === 'POST'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
      }`}
    >
      {method}
    </span>
  );
}

function BackButton() {
  const params = useSearchParams();
  const from = params.get('from');
  const href = from === 'settings' ? '/settings' : '/';
  const label = from === 'settings' ? 'Back to Settings' : 'Back to Home';

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <Suspense fallback={<div className="h-8 mb-6" />}>
            <BackButton />
          </Suspense>
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-4xl font-bold text-foreground">WebAnalyzer API</h1>
            <Badge className="text-sm bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">v1</Badge>
          </div>
          <p className="text-lg text-muted-foreground">
            Analyze any website programmatically and retrieve detailed performance, accessibility, and AI reports.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        {/* Base URL */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Base URL</h2>
          <CodeBlock id="base-url" code={BASE_URL} />
        </section>

        {/* Authentication */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Authentication</h2>
          <p className="text-muted-foreground">
            All API requests require an API key passed in the{' '}
            <code className="rounded bg-accent px-1 py-0.5 text-sm font-mono text-indigo-600 dark:text-indigo-300">Authorization</code>{' '}
            header as a Bearer token.
          </p>
          <CodeBlock
            id="auth-header"
            code={`Authorization: Bearer wa_live_<your_api_key>`}
          />
          <p className="text-sm text-muted-foreground">
            You can generate API keys in your{' '}
            <Link href="/settings" className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors">
              account settings
            </Link>
            .
          </p>
        </section>

        {/* Rate limits */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Rate Limits</h2>
          <p className="text-muted-foreground">
            Requests are rate-limited per API key per calendar day (UTC). The current usage is
            returned in response headers.
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Requests per day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="px-4 py-3">Free</td>
                  <td className="px-4 py-3">10</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Pro</td>
                  <td className="px-4 py-3">100</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Agency</td>
                  <td className="px-4 py-3">1,000</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Header</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">X-RateLimit-Limit</td>
                  <td className="px-4 py-3">Your daily request limit</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">X-RateLimit-Remaining</td>
                  <td className="px-4 py-3">Requests remaining today</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-8">
          <h2 className="text-2xl font-semibold text-foreground">Endpoints</h2>

          {/* POST /api/v1/analyze */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <MethodBadge method="POST" />
                <code className="font-mono font-normal">/api/v1/analyze</code>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Submit a URL for analysis. Returns immediately with an <code className="rounded bg-accent px-1 py-0.5 text-xs font-mono text-indigo-600 dark:text-indigo-300">analysisId</code> that
                you can use to poll for results. Consumes one credit.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Request body</p>
                <CodeBlock
                  id="analyze-req"
                  code={`{
  "url": "https://example.com"
}`}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Response — 202 Accepted</p>
                <CodeBlock
                  id="analyze-res"
                  code={`{
  "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "queued",
  "url": "https://example.com"
}`}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">curl example</p>
                <CodeBlock
                  id="analyze-curl"
                  code={`curl -X POST ${BASE_URL}/analyze \\
  -H "Authorization: Bearer wa_live_<your_key>" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'`}
                />
              </div>
            </CardContent>
          </Card>

          {/* GET /api/v1/reports/{id} */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <MethodBadge method="GET" />
                <code className="font-mono font-normal">/api/v1/reports/{'{id}'}</code>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Retrieve a completed analysis report by ID. Poll this endpoint after submitting a
                URL until <code className="rounded bg-accent px-1 py-0.5 text-xs font-mono text-indigo-600 dark:text-indigo-300">status</code> is{' '}
                <code className="rounded bg-accent px-1 py-0.5 text-xs font-mono text-indigo-600 dark:text-indigo-300">completed</code>.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Response — 200 OK</p>
                <CodeBlock
                  id="report-res"
                  code={`{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "url": "https://example.com",
  "status": "completed",
  "lighthouse_scores": {
    "performance": 87,
    "accessibility": 92,
    "seo": 78,
    "bestPractices": 86
  },
  "ai_summary": "The site loads quickly and scores well on accessibility...",
  "created_at": "2026-05-07T10:00:00Z",
  "completed_at": "2026-05-07T10:00:45Z"
}`}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">curl example</p>
                <CodeBlock
                  id="report-curl"
                  code={`curl ${BASE_URL}/reports/3fa85f64-5717-4562-b3fc-2c963f66afa6 \\
  -H "Authorization: Bearer wa_live_<your_key>"`}
                />
              </div>
            </CardContent>
          </Card>

          {/* GET /api/v1/analyses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <MethodBadge method="GET" />
                <code className="font-mono font-normal">/api/v1/analyses</code>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                List your recent analyses in reverse-chronological order with pagination.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Query parameters</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-foreground">Parameter</th>
                        <th className="text-left px-4 py-2 font-medium text-foreground">Default</th>
                        <th className="text-left px-4 py-2 font-medium text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-muted-foreground">
                      <tr>
                        <td className="px-4 py-2 font-mono text-xs">limit</td>
                        <td className="px-4 py-2">10</td>
                        <td className="px-4 py-2">Results per page (max 50)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono text-xs">page</td>
                        <td className="px-4 py-2">1</td>
                        <td className="px-4 py-2">Page number (1-indexed)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Response — 200 OK</p>
                <CodeBlock
                  id="analyses-res"
                  code={`{
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "url": "https://example.com",
      "status": "completed",
      "created_at": "2026-05-07T10:00:00Z",
      "completed_at": "2026-05-07T10:00:45Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42
  }
}`}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">curl example</p>
                <CodeBlock
                  id="analyses-curl"
                  code={`curl "${BASE_URL}/analyses?limit=5&page=1" \\
  -H "Authorization: Bearer wa_live_<your_key>"`}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Error codes */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Error Codes</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">400</td>
                  <td className="px-4 py-3">Bad request — invalid URL or missing parameter</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">401</td>
                  <td className="px-4 py-3">Unauthorized — invalid or missing API key</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">402</td>
                  <td className="px-4 py-3">Payment required — no credits remaining</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">404</td>
                  <td className="px-4 py-3">Not found — report does not exist or belongs to another user</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">429</td>
                  <td className="px-4 py-3">Rate limit exceeded — upgrade your plan for more requests</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">500</td>
                  <td className="px-4 py-3">Internal server error — contact support</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-8 text-center space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Ready to get started?</h3>
          <p className="text-muted-foreground">
            Generate your API key in settings and start analyzing websites programmatically.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white hover:from-indigo-400 hover:to-violet-400 transition-all"
          >
            Get your API key in Settings &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
