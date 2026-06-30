'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Play, RotateCcw } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_URL = 'https://acme-store.com';

const ANALYSIS_STEPS = [
  { emoji: '📸', label: 'Capturing full-page screenshot' },
  { emoji: '⚡', label: 'Running Lighthouse audit (3× sampling)' },
  { emoji: '♿', label: 'Checking WCAG 2.2 compliance' },
  { emoji: '🤖', label: 'Claude AI analyzing results' },
];

const SCORES = [
  { label: 'Performance', value: 87, color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  { label: 'Accessibility', value: 92, color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  { label: 'SEO', value: 78, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  { label: 'LLM Ready', value: 63, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
];

const INSIGHTS = [
  {
    priority: 'HIGH',
    priorityColor: '#f87171',
    priorityBg: 'rgba(248,113,113,0.12)',
    title: 'LCP is 4.2s — above the 2.5s threshold',
    rec: 'Add fetchpriority="high" to hero image and serve WebP format.',
  },
  {
    priority: 'MEDIUM',
    priorityColor: '#fbbf24',
    priorityBg: 'rgba(251,191,36,0.10)',
    title: '3 product images missing alt text',
    rec: 'Add descriptive alt attributes — affects screen reader users.',
  },
  {
    priority: 'LOW',
    priorityColor: '#818cf8',
    priorityBg: 'rgba(129,140,248,0.10)',
    title: 'Sitemap not linked in <head>',
    rec: 'Add <link rel="sitemap"> so AI crawlers discover all pages.',
  },
];

// Phase durations (ms)
const PHASE = {
  TYPING_START: 0,
  TYPING_END: 2600,
  ANALYZING_START: 2800,
  STEP_INTERVAL: 1100,       // each step takes this long
  SCORES_START: 8000,
  SCORE_COUNT_DURATION: 1200,
  INSIGHTS_START: 10500,
  INSIGHT_STAGGER: 600,
  HOLD_END: 16500,
};

// ─── Pure helpers (no hooks) ───────────────────────────────────────────────────

function calcTyping(target: string, elapsed: number): string {
  if (elapsed < PHASE.TYPING_START) return '';
  const e = elapsed - PHASE.TYPING_START;
  const charDelay = (PHASE.TYPING_END - PHASE.TYPING_START) / target.length;
  const charsShown = Math.min(target.length, Math.floor(e / charDelay));
  return target.slice(0, charsShown);
}

function calcCount(target: number, startAt: number, duration: number, elapsed: number): number {
  if (elapsed < startAt) return 0;
  const e = Math.min(elapsed - startAt, duration);
  const eased = 1 - Math.pow(1 - e / duration, 3);
  return Math.round(eased * target);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductDemo() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback((ts: number) => {
    if (startRef.current === null) startRef.current = ts;
    const e = ts - startRef.current;
    setElapsed(e);
    if (e < PHASE.HOLD_END) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setRunning(false);
      startRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    setElapsed(0);
    setRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // All derived values — pure calculations from elapsed, no hooks in loops
  const typedUrl = calcTyping(DEMO_URL, elapsed);
  const showCursor = elapsed < PHASE.TYPING_END + 200;
  const showButton = elapsed >= PHASE.TYPING_END - 100;
  const buttonActive = elapsed >= PHASE.TYPING_END && elapsed < PHASE.ANALYZING_START;

  const phase = !running && elapsed === 0 ? 'idle'
    : elapsed < PHASE.ANALYZING_START ? 'typing'
    : elapsed < PHASE.SCORES_START ? 'analyzing'
    : elapsed < PHASE.INSIGHTS_START ? 'scores'
    : elapsed < PHASE.HOLD_END ? 'insights'
    : 'done';

  const stepsVisible = (phase === 'analyzing' || phase === 'scores' || phase === 'insights')
    ? Math.min(4, Math.floor((elapsed - PHASE.ANALYZING_START) / PHASE.STEP_INTERVAL + 1))
    : 0;

  const scoreValues = useMemo(
    () => SCORES.map(s => calcCount(s.value, PHASE.SCORES_START, PHASE.SCORE_COUNT_DURATION, elapsed)),
    [elapsed]
  );

  const insightsVisible = (phase === 'insights' || phase === 'done')
    ? Math.min(3, Math.floor((elapsed - PHASE.INSIGHTS_START) / PHASE.INSIGHT_STAGGER) + 1)
    : 0;

  const isDone = phase === 'scores' || phase === 'insights' || phase === 'done';

  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-3">See it in action</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">From URL to full report in 30 seconds</h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Watch a live walkthrough of exactly what happens when you analyze a site.
          </p>
        </div>

        {/* Browser chrome */}
        <div
          className="rounded-2xl border border-orange-200 dark:border-orange-900/40 overflow-hidden"
          style={{ boxShadow: '0 0 60px rgba(234,88,12,0.2)' }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
            <div className="h-3 w-3 rounded-full bg-red-500/60" />
            <div className="h-3 w-3 rounded-full bg-amber-500/60" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/60" />
            <div className="flex-1 mx-3 rounded-md bg-background/60 border border-border px-3 py-1 text-xs text-muted-foreground/50 font-mono truncate">
              website-analyzer-eta.vercel.app/analyze
            </div>
          </div>

          {/* Content area */}
          <div className="bg-background flex flex-col">

            {/* ── Phase: idle / typing ── */}
            <AnimatePresence mode="wait">
              {(phase === 'idle' || phase === 'typing') && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.3 } }}
                  className="flex flex-col items-center justify-center p-8 gap-6 min-h-[320px]"
                >
                  <div className="text-center mb-2">
                    <p className="text-lg font-semibold mb-1">Analyze any website</p>
                    <p className="text-sm text-muted-foreground">Enter a URL to get performance, accessibility, SEO, and AI insights.</p>
                  </div>
                  {/* URL input row */}
                  <div className="w-full max-w-lg flex gap-3">
                    <div className="flex-1 rounded-xl border border-orange-300 dark:border-orange-900/50 bg-card px-4 py-3 text-sm font-mono text-foreground/90 flex items-center min-h-[46px]">
                      <span>{typedUrl}</span>
                      {showCursor && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6 }}
                          className="ml-0.5 inline-block w-[2px] h-[14px] bg-orange-500 align-middle"
                        />
                      )}
                    </div>
                    <AnimatePresence>
                      {showButton && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{
                            opacity: 1,
                            scale: buttonActive ? [1, 1.06, 1] : 1,
                            boxShadow: buttonActive
                              ? ['0 0 0px rgba(234,88,12,0.2)', '0 0 20px rgba(234,88,12,0.2)', '0 0 0px rgba(234,88,12,0.2)']
                              : '0 0 0px rgba(234,88,12,0.2)',
                          }}
                          transition={{ duration: 0.4 }}
                          className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white whitespace-nowrap"
                        >
                          Analyze →
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                  {phase === 'idle' && (
                    <p className="text-xs text-muted-foreground/40">Click Play to watch the demo</p>
                  )}
                </motion.div>
              )}

              {/* ── Phase: analyzing ── */}
              {phase === 'analyzing' && (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.3 } }}
                  className="flex flex-col items-center justify-center p-8 gap-5 min-h-[320px]"
                >
                  <div className="text-center mb-2">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                      <p className="text-sm font-semibold text-orange-400">Analyzing {DEMO_URL}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Running 4 analysis engines in parallel…</p>
                  </div>
                  <div className="w-full max-w-sm space-y-3">
                    {ANALYSIS_STEPS.map((step, i) => (
                      <motion.div
                        key={step.label}
                        initial={{ opacity: 0, x: -16 }}
                        animate={i < stepsVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                        transition={{ duration: 0.35 }}
                        className="flex items-center gap-3 rounded-lg bg-card border border-border px-4 py-2.5"
                      >
                        <span className="text-base">{step.emoji}</span>
                        <span className="text-sm text-foreground/80 flex-1">{step.label}</span>
                        {i < stepsVisible - 1 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : i === stepsVisible - 1 ? (
                          <Loader2 className="h-4 w-4 text-orange-500 animate-spin shrink-0" />
                        ) : null}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Phase: scores + insights ── */}
              {(phase === 'scores' || phase === 'insights' || phase === 'done') && (
                <motion.div
                  key="report"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-0 flex-1"
                >
                  {/* Report header */}
                  <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{DEMO_URL}</p>
                      <p className="text-xs text-emerald-400 mt-0.5">Analysis complete · 28s</p>
                    </div>
                    <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                      3 issues found
                    </span>
                  </div>

                  <div className="p-6 flex flex-col gap-6">
                    {/* Score cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {SCORES.map((s, i) => (
                        <motion.div
                          key={s.label}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08, duration: 0.4 }}
                          className="rounded-xl border border-border p-3 text-center"
                          style={{ background: s.bg }}
                        >
                          <div className="text-3xl font-bold tabular-nums" style={{ color: s.color }}>
                            {scoreValues[i]}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                        </motion.div>
                      ))}
                    </div>

                    {/* AI Insights */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        AI Recommendations
                      </p>
                      <div className="space-y-2">
                        {INSIGHTS.map((ins, i) => (
                          <AnimatePresence key={ins.title}>
                            {i < insightsVisible && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className="rounded-lg border border-border bg-card px-4 py-3 flex gap-3 items-start"
                              >
                                <span
                                  className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0"
                                  style={{ color: ins.priorityColor, background: ins.priorityBg }}
                                >
                                  {ins.priority}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{ins.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ins.rec}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-border">
            <motion.div
              className="h-full bg-orange-600 rounded-full"
              style={{ width: running ? `${Math.min(100, (elapsed / PHASE.HOLD_END) * 100)}%` : isDone ? '100%' : '0%' }}
              transition={{ ease: 'linear' }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center mt-5">
          {!running ? (
            <button
              onClick={start}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:from-orange-400 hover:to-orange-400 transition-all"
              style={{ boxShadow: '0 0 20px rgba(234,88,12,0.3)' }}
            >
              {elapsed > 0 ? (
                <><RotateCcw className="h-4 w-4" /> Replay demo</>
              ) : (
                <><Play className="h-4 w-4" /> Play demo</>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
              <span>Running demo…</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
