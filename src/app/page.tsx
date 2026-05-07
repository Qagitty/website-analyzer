import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          Website Analyzer
        </h1>
        <p className="text-base md:text-xl text-muted-foreground max-w-2xl mb-8">
          Automatically analyze your website for performance, accessibility, and SEO.
          Get AI-powered recommendations in under 60 seconds.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">Get Started Free</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="rounded-xl border p-6 space-y-4">
              <div>
                <p className="font-semibold text-lg">Free</p>
                <p className="text-3xl font-bold mt-1">$0</p>
                <p className="text-sm text-muted-foreground">Forever free</p>
              </div>
              <ul className="space-y-2 text-sm">
                {['3 analyses / month', 'Performance scores', 'Accessibility check', 'AI insights', 'PDF export'].map(f => (
                  <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
                ))}
              </ul>
              <a href="/signup" className="block text-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                Get started free
              </a>
            </div>
            {/* Pro */}
            <div className="rounded-xl border-2 border-primary p-6 space-y-4 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">Most popular</span>
              </div>
              <div>
                <p className="font-semibold text-lg">Pro</p>
                <p className="text-3xl font-bold mt-1">$29<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                <p className="text-sm text-muted-foreground">Billed monthly</p>
              </div>
              <ul className="space-y-2 text-sm">
                {['100 analyses / month', 'Everything in Free', 'Scheduled monitoring', 'Slack & webhook alerts', 'Share public reports', 'White-label PDF', 'API access (100 req/day)'].map(f => (
                  <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
                ))}
              </ul>
              <a href="/signup" className="block text-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                Start Pro trial
              </a>
            </div>
            {/* Agency */}
            <div className="rounded-xl border p-6 space-y-4">
              <div>
                <p className="font-semibold text-lg">Agency</p>
                <p className="text-3xl font-bold mt-1">$99<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                <p className="text-sm text-muted-foreground">Billed monthly</p>
              </div>
              <ul className="space-y-2 text-sm">
                {['Unlimited analyses', 'Everything in Pro', 'Team seats (up to 10)', 'Design comparison AI', 'Multi-page crawl', 'API access (1000 req/day)', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
                ))}
              </ul>
              <a href="/signup" className="block text-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                Start Agency trial
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
