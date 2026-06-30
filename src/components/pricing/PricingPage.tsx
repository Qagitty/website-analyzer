'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, X, Zap, ArrowRight, HelpCircle,
  ChevronDown, ChevronUp, Building2, Users, Code2,
} from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

// ─── Pricing data ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthly: 0,
    badge: null,
    color: 'border-border',
    textColor: 'text-muted-foreground',
    checkColor: 'text-emerald-400',
    btnClass: 'border border-border hover:bg-accent text-foreground',
    cta: 'Get started free',
    stripe: null,
    features: [
      '3 audits / month',
      'Performance, SEO & accessibility scores',
      'AI-readiness score (LLM checks)',
      'Basic AI recommendations',
      'Fix roadmap (top 5 issues)',
    ],
    notIncluded: [
      'PDF export',
      'Website monitoring',
      'Remediation board',
      'API access',
      'Lead capture widget',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 29,
    badge: { text: 'Most popular', colorClass: 'from-orange-500 to-orange-500' },
    color: 'border-orange-500/50',
    glow: '0 0 40px rgba(234,88,12,0.2)',
    textColor: 'text-orange-400',
    checkColor: 'text-orange-500',
    btnClass: 'bg-orange-600 text-white hover:from-orange-400 hover:to-orange-400',
    cta: 'Start Pro',
    stripe: 'pro',
    features: [
      '100 audits / month',
      'Everything in Free',
      'PDF export',
      'Full fix roadmap (all issues)',
      'Before / after comparison',
      'Multi-page crawl (10 pages)',
      '1 competitor comparison / audit',
      'Website monitoring (5 sites)',
      'Remediation board',
      'Email alerts',
      'Public report sharing',
    ],
    notIncluded: [
      'API access',
      'Webhooks',
      'Team members',
      'White-label PDF',
      'Lead capture widget',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    monthly: 99,
    badge: null,
    color: 'border-orange-300 dark:border-orange-900/50',
    glow: '0 0 30px rgba(124,58,237,0.08)',
    textColor: 'text-orange-400',
    checkColor: 'text-orange-500',
    btnClass: 'border border-orange-500/40 text-orange-400 hover:bg-orange-50 dark:bg-orange-950/30',
    cta: 'Start Agency',
    stripe: 'agency',
    features: [
      'Unlimited audits (fair use)',
      'Everything in Pro',
      'White-label PDF reports',
      '3 competitor comparisons / audit',
      'Multi-page crawl (50 pages)',
      'Team members (up to 10)',
      'API access (1,000 req / day)',
      'Webhooks & event delivery',
      'Website monitoring (50 sites)',
      'Lead capture widget',
      'Priority support',
    ],
    notIncluded: [],
  },
  {
    id: 'compliance',
    name: 'Compliance',
    monthly: 249,
    badge: { text: 'EAA ready', colorClass: 'from-emerald-600 to-teal-600' },
    color: 'border-emerald-500/30',
    glow: '0 0 30px rgba(5,150,105,0.08)',
    textColor: 'text-emerald-300',
    checkColor: 'text-emerald-400',
    btnClass: 'border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10',
    cta: 'Start Compliance',
    stripe: 'compliance',
    features: [
      'Unlimited audits (fair use)',
      'Everything in Agency',
      'Compliance readiness PDF',
      'Full WCAG 2.1 AA automated checks',
      'Remediation audit trail',
      'Issue lifecycle tracking',
      'Scheduled compliance audits',
      'Historical evidence & reporting',
      'Dedicated compliance support',
    ],
    notIncluded: [],
  },
] as const;

// ─── Feature comparison table rows ───────────────────────────────────────────

type Cell = string | boolean;
interface CompareRow {
  label: string;
  free: Cell;
  pro: Cell;
  agency: Cell;
  compliance: Cell;
  group?: string;
}

