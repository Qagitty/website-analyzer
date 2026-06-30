'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Zap, Shield, Brain, BarChart3, CheckCircle2,
  Globe, Code2, Bell, Users, X, FileText, TrendingUp, Building2,
} from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { WebScoreLogo } from '@/components/shared/WebScoreLogo';

type ModalState = { open: boolean; tab: 'signin' | 'signup' };

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever free',
    description: 'Try the product. No credit card required.',
    featured: false,
    badge: null,
    buttonText: 'Get started free',
    features: [
      '3 audits/month',
      'Performance, SEO & accessibility scores',
      'AI-readiness score',
      'Basic AI recommendations',
      'Fix roadmap (top issues)',
    ],
    locked: ['PDF export', 'Monitoring', 'API access', 'Team members'],
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For freelancers and small business owners.',
    featured: true,
    badge: 'Most popular',
    buttonText: 'Start Pro',
    features: [
      '100 audits/month',
      'Everything in Free',
      'PDF export',
      'Full fix roadmap',
      'Before/after comparison',
      'Multi-page crawl (10 pages)',
      '1 competitor comparison',
      'Website monitoring (5 sites)',
      'Remediation board',
      'Public report sharing',
    ],
    locked: ['API access', 'Webhooks', 'Team members', 'White-label PDF'],
  },
  {
    name: 'Agency',
    price: '$99',
    period: '/mo',
    description: 'For web studios and small agencies.',
    featured: false,
    badge: null,
    buttonText: 'Start Agency',
    features: [
      'Unlimited audits (fair use)',
      'Everything in Pro',
      'White-label PDF reports',
      '3 competitor comparisons',
      'Multi-page crawl (50 pages)',
      'Team members (up to 10)',
      'API access (1,000 req/day)',
      'Webhooks',
      'Monitoring (50 sites)',
      'Priority support',
    ],
    locked: [],
  },
  {
    name: 'Compliance',
    price: '$249',
    period: '/mo',
    description: 'For businesses that need accessibility compliance tracking.',
    featured: false,
    badge: 'EAA ready',
    buttonText: 'Start Compliance',
    features: [
      'Unlimited audits (fair use)',
      'Everything in Agency',
      'Compliance readiness PDF',
      'Full WCAG 2.1 AA automated checks',
      'Remediation audit trail',
      'Issue lifecycle tracking',
      'Scheduled compliance audits',
      'Historical evidence & reporting',
    ],
    locked: [],
  },
];

const AUDIENCES = [
  {
    icon: Building2,
    label: 'Small Business',
    headline: 'Find what is hurting your website before your customers do.',
    points: [
      'Improve page speed and reduce bounce rate',
      'Fix SEO basics to get found on Google',
      'Catch accessibility issues before they matter legally',
      'Understand how AI search tools see your site',
      'Get a simple action plan — no technical knowledge needed',
    ],
    cta: 'Audit my website',
    href: '#signup',
  },
  {
    icon: Users,
    label: 'Agencies',
    headline: 'Generate client-ready website audit reports in minutes.',
    points: [
      'White-label PDF reports with your agency branding',
      'Before/after progress reports to prove your work',
      'Compare client sites against competitors',
      'Team access and shared report history',
      'Webhooks and API for your existing workflow',
    ],
    cta: 'Create client report',
    href: '#signup',
  },
  {
    icon: Code2,
    label: 'Developers',
    headline: 'Turn vague website issues into clear technical tasks.',
    points: [
      'Console errors with root-cause analysis',
      'Network bottlenecks and render-blocking resources',
      'Performance metrics with specific code-level fixes',
      'Accessibility violations with copy-paste fix examples',
      'AI-readiness checks for structured data and metadata',
    ],
    cta: 'View technical sample',
    href: '/sample-report',
  },
];

