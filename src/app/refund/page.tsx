import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Refund Policy',
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-4xl font-bold mb-2">Refund Policy</h1>
        <p className="text-sm text-muted-foreground mb-2">Last updated: May 2026</p>
        <p className="text-sm text-muted-foreground mb-10">We aim to resolve all billing issues fairly and promptly. If something went wrong, please reach out — we will do our best to make it right.</p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Cancellation</h2>
            <p>You may cancel your subscription at any time from the Settings page. Cancellation stops the next renewal — you retain full access to your plan features until the end of the current billing period. No further charges are made after cancellation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Refunds on Subscriptions</h2>
            <p>Subscription fees are generally non-refundable once a billing period has started, as access to the Service is granted immediately upon payment. We do not offer partial refunds for unused time within a billing period.</p>
            <p className="mt-3">Exceptions are assessed on a case-by-case basis — for example, if you were charged after cancellation, if a technical issue on our part prevented you from using the Service for a significant portion of the period, or if required by applicable consumer protection law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Credits</h2>
            <p>Analysis credits that have been consumed are non-refundable. Unused credits expire at the end of the billing period and are not refundable. Credits are not transferable between accounts.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Technical Failures</h2>
            <p>If a technical failure on our part causes an analysis to fail and credits are consumed without a result being delivered, we will restore those credits to your account. If you experience repeated failures that significantly impair your use of the Service, contact support and we will review your case for a pro-rata refund.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Duplicate or Erroneous Charges</h2>
            <p>Accidental duplicate charges or billing errors will be corrected in full upon verification. If you notice an unexpected or duplicate charge on your account, please contact us as soon as possible and we will investigate and resolve it promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Your Consumer Rights</h2>
            <p>Nothing in this policy affects any mandatory rights you may have under applicable consumer protection laws in your country of residence, including EU consumer regulations where applicable.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">How to Request a Refund</h2>
            <p>To request a refund or credit restoration, contact us by email within a reasonable time after the charge in question — preferably within 14 days. Please include your account email address and a description of the issue. We aim to respond to all billing requests within 2 business days.</p>
            <p className="mt-3">
              Email:{' '}
              <a href="mailto:billing@websiteanalyzer.dev" className="text-orange-700 dark:text-orange-500 hover:text-orange-600 dark:hover:text-orange-500 underline transition-colors">
                billing@websiteanalyzer.dev
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
