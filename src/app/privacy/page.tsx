import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-white transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#94A3B8] mb-10">Last updated: May 2026</p>

        <div className="space-y-10 text-[#94A3B8] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">What We Collect</h2>
            <p>When you create an account, we collect your email address and, optionally, a display name. When you submit a website for analysis, we collect the URL you provide. We also collect usage data such as the number of analyses performed and credits consumed. Our servers automatically log IP addresses, browser type, and referring URLs for security and debugging purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How We Use It</h2>
            <p className="mb-3">We use your data to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Provide and improve the Website Analyzer service</li>
              <li>Send transactional emails (analysis complete, payment receipts)</li>
              <li>Detect and prevent fraudulent or abusive activity</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">We do not sell your personal data to third parties or use it for advertising.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Data Storage</h2>
            <p>Your account data and analysis results are stored on Supabase (PostgreSQL), hosted on EU-region servers. Screenshots generated during analysis are stored in Supabase Storage and are retained for 90 days, after which they are automatically deleted. You may request earlier deletion at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Third Parties</h2>
            <p className="mb-3">We share data with the following third-party services to operate the platform:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong className="text-white">Stripe</strong> — payment processing. Stripe stores your payment information; we never store card details.</li>
              <li><strong className="text-white">Anthropic (Claude API)</strong> — AI analysis of screenshots and text. Screenshots may be sent to Anthropic for processing and are subject to Anthropic&apos;s data policies.</li>
              <li><strong className="text-white">Vercel</strong> — hosting and deployment. Request logs are retained for 7 days.</li>
              <li><strong className="text-white">Upstash</strong> — job queue for analysis tasks. Data is transient and not persisted.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Your Rights (GDPR)</h2>
            <p className="mb-3">If you are located in the European Economic Area, you have the following rights:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong className="text-white">Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong className="text-white">Rectification</strong> — request correction of inaccurate data</li>
              <li><strong className="text-white">Erasure</strong> — request deletion of your account and all associated data</li>
              <li><strong className="text-white">Portability</strong> — request your data in a machine-readable format</li>
              <li><strong className="text-white">Objection</strong> — object to certain uses of your data</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at the address below.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>For privacy inquiries, data deletion requests, or any concerns about how we handle your data, please contact us at <a href="mailto:privacy@websiteanalyzer.dev" className="text-indigo-400 hover:text-indigo-300 underline">privacy@websiteanalyzer.dev</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