export const COMPARE_ROWS: CompareRow[] = [
  // Core
  { label: 'Monthly audits',         free: '3', pro: '100', agency: 'Unlimited', compliance: 'Unlimited', group: 'Core' },
  { label: 'AI recommendations',     free: true,  pro: true,  agency: true,       compliance: true },
  { label: 'Fix roadmap',            free: 'Top 5', pro: 'Full', agency: 'Full',  compliance: 'Full' },
  { label: 'LLM / AI readiness',     free: true,  pro: true,  agency: true,       compliance: true },
  { label: 'Public report sharing',  free: false, pro: true,  agency: true,       compliance: true },
  { label: 'PDF export',             free: false, pro: true,  agency: true,       compliance: true, group: 'Reporting' },
  { label: 'White-label PDF',        free: false, pro: false, agency: true,       compliance: true },
  { label: 'Compliance readiness PDF', free: false, pro: false, agency: false,    compliance: true },
  { label: 'Before / after compare', free: false, pro: true,  agency: true,       compliance: true, group: 'Analysis' },
  { label: 'Multi-page crawl',       free: false, pro: '10 pages', agency: '50 pages', compliance: '50 pages' },
  { label: 'Competitor comparisons', free: false, pro: '1', agency: '3', compliance: '5' },
  { label: 'Website monitoring',     free: false, pro: '5 sites', agency: '50 sites', compliance: '50 sites', group: 'Monitoring & alerts' },
  { label: 'Email alerts',           free: false, pro: true,  agency: true,       compliance: true },
  { label: 'Remediation board',      free: false, pro: true,  agency: true,       compliance: true, group: 'Remediation' },
  { label: 'Audit trail',            free: false, pro: false, agency: false,      compliance: true },
  { label: 'WCAG 2.1 AA automated checks', free: false, pro: false, agency: false, compliance: true },
  { label: 'API access',             free: false, pro: false, agency: '1,000 / day', compliance: '1,000 / day', group: 'Developers' },
  { label: 'Webhooks',               free: false, pro: false, agency: true,       compliance: true },
  { label: 'Lead capture widget',    free: false, pro: false, agency: true,       compliance: true },
  { label: 'Team members',           free: false, pro: false, agency: '10 members', compliance: '10 members', group: 'Team' },
  { label: 'Support',                free: 'Community', pro: 'Email', agency: 'Priority', compliance: 'Dedicated', group: 'Support' },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'What counts as one audit?',
    a: 'Each URL you submit for analysis uses one credit. Multi-page crawls still count as one audit (the crawl is included). Competitor comparisons spend one credit per competitor URL.',
  },
  {
    q: 'Can I cancel or downgrade anytime?',
    a: "Yes. Cancel at any time from Settings → Billing. You keep your plan until the end of the billing period. No questions asked.",
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes — pay annually and save 20% compared to the monthly price. You can switch in Settings → Billing at any time.',
  },
  {
    q: 'Is this a legal accessibility compliance certificate?',
    a: 'No. Our automated checks cover a substantial portion of WCAG 2.1 AA criteria and give you a clear remediation roadmap, but they do not substitute for a full manual audit or legal certification.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Visa, Mastercard, American Express, and most major debit cards via Stripe. Invoices available on Agency and Compliance plans.',
  },
  {
    q: 'How does the Agency lead widget work?',
    a: 'You embed a small JS snippet (or iframe) on any page. Visitors enter their URL and get a free audit report. Their email and audit appear in your Leads dashboard.',
  },
  {
    q: 'Can I white-label the PDF reports?',
    a: 'Yes — on Agency and Compliance plans you can add your agency name, brand color, and logo to all exported PDFs.',
  },
  {
    q: 'Do unused credits roll over?',
    a: 'Credits reset on the first of each billing month. They do not roll over. Unlimited plans (Agency / Compliance) use a large credit pool that effectively never runs out under normal usage.',
  },
];

// ─── Helper cell renderer ─────────────────────────────────────────────────────

