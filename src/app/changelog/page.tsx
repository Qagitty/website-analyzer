import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap, CheckCircle2, Star, Wrench, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { RELEASES } from '@/data/changelog';
import type { TagType } from '@/data/changelog';

export const metadata: Metadata = {
  title: "What's New — WebAnalyzer",
  description:
    'Follow the latest features, improvements, and fixes shipped to WebAnalyzer. Updated with every release.',
  openGraph: {
    title: "What's New — WebAnalyzer",
    description: 'New features and improvements shipped to WebAnalyzer.',
    url: '/changelog',
  },
  alternates: {
    canonical: '/changelog',
  },
};

// ─── Display helpers ──────────────────────────────────────────────────────────

const TAG_STYLE: Record<TagType, { bg: string; text: string }> = {
  Feature:     { bg: 'bg-indigo-500/15 border border-indigo-500/30', text: 'text-indigo-300' },
  Improvement: { bg: 'bg-violet-500/15 border border-violet-500/30', text: 'text-violet-300' },
  Fix:         { bg: 'bg-amber-500/15 border border-amber-500/30',   text: 'text-amber-300' },
  Security:    { bg: 'bg-red-500/15 border border-red-500/30',       text: 'text-red-300' },
};

const TAG_ICON: Record<TagType, React.ComponentType<{ className?: string }>> = {
  Feature:     Sparkles,
  Improvement: Star,
  Fix:         Wrench,
  Security:    CheckCircle2,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-base">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            WebAnalyzer
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/changelog" className="text-foreground font-medium">Changelog</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">API Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-1.5 text-sm font-medium text-white hover:from-indigo-400 hover:to-violet-400 transition-all"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-12 px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4">Changelog</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">What&apos;s new</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          New features, improvements, and fixes — shipped and documented here as they land.
        </p>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

      {/* Timeline */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-3 bottom-3 w-px bg-gradient-to-b from-indigo-500/40 via-border to-transparent hidden sm:block" />

            <div className="space-y-12">
              {RELEASES.map((release) => {
                const { bg, text } = TAG_STYLE[release.tag];
                const TagIcon = TAG_ICON[release.tag];
                return (
                  <article key={release.version} className="sm:pl-8 relative">
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full bg-indigo-500/30 border border-indigo-500/60 hidden sm:block" />

                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}>
                        <TagIcon className="h-3 w-3" />
                        {release.tag}
                      </span>
                      <span className="text-xs text-muted-foreground/60">{release.date}</span>
                      <span className="text-xs font-mono text-muted-foreground/40">v{release.version}</span>
                    </div>

                    <h2 className="text-xl font-bold mb-2">{release.title}</h2>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{release.summary}</p>

                    <ul className="space-y-2">
                      {release.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground/60">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span>WebAnalyzer</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-xs">
            <Link href="/pricing" className="hover:text-muted-foreground transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-muted-foreground transition-colors">API Docs</Link>
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
          </div>
          <p className="text-xs">© 2026 WebAnalyzer.</p>
        </div>
      </footer>
    </div>
  );
}