export default function LandingPage() {
  const [url, setUrl] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false, tab: 'signup' });

  const openSignup = () => setModal({ open: true, tab: 'signup' });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 relative flex items-center justify-between">
          <div className="flex items-center gap-2 z-10">
            <WebScoreLogo size={26} className="text-base" />
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground absolute left-1/2 -translate-x-1/2">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#for-who" className="hover:text-foreground transition-colors">Who it&apos;s for</a>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/changelog" className="hover:text-foreground transition-colors">Changelog</Link>
            <Link href="/sample-report" className="hover:text-foreground transition-colors">Sample report</Link>
          </div>
          <div className="flex items-center gap-2 z-10">
            <ThemeToggle />
            <button
              onClick={() => setModal({ open: true, tab: 'signin' })}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Sign in
            </button>
            <button
              onClick={openSignup}
              className="rounded bg-orange-600 px-3 py-1 text-xs sm:text-sm sm:px-4 sm:py-1.5 font-medium text-white hover:bg-orange-500 transition-colors whitespace-nowrap"
            >
              Get started free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 px-3 py-1 text-xs font-medium text-orange-700 dark:text-orange-400 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            AI-powered website audits for SMBs &amp; agencies
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Website audits your clients{' '}
            <span className="text-orange-600 dark:text-orange-400">
              actually understand.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
            Analyze performance, SEO, accessibility, and AI-readiness in one clear report.
            Get prioritized fixes, PDF exports, monitoring, and before/after progress tracking.
          </p>
          <p className="text-sm text-muted-foreground/60 mb-10">
            Built for small businesses, freelancers, and agencies — not enterprise SEO teams.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto mb-4">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="flex-1 rounded border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all"
            />
            <button
              onClick={openSignup}
              className="rounded bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-500 transition-colors whitespace-nowrap flex items-center gap-2 justify-center"
            >
              Run free audit <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
            <span>No credit card required</span>
            <span>·</span>
            <span>3 free audits/month</span>
            <span>·</span>
            <Link href="/sample-report" className="text-orange-600 dark:text-orange-400 hover:underline underline-offset-4">
              View sample report →
            </Link>
          </div>
        </div>

        {/* Score preview card */}
        <div className="max-w-3xl mx-auto mt-16">
          <div className="rounded border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">example.com — analysis complete · 28s</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Performance', score: 87, cls: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Accessibility', score: 92, cls: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'SEO', score: 78, cls: 'text-amber-600 dark:text-amber-400' },
                { label: 'AI-Readiness', score: 63, cls: 'text-amber-600 dark:text-amber-400' },
              ].map(({ label, score, cls }) => (
                <div key={label} className="rounded border border-border bg-background p-4 text-center">
                  <div className={`text-4xl font-bold tabular-nums ${cls}`}>{score}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="rounded border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">Top priority fix</p>
              <p className="text-sm font-medium">Hero image is slowing down page load</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="rounded bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2 py-0.5">High impact</span>
                <span>Effort: Small</span>
                <span>Owner: Developer</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── For Who ─────────────────────────────────────────────────── */}
      <section id="for-who" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-3">Built for real people</p>
            <h2 className="font-serif text-4xl font-bold mb-4">Who is it for?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Not a platform for enterprise SEO teams. Built for people who need clear answers, fast.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {AUDIENCES.map(({ icon: Icon, label, headline, points, cta, href }) => (
              <div key={label} className="rounded border border-border bg-card p-7 flex flex-col hover:border-orange-300 dark:hover:border-orange-800 transition-colors">
                <div className="h-9 w-9 rounded bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center mb-5">
                  <Icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-2">{label}</p>
                <h3 className="font-serif text-lg font-bold mb-4 leading-snug">{headline}</h3>
                <ul className="space-y-2.5 text-sm text-muted-foreground flex-1 mb-6">
                  {points.map(p => (
                    <li key={p} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
                {href === '/sample-report' ? (
                  <Link href={href} className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-500 transition-colors">
                    {cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button onClick={openSignup} className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-500 transition-colors">
                    {cta} <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-3">What you get</p>
            <h2 className="font-serif text-4xl font-bold mb-4">Not just a score. A full action plan.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Seven analysis engines. One clear report. Prioritized fixes your team can act on.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Zap, title: 'Performance audit', desc: 'TTFB, LCP, CLS with 3× median sampling. Specific fixes for render-blocking resources, image compression, and server response.' },
              { icon: Shield, title: 'Accessibility & WCAG', desc: 'Automated WCAG 2.1 AA checks with plain-English explanations, affected users, and copy-paste code fixes.' },
              { icon: Brain, title: 'AI recommendations', desc: 'Claude Vision analyzes your screenshot and returns structured recommendations with business impact and effort estimates.' },
              { icon: BarChart3, title: 'AI-readiness score', desc: '8 checks for how well your site works with AI crawlers — ChatGPT, Perplexity, Google AI Overview, Claude.' },
              { icon: Globe, title: 'Multi-page crawl', desc: 'Crawls internal pages and aggregates scores across your whole site. Catch issues that only appear on inner pages.' },
              { icon: TrendingUp, title: 'Before/after comparison', desc: 'Re-run an audit and see exactly what improved, what is still broken, and what new issues appeared.' },
              { icon: FileText, title: 'Fix roadmap', desc: 'Every issue ranked by business impact and fix effort. Clear owner, acceptance criteria, and expected result.' },
              { icon: Bell, title: 'Monitoring & alerts', desc: 'Recurring checks with email alerts when scores drop. Know before your users complain.' },
              { icon: CheckCircle2, title: 'Client-ready PDFs', desc: 'Export clean branded PDF reports. White-label with your agency name and colors on Agency plan.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded border border-border bg-card p-5 hover:border-orange-300 dark:hover:border-orange-800 transition-colors group">
                <div className="h-9 w-9 rounded bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center mb-4 group-hover:bg-orange-200 dark:group-hover:bg-orange-950/60 transition-colors">
                  <Icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── Sample report CTA ────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto rounded border border-border bg-card p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-3">See it before you sign up</p>
          <h2 className="font-serif text-3xl font-bold mb-3">What does a report look like?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">Browse a real sample report — scores, fix roadmap, AI recommendations, and PDF preview — before creating an account.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sample-report"
              className="inline-flex items-center gap-2 rounded border border-border px-6 py-3 text-sm font-semibold hover:bg-accent transition-colors"
            >
              <FileText className="h-4 w-4" />
              View sample report
            </Link>
            <button
              onClick={openSignup}
              className="inline-flex items-center gap-2 rounded bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-500 transition-colors"
            >
              Run audit on my site <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-3">Pricing</p>
            <h2 className="font-serif text-4xl font-bold mb-4">Start free. Scale as you grow.</h2>
            <p className="text-muted-foreground">No credit card required to get started.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded border bg-card p-6 flex flex-col relative ${
                  plan.featured
                    ? 'border-orange-400 dark:border-orange-600'
                    : 'border-border'
                }`}
              >
                {plan.badge && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded px-3 py-0.5 text-xs font-semibold whitespace-nowrap ${
                    plan.featured
                      ? 'bg-orange-600 text-white'
                      : 'bg-foreground text-background'
                  }`}>
                    {plan.badge}
                  </span>
                )}
                <div className={`${plan.badge ? 'mt-2' : ''} mb-5`}>
                  <p className={`text-sm font-semibold mb-1 ${plan.featured ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period !== 'forever free' && (
                      <span className="text-muted-foreground mb-1.5">{plan.period}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {plan.period === 'forever free' ? 'Forever free' : 'Billed monthly'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{plan.description}</p>
                </div>

                <ul className="space-y-2 text-sm mb-4 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                  {plan.locked.map(f => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground/40">
                      <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={openSignup}
                  className={`w-full rounded px-4 py-2.5 text-sm font-semibold transition-colors mt-auto ${
                    plan.featured
                      ? 'bg-orange-600 text-white hover:bg-orange-500'
                      : 'border border-border hover:bg-accent'
                  }`}
                >
                  {plan.buttonText}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground/50 mt-6">
            Automated accessibility checks only — reports do not constitute legal compliance certification.
          </p>
        </div>
      </section>

      <div className="divider" />

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-5">
            Ready to see your real score?
          </h2>
          <p className="text-muted-foreground mb-3">Start free. Your first report takes under 30 seconds.</p>
          <p className="text-sm text-muted-foreground/60 mb-8">No credit card · 3 free audits/month · Cancel anytime</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={openSignup}
              className="inline-flex items-center gap-2 rounded bg-orange-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-orange-500 transition-colors"
            >
              Run a free audit <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/sample-report"
              className="inline-flex items-center gap-2 rounded border border-border px-8 py-3.5 text-base font-medium hover:bg-accent transition-colors"
            >
              <FileText className="h-4 w-4" />
              View sample report
            </Link>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        open={modal.open}
        defaultTab={modal.tab}
        onClose={() => setModal({ open: false, tab: 'signup' })}
      />

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground/60">
          <WebScoreLogo size={22} className="text-sm" />
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <Link href="/pricing" className="hover:text-muted-foreground transition-colors">Pricing</Link>
            <Link href="/changelog" className="hover:text-muted-foreground transition-colors">Changelog</Link>
            <Link href="/sample-report" className="hover:text-muted-foreground transition-colors">Sample report</Link>
            <Link href="/docs" className="hover:text-muted-foreground transition-colors">API Docs</Link>
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-muted-foreground transition-colors">Cookies</Link>
            <Link href="/refund" className="hover:text-muted-foreground transition-colors">Refunds</Link>
          </div>
          <p>© 2026 WebAnalyzer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
