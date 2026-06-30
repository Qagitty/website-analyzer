'use client';

/**
 * §7 — Global report navigation.
 * Sticky desktop sidebar + compact mobile nav with active-section tracking.
 * §8 — Stable deep links: copy-link action per section.
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { Link2, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NavSection, CategoryScore, ScoreAvailable } from '@/lib/report/view-model';

// ─── Score pip ─────────────────────────────────────────────────────────────────

function ScorePip({ score }: { score: CategoryScore }) {
  if (!score.available) {
    return (
      <span className="text-xs text-muted-foreground/50 tabular-nums w-7 text-right">—</span>
    );
  }
  const s = score as ScoreAvailable;
  return (
    <span className={`text-xs font-semibold tabular-nums w-7 text-right ${s.colorClass}`}>
      {s.value}
    </span>
  );
}

// ─── Copy link button ─────────────────────────────────────────────────────────

function CopyLinkButton({ sectionId }: { sectionId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.href.split('#')[0]}#${sectionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [sectionId]);

  return (
    <button
      onClick={copy}
      aria-label={`Copy link to ${sectionId} section`}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                 text-muted-foreground/40 hover:text-muted-foreground text-xs ml-1 shrink-0"
    >
      {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
    </button>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  section,
  isActive,
  onClick,
}: {
  section: NavSection;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <a
      href={`#${section.id}`}
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className={`group flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
        ${isActive
          ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
        }`}
      aria-current={isActive ? 'location' : undefined}
    >
      <span className="text-base w-5 text-center shrink-0" aria-hidden="true">
        {section.icon}
      </span>
      <span className="flex-1 truncate">{section.label}</span>
      {section.score && <ScorePip score={section.score} />}
      <CopyLinkButton sectionId={section.id} />
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ReportNavProps {
  sections: NavSection[];
  url?: string;
  scannedAt?: string;
  actionsSlot?: ReactNode;
}

export function ReportNav({ sections, url, scannedAt, actionsSlot }: ReportNavProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isManualScrollRef = useRef(false);

  // Intersection Observer to track active section
  useEffect(() => {
    const ids = sections.map(s => s.id);

    const callback: IntersectionObserverCallback = (entries) => {
      if (isManualScrollRef.current) return;

      // Pick the topmost visible section
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0,
    });

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [sections]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    setActiveId(id);
    isManualScrollRef.current = true;

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Re-enable observer tracking after scroll settles
    setTimeout(() => { isManualScrollRef.current = false; }, 1000);

    // Update URL hash without triggering a navigation
    history.replaceState(null, '', `#${id}`);
  }, []);

  return (
    <>
      {/* Desktop sticky sidebar */}
      <nav
        aria-label="Report sections"
        className="hidden lg:flex flex-col gap-1 w-52 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto"
      >
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 mb-1">
          Sections
        </p>
        {sections.map(section => (
          <NavItem
            key={section.id}
            section={section}
            isActive={activeId === section.id}
            onClick={() => scrollToSection(section.id)}
          />
        ))}
      </nav>

      {/* Mobile sticky header — Option C layout */}
      <div className="lg:hidden sticky top-14 z-30 bg-background/95 backdrop-blur border-b border-border/50 -mx-4 -mt-4">

        {/* Row 0: URL + date */}
        {url && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-sm font-semibold text-foreground truncate">{url}</p>
            {scannedAt && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Analyzed {formatDistanceToNow(new Date(scannedAt), { addSuffix: true })}
              </p>
            )}
          </div>
        )}

        {/* 20px spacer before nav rows */}
        <div className="h-5" />

        {/* Row 1: Action buttons (scrollable) */}
        {actionsSlot && (
          <div className="overflow-x-auto px-4 py-1.5">
            {actionsSlot}
          </div>
        )}

        {/* Row 2: Nav pills (scrollable) */}
        <nav aria-label="Report sections" className="overflow-x-auto px-4 py-2">
          <div className="flex gap-1.5 w-max">
            {sections.map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(e) => { e.preventDefault(); scrollToSection(section.id); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                  ${activeId === section.id
                    ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-500 border border-orange-300 dark:border-orange-900/50'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                aria-current={activeId === section.id ? 'location' : undefined}
              >
                <span aria-hidden="true">{section.icon}</span>
                {section.label}
                {section.score?.available && (
                  <span className={`font-bold ${(section.score as ScoreAvailable).colorClass}`}>
                    {(section.score as ScoreAvailable).value}
                  </span>
                )}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
