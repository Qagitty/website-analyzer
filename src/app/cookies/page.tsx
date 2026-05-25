import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cookie Policy',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: May 2026</p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They are used to make websites work, remember your preferences, and provide usage information to site owners.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Your Consent</h2>
            <p className="mb-3">
              We separate cookies into two categories: <strong className="text-foreground">essential</strong> cookies (always active — required for the Service to function) and <strong className="text-foreground">optional analytics</strong> cookies (only activated after you click <em>Accept all</em> in the cookie banner).
            </p>
            <p>
              Clicking <em>Reject optional</em> blocks all analytics cookies. Essential cookies are still set because the Service cannot work without them. You can change your choice at any time by clearing your browser cookies and reloading the page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Cookies We Use</h2>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Cookie</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Purpose</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Duration</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">sb-access-token</td>
                    <td className="px-4 py-3">Keeps you logged in (Supabase auth)</td>
                    <td className="px-4 py-3">Session / 7 days</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium">Essential</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">sb-refresh-token</td>
                    <td className="px-4 py-3">Refreshes your auth session (Supabase)</td>
                    <td className="px-4 py-3">7 days</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium">Essential</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">cookie_consent</td>
                    <td className="px-4 py-3">Stores your cookie preference</td>
                    <td className="px-4 py-3">1 year</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium">Essential</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">_vercel_insights_*</td>
                    <td className="px-4 py-3">Measures page views and performance (Vercel Analytics) — anonymised, no personal identification</td>
                    <td className="px-4 py-3">Up to 1 year</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-xs font-medium">Optional</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm">
              Optional analytics cookies are <strong className="text-foreground">only activated after you click Accept all</strong>. Clicking <em>Reject optional</em> means no analytics cookies are ever set during your visit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Analytics & Anonymisation</h2>
            <p>
              We use Vercel Analytics to understand how visitors use the Service. Data collected is aggregated and anonymised — it does not personally identify you. We use this data solely to improve performance and user experience. We do not use any advertising or third-party tracking cookies.
            </p>
            <p className="mt-3">
              EU regulators may still classify analytics cookies as non-essential regardless of anonymisation. This is why we require explicit opt-in consent before any analytics cookies are set.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">How to Manage Cookies</h2>
            <p className="mb-3">You can control cookies through your browser settings. Most browsers let you:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>View and delete cookies stored on your device</li>
              <li>Block all cookies or cookies from specific websites</li>
              <li>Configure alerts when a new cookie is set</li>
            </ul>
            <p className="mt-3">Disabling authentication cookies will prevent you from logging in to the Service.</p>
            <p className="mt-3">
              To withdraw analytics consent: clear the <code className="rounded bg-muted px-1 font-mono text-xs">cookie_consent</code> cookie in your browser, then reload the page and click <em>Reject optional</em>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">More Information</h2>
            <p>
              For full details on how we collect, use, and protect your personal data — including your rights under GDPR — see our{' '}
              <Link href="/privacy" className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
                Privacy Policy
              </Link>
              . For any questions about cookies or consent, contact us at{' '}
              <a href="mailto:privacy@websiteanalyzer.dev" className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
                privacy@websiteanalyzer.dev
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
