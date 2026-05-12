import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cookie Policy',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-white transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-sm text-[#94A3B8] mb-10">Last updated: May 2026</p>

        <div className="space-y-10 text-[#94A3B8] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work efficiently, remember your preferences, and provide usage information to site owners.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">What We Use</h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-white/5 bg-[#13131A] p-4">
                <h3 className="font-semibold text-white mb-1.5">Session & Authentication Cookies</h3>
                <p className="text-sm">These cookies are essential for the Service to function. Supabase sets session cookies to keep you logged in across page loads. Without these cookies, you cannot use authenticated features of the Service. These cookies expire when your session ends or after 7 days, whichever comes first.</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-[#13131A] p-4">
                <h3 className="font-semibold text-white mb-1.5">Analytics Cookies</h3>
                <p className="text-sm">We use Vercel Analytics to understand how visitors use the Service. This data is anonymised and aggregated — it does not identify you personally. Analytics help us improve performance and user experience.</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-[#13131A] p-4">
                <h3 className="font-semibold text-white mb-1.5">Consent Cookie</h3>
                <p className="text-sm">When you interact with our cookie banner, we store a <code className="rounded bg-white/5 px-1 font-mono text-xs text-indigo-300">cookie_consent</code> cookie to remember your choice. This cookie lasts for 1 year.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How to Manage Cookies</h2>
            <p className="mb-3">You can control cookies through your browser settings. Most browsers allow you to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>View and delete cookies stored on your device</li>
              <li>Block all cookies from being set</li>
              <li>Block cookies from specific websites</li>
              <li>Configure your browser to alert you when a new cookie is set</li>
            </ul>
            <p className="mt-3">Please note that disabling authentication cookies will prevent you from logging in to the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Third-Party Cookies</h2>
            <p>Vercel Analytics may set cookies or use local storage to measure page performance and visitor behaviour on our behalf. These are subject to Vercel&apos;s own privacy policy. We do not use any advertising or tracking cookies from ad networks.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
