'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Zap, Shield, Brain, BarChart3, CheckCircle2, Globe, Code2, Bell, Users } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';

type ModalState = { open: boolean; tab: 'signin' | 'signup' };

export default function LandingPage() {
  const [url, setUrl] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false, tab: 'signup' });

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC] overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-base">WebAnalyzer</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-[#94A3B8]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setModal({ open: true, tab: 'signin' })} className="text-sm text-[#94A3B8] hover:text-white transition-colors hidden sm:block">Sign in</button>
            <button onClick={() => setModal({ open: true, tab: 'signup' })} className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-1.5 text-sm font-medium text-white hover:from-indigo-400 hover:to-violet-400 transition-all">
              Get started free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 bg-grid">
        {/* Radial glow behind headline */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI-powered website analysis
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Your site score,{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              explained.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#94A3B8] max-w-2xl mx-auto mb-10 leading-relaxed">
            Performance, accessibility, SEO, and LLM readiness — analyzed in 30 seconds.
            Get AI-powered recommendations you can actually act on.
          </p>

          {/* URL input CTA */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-6">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="flex-1 rounded-xl border border-indigo-500/20 bg-[#13131A] px-4 py-3 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button
              onClick={() => setModal({ open: true, tab: 'signup' })}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white hover:from-indigo-400 hover:to-violet-400 transition-all whitespace-nowrap flex items-center gap-2 justify-center"
              style={{ boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}
            >
              Analyze free <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-[#475569]">No credit card required · 3 free analyses/month</p>
        </div>

        {/* Score cards preview */}
        <div className="relative max-w-3xl mx-auto mt-16">
          {/* Fake report preview */}
          <div className="rounded-2xl border border-indigo-500/20 bg-[#13131A] p-6 shadow-2xl" style={{ boxShadow: '0 0 60px rgba(99,102,241,0.1)' }}>
            <div className="flex items-center gap-2 mb-6">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs text-[#475569] font-mono">example.com — analysis complete</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Performance', score: 87, color: 'text-emerald-400' },
                { label: 'Accessibility', score: 92, color: 'text-emerald-400' },
                { label: 'SEO', score: 78, color: 'text-amber-400' },
                { label: 'LLM Ready', score: 63, color: 'text-amber-400' },
              ].map(({ label, score, color }) => (
                <div key={label} className="rounded-xl border border-white/5 bg-[#0A0A0F] p-4 text-center">
                  <div className={`text-4xl font-bold tabular-nums ${color}`}>{score}</div>
                  <div className="text-xs text-[#94A3B8] mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 h-1 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#475569]">
              <span>Analysis complete · 28s</span>
              <span className="text-indigo-400">3 issues need attention →</span>
            </div>
          </div>
          {/* Glow under card */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-indigo-500/20 blur-2xl rounded-full" />
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Everything you need</p>
            <h2 className="text-4xl font-bold mb-4">Not just a score. A full diagnosis.</h2>
            <p className="text-[#94A3B8] max-w-xl mx-auto">Seven integrated analysis engines in one report. No tab-switching, no five different tools.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Zap, title: 'Performance', desc: 'TTFB, LCP, CLS measured with 3× median sampling for accuracy. No noisy single-sample scores.' },
              { icon: Shield, title: 'Accessibility & EAA', desc: 'WCAG 2.2 violations with plain-English explanations and ready-to-paste code fixes. EAA compliance tracking.' },
              { icon: Brain, title: 'AI Insights', desc: 'Claude Vision analyzes your screenshot and explains every issue like a senior engineer would.' },
              { icon: BarChart3, title: 'LLM Readiness', desc: 'New: see how ready your site is for AI crawlers — ChatGPT, Perplexity, Claude, Google AI.' },
              { icon: Globe, title: 'Site Crawl', desc: 'Automatically crawls up to 5 internal pages and aggregates scores across your whole site.' },
              { icon: Bell, title: 'Monitoring & Alerts', desc: 'Weekly checks with Slack and webhook alerts when scores drop. Know before your users do.' },
              { icon: Code2, title: 'REST API', desc: 'Full programmatic access. Integrate analysis into your CI/CD pipeline with a single curl command.' },
              { icon: Users, title: 'Team Seats', desc: 'Invite your team on Agency plan. Shared report history, role-based access.' },
              { icon: CheckCircle2, title: 'White-label PDF', desc: 'Send branded PDF reports to clients with your agency name and colors.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-white/5 bg-[#13131A] p-5 hover:border-indigo-500/30 transition-colors group">
                <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                  <Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Pricing</p>
            <h2 className="text-4xl font-bold mb-4">Start free. Scale as you grow.</h2>
            <p className="text-[#94A3B8]">No credit card required to get started.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="rounded-2xl border border-white/5 bg-[#13131A] p-7 space-y-6">
              <div>
                <p className="text-sm font-medium text-[#94A3B8] mb-1">Free</p>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-bold">$0</span>
                </div>
                <p className="text-sm text-[#475569] mt-1">Forever free</p>
              </div>
              <ul className="space-y-3 text-sm">
                {['3 analyses / month', 'Performance scores', 'Accessibility check', 'AI insights', 'PDF export'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-[#94A3B8]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => setModal({ open: true, tab: 'signup' })} className="w-full text-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors">
                Get started free
              </button>
            </div>

            {/* Pro — highlighted */}
            <div className="rounded-2xl border border-indigo-500/40 bg-[#13131A] p-7 space-y-6 relative" style={{ boxShadow: '0 0 40px rgba(99,102,241,0.15)' }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-1 text-xs font-semibold text-white">Most popular</span>
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-300 mb-1">Pro</p>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-bold">$29</span>
                  <span className="text-[#94A3B8] mb-1.5">/mo</span>
                </div>
                <p className="text-sm text-[#475569] mt-1">Billed monthly</p>
              </div>
              <ul className="space-y-3 text-sm">
                {['100 analyses / month', 'Everything in Free', 'Scheduled monitoring', 'Slack & webhook alerts', 'Public report sharing', 'White-label PDF', 'API access (100 req/day)'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-[#94A3B8]">
                    <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => setModal({ open: true, tab: 'signup' })} className="w-full text-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:from-indigo-400 hover:to-violet-400 transition-all">
                Start Pro trial
              </button>
            </div>

            {/* Agency */}
            <div className="rounded-2xl border border-white/5 bg-[#13131A] p-7 space-y-6">
              <div>
                <p className="text-sm font-medium text-[#94A3B8] mb-1">Agency</p>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-bold">$99</span>
                  <span className="text-[#94A3B8] mb-1.5">/mo</span>
                </div>
                <p className="text-sm text-[#475569] mt-1">Billed monthly</p>
              </div>
              <ul className="space-y-3 text-sm">
                {['Unlimited analyses', 'Everything in Pro', 'Team seats (up to 10)', 'Design comparison AI', 'Multi-page crawl', 'API (1000 req/day)', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-[#94A3B8]">
                    <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => setModal({ open: true, tab: 'signup' })} className="w-full text-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors">
                Start Agency trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

      {/* Final CTA */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-80 h-40 bg-indigo-600/15 rounded-full blur-[80px]" />
            </div>
            <h2 className="relative text-4xl md:text-5xl font-bold mb-5">
              Ready to see your{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                real score?
              </span>
            </h2>
          </div>
          <p className="text-[#94A3B8] mb-8">Start free. Your first report takes 30 seconds.</p>
          <button
            onClick={() => setModal({ open: true, tab: 'signup' })}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-3.5 text-base font-semibold text-white hover:from-indigo-400 hover:to-violet-400 transition-all"
            style={{ boxShadow: '0 0 32px rgba(99,102,241,0.35)' }}
          >
            Analyze your site free <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        open={modal.open}
        defaultTab={modal.tab}
        onClose={() => setModal({ open: false, tab: 'signup' })}
      />

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#475569]">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span>WebAnalyzer</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <Link href="/docs" className="hover:text-[#94A3B8] transition-colors">API Docs</Link>
            <a href="#pricing" className="hover:text-[#94A3B8] transition-colors">Pricing</a>
            <button onClick={() => setModal({ open: true, tab: 'signin' })} className="hover:text-[#94A3B8] transition-colors">Sign in</button>
            <Link href="/privacy" className="hover:text-[#94A3B8] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#94A3B8] transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-[#94A3B8] transition-colors">Cookies</Link>
            <Link href="/refund" className="hover:text-[#94A3B8] transition-colors">Refunds</Link>
          </div>
          <p>© 2026 WebAnalyzer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
