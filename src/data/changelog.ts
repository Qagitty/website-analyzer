export type TagType = 'Feature' | 'Improvement' | 'Fix' | 'Security';

export interface Release {
  version: string;
  date: string;
  tag: TagType;
  title: string;
  summary: string;
  items: string[];
}

export const RELEASES: Release[] = [
  {
    version: '2.1',
    date: '2026-06-09',
    tag: 'Feature',
    title: 'Agency Lead Capture Widget',
    summary: 'Agencies can now embed a "Get a Free Audit" widget on any client-facing website to capture leads and auto-run their audit.',
    items: [
      'Embeddable JS snippet (<script>) with floating button, configurable color, text, and position',
      'Hosted widget page (/widget/[key]) for sharing as a direct link or iframe embed',
      'Leads dashboard — track all widget-submitted audit requests with email, status, and report link',
      'Widget key management — regenerate keys, configure settings, copy embed codes from Settings',
      'Rate-limited to 20 submissions/day per key and 3/hr per visitor IP',
    ],
  },
  {
    version: '2.0',
    date: '2026-06-03',
    tag: 'Feature',
    title: 'Competitor Comparison & White-label PDF',
    summary: 'Compare your site against up to 5 competitor URLs side-by-side, and export client-ready white-label PDF reports.',
    items: [
      'Competitor comparison (/analyze/compare): submit your URL + competitor URLs in one form',
      'Side-by-side score cards with trophy winner indicator per metric',
      'Full metrics table (Performance, Accessibility, SEO, LCP, CLS, TTFB)',
      'White-label PDF: add your agency logo, name, and brand color (Agency plan)',
      'Logo upload in Settings → Branding with 2 MB limit (PNG/JPG/WebP)',
    ],
  },
  {
    version: '1.9',
    date: '2026-05-28',
    tag: 'Feature',
    title: 'Compliance Platform',
    summary: 'A dedicated WCAG 2.1 AA compliance dashboard for tracking, remediating, and evidencing accessibility issues.',
    items: [
      'Compliance dashboard (/compliance): issue list with severity, WCAG criteria, and lifecycle state',
      'Remediation board (/remediation): Kanban-style board (Open / In Progress / Fixed / Verified)',
      'Compliance readiness PDF with WCAG coverage, open issue count, and audit trail',
      'Scheduled compliance audits (Compliance plan)',
      'Historical evidence & reporting for legal documentation',
    ],
  },
  {
    version: '1.8',
    date: '2026-05-20',
    tag: 'Feature',
    title: 'Public Developer API & Webhooks',
    summary: 'Full REST API with API key management, per-plan rate limiting, and webhook delivery with HMAC signatures.',
    items: [
      'POST /api/v1/analyze — trigger analyses programmatically',
      'GET /api/v1/analyses — list all analyses with pagination',
      'GET /api/v1/reports/[id] — fetch a complete report in JSON',
      'API keys with wa_live_ prefix and SHA-256 hashing',
      'Webhook delivery with HMAC-SHA256 signatures and Slack Block Kit format',
      'Per-plan rate limits (Agency: 1,000 req/day)',
    ],
  },
  {
    version: '1.7',
    date: '2026-05-14',
    tag: 'Feature',
    title: 'LLM Readiness Score & Internal Link Crawler',
    summary: 'Two new analysis modules: an 8-point AI-readiness check and a multi-page site crawler.',
    items: [
      'LLM readiness score — checks robots.txt, sitemap, structured data, Open Graph, rel=canonical, meta description, og:image, and JSON-LD',
      'Internal link crawler — discovers and audits up to 10/50 internal pages per crawl (Pro/Agency)',
      'CrawledPagesSection component with per-page score table and status badges',
    ],
  },
  {
    version: '1.6',
    date: '2026-05-07',
    tag: 'Improvement',
    title: 'Dark Observatory Design System',
    summary: 'Complete visual overhaul of all 43 pages and components with a consistent dark design system.',
    items: [
      '#0A0A0F base background, indigo-500→violet-500 primary gradient',
      'Score-aware colour palette: emerald (≥80), amber (50–79), red (<50)',
      '.text-gradient, .glow-indigo, .bg-grid CSS utilities',
      'Mobile-first layout audit across all dashboard pages',
      'Loading skeleton components across dashboard and report pages',
    ],
  },
  {
    version: '1.5',
    date: '2026-04-30',
    tag: 'Feature',
    title: 'Website Monitoring & Scheduled Alerts',
    summary: 'Set up recurring audits with email alerts when scores drop below your threshold.',
    items: [
      'Monitors page (/monitors): create/edit/delete scheduled monitors',
      'Cron job (/api/cron/monitors) triggers re-analysis for due monitors',
      'Email notification when score drops below user-configured threshold',
      'TrendChart component for visualising score history over time',
    ],
  },
  {
    version: '1.4',
    date: '2026-04-22',
    tag: 'Feature',
    title: 'Stripe Billing & Team Members',
    summary: 'Stripe checkout, subscription management, and multi-seat team access.',
    items: [
      'Stripe checkout flow for Pro, Agency, and Compliance plans',
      'Subscription webhook handler: sync plan, credits, and period on payment events',
      'Team members form: invite collaborators by email (Agency plan)',
      'Settings page with profile, notifications, billing portal, API keys, webhooks, and team tabs',
    ],
  },
  {
    version: '1.3',
    date: '2026-04-15',
    tag: 'Feature',
    title: 'AI Insights & PDF Export',
    summary: 'Claude Vision analysis of screenshots and branded PDF report export.',
    items: [
      'Claude Vision analyses every screenshot for UX, layout, and accessibility issues',
      'AI insights section with quick wins, categorised issues, and impact estimates',
      'PDF export (/api/reports/[id]/pdf) using @react-pdf/renderer',
      'Public report sharing (/share/[id]) — shareable link without auth',
    ],
  },
  {
    version: '1.0',
    date: '2026-04-01',
    tag: 'Feature',
    title: 'Initial Launch',
    summary: 'Core analysis engine, authentication, and basic reporting.',
    items: [
      'Cloudflare Worker: Playwright screenshot, axe-core accessibility checks, performance scoring',
      'Supabase auth (email + Google OAuth), Redis job queue',
      'Analysis status polling, queue position display',
      'Performance section with Recharts radar chart and Core Web Vitals',
      'Console errors and WCAG violations sections',
    ],
  },
];
