# WebScore

Automated website quality analysis with AI-powered recommendations — performance, accessibility, SEO, console errors, connected sites, fix requests, and runtime error monitoring.

## Features

| Feature | Description |
|---------|-------------|
| **Performance Analysis** | Lighthouse scores, Core Web Vitals (LCP, INP, CLS, TTFB), radar chart |
| **Accessibility Audit** | WCAG violations with impact levels, node selectors, EAA compliance mapping, remediation tracking |
| **SEO Audit** | 40+ checks across 10 weighted categories, structured data, hreflang, robots.txt, sitemap |
| **LLM Readiness** | Evidence-based scoring across 9 weighted categories (crawlability, structured data, llms.txt, etc.) |
| **Security Headers Audit** | CSP quality analysis, HSTS staged rollout, redirect chain capture, per-header scoring |
| **Best Practices** | 10 categories including HTTPS, SRI, cookies, third-party risk |
| **AI Insights** | Claude Vision analyses screenshots for UX issues with inline code fix suggestions |
| **Design Comparison** | Upload Figma/design screenshots — Claude compares fidelity score and mismatches |
| **Competitor Comparison** | Analyze up to 5 URLs side-by-side with Score Breakdown table |
| **Shareable Reports** | One-click public `/share/{id}` URL, no login required |
| **Scheduled Monitoring** | Daily/weekly automated re-analysis with Vercel Cron, email alerts on score drops, bulk page actions, run detail view |
| **Multi-format Export** | PDF, DOCX, XLSX, JSON, Markdown — plus compliance-framed PDF (Pro+) |
| **Remediation Tracking** | Track individual issues through open → in_progress → resolved → verified lifecycle (Pro+) |
| **Regional Accessibility Risk** | Versioned jurisdiction profiles (WCAG 2.1/2.2, EN 301 549, Section 508), 7-dimension risk model, conservative applicability assessment |
| **Accessibility End-to-End Workflow** | Profile setup wizard, automated assessments with SHA-256 finding fingerprints, 22-item manual check catalog, statement generator (DRAFT disclaimer, no certification claims), scheduled assessments, regression detection |
| **Connected Sites** | Link verified websites via JS snippet (`ws_site_` keys), continuous telemetry: web vitals, route discovery, indexing checks |
| **Fix Requests** | Structured workflow to send findings to developers — 6 request types, 17-status state machine, 6 delivery channels, external scoped-token links |
| **Runtime Error Monitoring** | Capture real browser errors via JS SDK (`ws_err_` keys), deterministic issue grouping, regression detection, Fix Request integration |
| **Stripe Subscriptions** | Free (3 credits), Pro ($29/mo, 100 credits), Agency ($99/mo, unlimited), Compliance ($249/mo) |
| **Public API (v1)** | REST API with `wa_live_` key auth, per-plan rate limiting, HMAC webhook signatures |
| **Agency Lead Widget** | Embeddable JS widget + hosted page captures leads; `/leads` dashboard for Agency+ users |
| **Pricing Page** | Standalone `/pricing` with monthly/annual toggle, comparison table, FAQ, Schema.org JSON-LD |
| **Changelog Page** | Public `/changelog` timeline driven by `src/data/changelog.ts` |

## Security

Security audit completed 2026-06-29. 0 open findings.

| Control | Implementation |
|---------|---------------|
| **API key encryption** | AES-256-GCM + PBKDF2-SHA256 (600K iterations, `v2:` prefix) |
| **Worker callback auth** | HMAC-SHA256 + startup guard (500 if secrets not bound) |
| **CSRF** | Centralized in middleware; excludes `/api/widget/`, `/api/v1/`, `/api/error-monitoring/` |
| **SSRF prevention** | `validateAnalysisUrl()` + `fetchSameOriginOnly()` blocks private IPs and redirect-chain hops |
| **Rate limiting** | Fail-closed — Redis outage → 503, not bypass |
| **Supply chain** | npm `overrides` for `form-data` + `ws` CVEs; CI runs `npm audit --audit-level=high` |
| **Key namespaces** | `wa_live_` (API), `ws_site_` (Connected Sites), `ws_err_` (Error Monitoring), `wk_live_` (Widget) |

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Next.js API Routes + Cloudflare Workers (fetch-only, HTML analysis + Claude Vision) |
| Database | Supabase (PostgreSQL + Auth + Storage) — 33 migrations |
| Queue | Upstash Redis (24 job types) |
| AI | Claude API (Anthropic) — `claude-sonnet-4-6` (vision + text) |
| Email | Resend |
| Payments | Stripe |
| Deployment | Vercel + Cloudflare Workers |

## Sprint History

