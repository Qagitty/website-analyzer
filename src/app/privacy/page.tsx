import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: May 2026</p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">What We Collect</h2>
            <p>When you create an account, we collect your email address and, optionally, a display name. When you submit a website for analysis, we collect the URL you provide. We also collect usage data such as the number of analyses performed and credits consumed. Our servers automatically log limited technical metadata — including IP address, browser type, and referrer information — for security and debugging purposes.</p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">How We Use It</h2>
            <p className="mb-3">We use your data to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Provide and improve the Website Analyzer service</li>
              <li>Send transactional emails (analysis complete, payment receipts)</li>
              <li>Detect and prevent fraudulent or abusive activity</li>
              <li>Comply with legal and accounting obligations</li>
            </ul>
            <p className="mt-3">We do not sell your personal data to third parties or use it for advertising.</p>
          </section>

          {/* 3 — NEW */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Legal Basis for Processing (GDPR Article 6)</h2>
            <p className="mb-3">We process personal data under the following legal bases:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Performance of a contract</strong> — processing your account data, running analyses, and sending transactional notifications are necessary to deliver the Service you signed up for.
              </li>
              <li>
                <strong className="text-foreground">Legitimate interests</strong> — logging limited technical metadata for security, fraud prevention, and service stability, provided these interests are not overridden by your rights.
              </li>
              <li>
                <strong className="text-foreground">Consent</strong> — optional analytics cookies are only activated after you explicitly accept them via the cookie banner.
              </li>
              <li>
                <strong className="text-foreground">Compliance with legal obligations</strong> — retaining billing records and invoices as required by applicable tax and accounting law.
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-foreground">Screenshots</strong> — retained for 90 days from the date of analysis, then automatically deleted. You may request earlier deletion at any time.</li>
              <li><strong className="text-foreground">Analysis results &amp; account data</strong> — retained for the lifetime of your account. Upon account deletion, all associated data is removed within 30 days, except where retention is required by law.</li>
              <li><strong className="text-foreground">Billing records</strong> — retained for as long as required by applicable tax and accounting obligations (typically 7 years in the EU).</li>
              <li><strong className="text-foreground">Server logs</strong> — Vercel request logs are retained for 7 days.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Subprocessors</h2>
            <p className="mb-3">We share data with the following third-party services to operate the platform. The list of subprocessors may change over time; material changes will be reflected in an updated version of this policy.</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Provider</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Purpose</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Data location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Supabase</td>
                    <td className="px-4 py-3">Database, authentication, file storage</td>
                    <td className="px-4 py-3">EU (Frankfurt)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Stripe</td>
                    <td className="px-4 py-3">Payment processing. Stripe stores payment information; we never store card details.</td>
                    <td className="px-4 py-3">US / EU</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Anthropic</td>
                    <td className="px-4 py-3">AI analysis of screenshots and page content via Claude API</td>
                    <td className="px-4 py-3">US</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Vercel</td>
                    <td className="px-4 py-3">Hosting, deployment, edge functions. Request logs retained 7 days.</td>
                    <td className="px-4 py-3">US / EU (edge)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Upstash</td>
                    <td className="px-4 py-3">Job queue for analysis tasks. Data is transient and not persisted.</td>
                    <td className="px-4 py-3">EU</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm">
              Some providers (Anthropic, Stripe, Vercel) may process data outside the European Economic Area. Where applicable, we rely on appropriate safeguards such as Standard Contractual Clauses (SCCs) as permitted under GDPR Chapter V.
            </p>
          </section>

          {/* 6 — NEW */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Automated Processing &amp; AI</h2>
            <p>Analysis results are generated automatically using AI systems (Anthropic Claude). These results may occasionally contain inaccuracies and should be treated as advisory rather than definitive. No solely automated decisions with legal or similarly significant effects are made about users.</p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Your Rights (GDPR)</h2>
            <p className="mb-3">If you are located in the European Economic Area, you have the following rights:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong className="text-foreground">Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong className="text-foreground">Rectification</strong> — request correction of inaccurate data</li>
              <li><strong className="text-foreground">Erasure</strong> — request deletion of your account and all associated data; we aim to process deletion requests within 30 days</li>
              <li><strong className="text-foreground">Portability</strong> — request your data in a machine-readable format</li>
              <li><strong className="text-foreground">Objection</strong> — object to processing based on legitimate interests</li>
              <li><strong className="text-foreground">Restriction</strong> — request that we limit processing of your data in certain circumstances</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at the address below. You also have the right to lodge a complaint with your local data protection authority.</p>
          </section>

          {/* 8 — NEW */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Age Restriction</h2>
            <p>The Service is not intended for users under the age of 16. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.</p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Contact</h2>
            <p>For privacy inquiries, data deletion requests, or any concerns about how we handle your data, please contact us at{' '}
              <a href="mailto:privacy@websiteanalyzer.dev" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 underline transition-colors">
                privacy@websiteanalyzer.dev
              </a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
