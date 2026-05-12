import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Refund Policy',
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-white transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-4xl font-bold mb-2">Refund Policy</h1>
        <p className="text-sm text-[#94A3B8] mb-10">Last updated: May 2026</p>

        <div className="space-y-10 text-[#94A3B8] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Monthly Subscriptions</h2>
            <p>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period — you will retain access to your plan features until that date. We do not offer partial refunds for unused time within a billing period.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Credits</h2>
            <p>Analysis credits that have been consumed are non-refundable. Credits that are still available on your account at the time of cancellation are forfeited and will not be refunded. Credits are not transferable between accounts.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Exceptions — Technical Failures</h2>
            <p>If a technical failure on our part causes an analysis to fail and credits are consumed without a result being delivered, we will restore those credits to your account. If you experience repeated failures that significantly impair your use of the Service, please contact support and we will review your case for a pro-rata refund at our discretion.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How to Request a Refund</h2>
            <p>To request a refund or credit restoration, contact us by email within 14 days of the charge in question. Please include your account email address and a description of the issue. We aim to respond to all refund requests within 2 business days.</p>
            <p className="mt-3">Email: <a href="mailto:billing@websiteanalyzer.dev" className="text-indigo-400 hover:text-indigo-300 underline">billing@websiteanalyzer.dev</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