| Sprint | Feature | Status |
|--------|---------|--------|
| Sprint 1 | Core analysis engine (Worker, HTML analysis, scoring) | Complete |
| Sprint 2 | Authentication, URL input, analysis status polling | Complete |
| Sprint 3 | AI analysis with Claude Vision, detailed reports, PDF export | Complete |
| Sprint 4 | Dashboard, Stripe billing, error boundaries | Complete |
| Sprint 5 | API keys, Agency Lead Widget | Complete |
| Sprint 6 | Webhook delivery, Pricing page, Changelog | Complete |
| Sprint 7 | LLM Readiness scoring | Complete |
| Sprint 8 | Onboarding banner, multi-page crawl | Complete |
| Security Audit | Trail of Bits 4-phase audit (21 findings, all resolved) | Complete |
| Sprint 9 | Regional Accessibility Risk Assessment | Complete |
| Sprint 10 | Unified Fix Request Workflow (domain logic + API) | Complete |
| Sprint 13 | Multi-page Monitor bulk actions + run detail UI | Complete |
| Sprint 14 | Connected Sites UI (6-tab dashboard) | Complete |
| Sprint 15 | Fix Requests UI (create, send, track, close) | Complete |
| Sprint 16 | Runtime Error Monitoring (SDK, ingestion, issue grouping, dashboard) | Complete |
| Sprint 17 | Accessibility End-to-End Workflow (profiles, assessments, findings, manual checks, statement generator, scheduled assessments, regression detection) | Complete |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and fill in values
cp .env.local.example .env.local
# Edit .env.local with your keys (see Environment Setup below)

# 3. Run database migrations
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Server-only, never exposed to browser

# Upstash Redis (job queue)
UPSTASH_REDIS_URL=https://...upstash.io
UPSTASH_REDIS_TOKEN=...

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Cloudflare Worker (browser automation)
CLOUDFLARE_WORKER_URL=https://analyzer.yourname.workers.dev
CLOUDFLARE_WORKER_AUTH_TOKEN=...        # Worker validates this header
WORKER_CALLBACK_SECRET=...              # App validates Worker callbacks

# Stripe
STRIPE_SECRET_KEY=sk_live_...           # Use sk_test_... for development
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_AGENCY_PRICE_ID=price_...

# Email alerts (optional)
RESEND_API_KEY=re_...                   # If unset, emails are silently skipped
EMAIL_FROM=noreply@yourdomain.com

# Vercel Cron security
CRON_SECRET=your-random-secret

# App
NEXT_PUBLIC_APP_URL=https://yourapp.com  # No trailing slash
```

## Environment Setup

### Supabase (required)
1. Create project at [supabase.com](https://supabase.com)
2. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
5. Enable Google OAuth: Authentication → Providers → Google → set redirect URL to `https://your-domain.com/auth/callback`
6. Create storage bucket named `screenshots` (private)