function Cell({ value, color }: { value: Cell; color: string }) {
  if (value === true) {
    return <CheckCircle2 className={`h-4 w-4 mx-auto ${color}`} />;
  }
  if (value === false) {
    return <X className="h-3.5 w-3.5 mx-auto text-muted-foreground/25" />;
  }
  return <span className="text-xs text-center block text-foreground/80">{value}</span>;
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        className="flex items-center justify-between w-full py-4 text-left gap-4"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-medium text-sm">{q}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ─── Pricing page ─────────────────────────────────────────────────────────────

export function PricingPage() {
  const [billing, setBilling]   = useState<'monthly' | 'annual'>('monthly');
  const [modal, setModal]       = useState<{ open: boolean; tab: 'signin' | 'signup' }>({ open: false, tab: 'signup' });
  const [showTable, setShowTable] = useState(false);

  const discount = billing === 'annual' ? 0.8 : 1;
  const annualSaving = billing === 'annual';

  function priceLabel(monthly: number): string {
    if (monthly === 0) return '$0';
    const m = Math.round(monthly * discount);
    return `$${m}`;
  }

  function handleCta(planId: string) {
    if (planId === 'free') {
      setModal({ open: true, tab: 'signup' });
    } else {
      setModal({ open: true, tab: 'signup' });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-base">
            <div className="h-7 w-7 rounded-lg bg-orange-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            WebAnalyzer
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/pricing" className="text-foreground font-medium">Pricing</Link>
            <Link href="/changelog" className="hover:text-foreground transition-colors">Changelog</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">API Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => setModal({ open: true, tab: 'signin' })} className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Sign in</button>
            <button
              onClick={() => setModal({ open: true, tab: 'signup' })}
              className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:from-orange-400 hover:to-orange-400 transition-all"
            >
              Get started free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-8 px-4 text-center relative">
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[600px] h-[300px] bg-orange-700/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4">Pricing</p>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Start free.{' '}
            <span className="bg-orange-600 bg-clip-text text-transparent">
              Scale as you grow.
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10">
            No credit card required. Upgrade or cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center rounded-xl bg-card border border-border p-1 gap-1">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all flex items-center gap-2 ${
                billing === 'annual'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual
              <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                billing === 'annual'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                −20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plan cards ───────────────────────────────────────────────── */}
      <section className="py-10 px-4">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border ${plan.color} bg-card p-6 flex flex-col relative`}
              style={(plan as any).glow ? { boxShadow: (plan as any).glow } : undefined}
            >
              {plan.badge && (
                <span className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold whitespace-nowrap bg-gradient-to-r ${plan.badge.colorClass} text-white`}>
                  {plan.badge.text}
                </span>
              )}

              <div className={plan.badge ? 'mt-2 mb-5' : 'mb-5'}>
                <p className={`text-sm font-medium mb-1 ${plan.textColor}`}>{plan.name}</p>
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-bold">{priceLabel(plan.monthly)}</span>
                  {plan.monthly > 0 && (
                    <span className="text-muted-foreground mb-1.5 text-sm">/mo</span>
                  )}
                </div>
                {plan.monthly > 0 && annualSaving && (
                  <p className="text-xs text-emerald-400 mt-0.5">
                    ${plan.monthly * 12 * discount} billed annually
                  </p>
                )}
                {plan.monthly === 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Forever free</p>
                )}
                {plan.monthly > 0 && !annualSaving && (
                  <p className="text-xs text-muted-foreground mt-0.5">Billed monthly</p>
                )}
              </div>

              <ul className="space-y-2 text-sm mb-5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${plan.checkColor}`} />
                    {f}
                  </li>
                ))}
                {plan.notIncluded.length > 0 && plan.notIncluded.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted-foreground/40">
                    <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleCta(plan.id)}
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all mt-auto ${plan.btnClass}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Automated checks only — reports do not constitute legal compliance certification.
        </p>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />

      {/* ── Feature comparison table ──────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Full feature comparison</h2>
            <p className="text-sm text-muted-foreground">Everything that's included at each tier.</p>
          </div>

          {/* Toggle on mobile */}
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto mb-6 md:hidden"
            onClick={() => setShowTable(!showTable)}
          >
            <HelpCircle className="h-4 w-4" />
            {showTable ? 'Hide' : 'Show'} full comparison table
          </button>

          <div className={`${showTable ? 'block' : 'hidden md:block'} overflow-x-auto`}>
            <table className="w-full text-sm border-collapse" role="table" aria-label="Feature comparison">
              <thead>
                <tr>
                  <th className="text-left py-3 pr-4 text-xs text-muted-foreground font-medium w-52">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="text-center py-3 px-2 w-28">
                      <span className={`text-sm font-semibold ${p.textColor}`}>{p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <React.Fragment key={row.label}>
                    {row.group && (
                      <tr>
                        <td colSpan={5} className="pt-5 pb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                          {row.group}
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b border-border/40 transition-colors hover:bg-white/[0.015] ${i % 2 === 0 ? '' : ''}`}
                    >
                      <td className="py-3 pr-4 text-sm text-muted-foreground font-normal">{row.label}</td>
                      {(['free', 'pro', 'agency', 'compliance'] as const).map((planId) => {
                        const plan = PLANS.find((p) => p.id === planId)!;
                        return (
                          <td key={planId} className="py-3 px-2 text-center">
                            <Cell value={row[planId]} color={plan.checkColor} />
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />

      {/* ── Target audience summary ───────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Which plan is right for you?</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Building2,
                label: 'Small Business',
                plan: 'Free or Pro',
                planColor: 'text-orange-500',
                desc: 'Run a few audits a month, catch quick wins on your site, and share your score with stakeholders.',
              },
              {
                icon: Users,
                label: 'Agency / Studio',
                plan: 'Agency',
                planColor: 'text-orange-500',
                desc: 'White-label PDF reports, competitor benchmarks, lead widget, team access, API and webhooks for your workflow.',
              },
              {
                icon: Code2,
                label: 'Compliance / Legal',
                plan: 'Compliance',
                planColor: 'text-emerald-400',
                desc: 'Full WCAG 2.1 AA automated checks, audit trail for evidence, scheduled scans, and compliance-ready PDF.',
              },
            ].map(({ icon: Icon, label, plan, planColor, desc }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="h-9 w-9 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">{label}</p>
                  <p className={`text-sm font-semibold ${planColor}`}>{plan}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">Frequently asked questions</h2>
            <p className="text-sm text-muted-foreground">Can&apos;t find your answer? <a href="mailto:hello@webanalyzer.app" className="text-orange-500 hover:underline">Email us</a>.</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-6">
            {FAQ.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-xl mx-auto space-y-5">
          <h2 className="text-3xl font-bold">Ready to see your real score?</h2>
          <p className="text-muted-foreground text-sm">Start free. Your first report takes under 30 seconds.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => setModal({ open: true, tab: 'signup' })}
              className="inline-flex items-center gap-2 justify-center rounded-xl bg-orange-600 px-7 py-3 text-sm font-semibold text-white hover:from-orange-400 hover:to-orange-400 transition-all"
              style={{ boxShadow: '0 0 24px rgba(234,88,12,0.3)' }}
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/sample-report"
              className="inline-flex items-center gap-2 justify-center rounded-xl border border-border px-7 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              View sample report
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/50">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground/60">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-orange-600 flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span>WebAnalyzer</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-xs">
            <Link href="/pricing" className="hover:text-muted-foreground transition-colors">Pricing</Link>
            <Link href="/changelog" className="hover:text-muted-foreground transition-colors">Changelog</Link>
            <Link href="/docs" className="hover:text-muted-foreground transition-colors">API Docs</Link>
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
          </div>
          <p className="text-xs">© 2026 WebAnalyzer.</p>
        </div>
      </footer>

      <AuthModal open={modal.open} defaultTab={modal.tab} onClose={() => setModal({ open: false, tab: 'signup' })} />
    </div>
  );
}