### Upstash Redis (required for queue)
1. Create database at [console.upstash.com](https://console.upstash.com)
2. Copy **REST URL** → `UPSTASH_REDIS_URL`
3. Copy **REST Token** → `UPSTASH_REDIS_TOKEN`

### Anthropic (required for AI analysis)
1. Get key at [console.anthropic.com](https://console.anthropic.com)
2. Copy key → `ANTHROPIC_API_KEY`
3. Model used: `claude-sonnet-4-6` (vision + text)

### Cloudflare Worker (required for browser automation)
```bash
cd src/workers/analyzer
wrangler deploy
wrangler secret put WORKER_AUTH_TOKEN
wrangler secret put WORKER_CALLBACK_SECRET
```

### Stripe (required for payments)
1. Get keys at [dashboard.stripe.com](https://dashboard.stripe.com/apikeys)
2. Create products: **Pro** ($29/mo), **Agency** ($99/mo), **Compliance** ($249/mo)
3. Copy price IDs → `STRIPE_PRO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID`
4. Create webhook at `https://your-domain.com/api/stripe/webhook`
5. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

### Resend (optional — email alerts)
1. Create account at [resend.com](https://resend.com)
2. Copy API key → `RESEND_API_KEY`
3. Set `EMAIL_FROM` to a verified sender address

## Database Migrations

```bash
# Apply all migrations to remote Supabase project
npx supabase db push

# 33 migrations total:
# 001–018  Core schema (analyses, auth, monitors, API keys, webhooks, team, widget)
# 019–028  Connected Sites, queue system, multi-page monitoring
# 029      Accessibility profiles (10 tables)
# 030      Fix Requests (6 tables, RLS-gated)
# 031      fix_request_read_states
# 032      Error Monitoring (6 tables: error_projects, error_events, error_issues,
#          error_issue_activities, error_alert_policies, error_project_quotas)
# 033      Accessibility E2E (8 tables: accessibility_critical_journeys,
#          accessibility_assessment_pages, accessibility_manual_check_catalog (22 checks seeded),
#          accessibility_manual_check_results, accessibility_statements,
#          accessibility_statement_versions, accessibility_activities; all RLS-gated)
```

## Pages

| Page | Path | Auth |
|------|------|------|
| Landing | `/` | Public |
| Login | `/login` | Public |
| Signup | `/signup` | Public |
| Pricing | `/pricing` | Public |
| Changelog | `/changelog` | Public |
| Dashboard | `/dashboard` | Required |
| New Analysis | `/analyze` | Required |
| Analysis Status | `/analyze/[id]` | Required |
| Report Detail | `/reports/[id]` | Required |
| Reports History | `/reports` | Required |
| Monitors | `/monitors` | Required |
| Monitor Run Detail | `/monitors/[id]/runs/[runId]` | Required |
| Connected Sites | `/sites` | Required |
| Site Detail | `/sites/[id]` | Required |
| Fix Requests | `/fix-requests` | Required (Pro+) |
| Fix Request Detail | `/fix-requests/[id]` | Required (Pro+) |
| Error Projects | `/errors` | Required (Pro+) |
| Error Issue Detail | `/errors/[id]/issues/[issueId]` | Required (Pro+) |
| Compliance | `/compliance` | Required |
| Remediation | `/compliance/remediation` | Required |
| Leads | `/leads` | Required (Agency+) |
| Developer Docs | `/docs` | Required |
| Settings | `/settings` | Required |
| Accessibility Profiles | `/accessibility` | Required (Pro+) |
| New Accessibility Profile | `/accessibility/new` | Required (Pro+) |
| Accessibility Profile Detail | `/accessibility/[id]` | Required (Pro+) |
| Assessment Detail | `/accessibility/assessments/[id]` | Required (Pro+) |
| Statement Editor | `/accessibility/statements/[id]` | Required (Agency+) |
| Public Report | `/share/[id]` | None |
| Public Fix Request | `/fix-request/[token]` | None (token-gated) |
| Widget Embed | `/widget/[key]` | None |

## Testing

```bash
npm run test          # Run all unit tests
npm run test:watch    # Watch mode
npm run verify        # typecheck + lint + tests + npm audit
```

**2,453 tests passing** across 95 files (Vitest 4.x, jsdom, @testing-library/react 16.x, all passing as of 2026-07-12)

| Category | Files | Key coverage |
|----------|-------|-------------|
| **API** (10) | analyze-validation, api-routes, compare-api, monitors-validation, reset-credits, share-report, team-invite, v1-api, widget-analyze, site-connect-events | Route validation, auth, credits, rate limiting |
| **Components** (12+) | AIInsightsSection, CompetitorComparisonSection, CrawledPagesSection, DesignComparisonSection, EAAComplianceSection, LLMReadinessSection, OnboardingBanner, PricingPage, fix-request badges, connected-site badges, error-monitoring badges | UI rendering, interactions, edge states |
| **Contracts** (5) | callback-auth, callback-idempotency, legacy-adapters, public-serializer, schemas | Worker payload auth and schema versioning |
| **Hooks** (3) | useAnalysis, useCredits, usePolling | React hook behaviour |
| **Library** (35+) | ai-* (5), accessibility-registry (41 tests), fix-request (48 tests), error-monitoring (fingerprinting, scrubbing, ingestion), api-keys, queue-service, queue-backoff, indexing-checks, site-key-generate, plans, rate-limit, url-validator, webhook-delivery, + more | Security, AI pipeline, billing, reporting |
| **Security** (2) | regression, site-connect-security | 7 regression guards for audit findings |
| **Worker** (14) | accessibility-engine, best-practices-engine, crawl-page-regression, crawled-pages, llm-readiness-engine, llm-readiness, opportunities, perf-score, score-analysis, score-classification, scoring-reproducibility, security-headers-engine, seo-engine, url-validation | All scoring engines |

## Commands

```bash
npm run dev             # Start dev server (http://localhost:3000)
npm run build           # Production build
npm run typecheck       # TypeScript check
npm run lint            # ESLint
npm run test            # Vitest unit tests
npm run test:watch      # Vitest in watch mode

npm run worker:dev      # Cloudflare Worker dev mode
npm run worker:deploy   # Deploy worker to Cloudflare

npm run db:push         # Apply Supabase migrations
npm run db:types        # Regenerate TypeScript types from DB schema
```

## Deployment

### Vercel
```bash
vercel --prod

# Key environment variables to set:
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add CLOUDFLARE_WORKER_URL production
vercel env add CLOUDFLARE_WORKER_AUTH_TOKEN production
vercel env add WORKER_CALLBACK_SECRET production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_PRO_PRICE_ID production
vercel env add STRIPE_AGENCY_PRICE_ID production
vercel env add RESEND_API_KEY production
vercel env add EMAIL_FROM production
vercel env add CRON_SECRET production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add UPSTASH_REDIS_URL production
vercel env add UPSTASH_REDIS_TOKEN production
```

### Cloudflare Worker
```bash
cd src/workers/analyzer
wrangler deploy
wrangler secret put WORKER_AUTH_TOKEN
wrangler secret put WORKER_CALLBACK_SECRET
```

### Vercel Cron
Cron is configured in `vercel.json` — runs automatically on Vercel. Locally:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/monitors
```
