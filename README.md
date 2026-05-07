# Website Analyzer

Automated website quality analysis with AI-powered recommendations — performance, accessibility, SEO, console errors, design fidelity, and scheduled monitoring.

## Features

| Feature | Description |
|---------|-------------|
| **Performance Analysis** | Lighthouse scores, Core Web Vitals (LCP, FID, CLS, TTFB), radar chart |
| **Accessibility Audit** | axe-core WCAG violations with impact levels and node selectors |
| **Console Error Analysis** | Browser console errors grouped and explained in plain English |
| **AI Insights** | Claude Vision analyses screenshots for UX issues with inline code fix suggestions |
| **Design Comparison** | Upload Figma/design screenshots — Claude compares against live site, reports fidelity score and mismatches |
| **Shareable Reports** | One-click public `/share/{id}` URL, no login required, with branded CTA footer |
| **Scheduled Monitoring** | Daily/weekly automated re-analysis with Vercel Cron, email alerts on score drops via Resend |
| **PDF Export** | Download full report as PDF |
| **Stripe Subscriptions** | Free (3 credits), Pro ($29/mo, 100 credits), Agency ($99/mo, unlimited) |

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Next.js API Routes + Cloudflare Workers (Playwright + axe-core) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Queue | Upstash Redis |
| AI | Claude API (Anthropic) — `claude-sonnet-4-6` |
| Email | Resend (optional — score-drop alerts) |
| Payments | Stripe |
| Deployment | Vercel + Cloudflare Workers |

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

# Email alerts for Scheduled Monitoring (optional)
RESEND_API_KEY=re_...                   # If unset, emails are silently skipped
EMAIL_FROM=noreply@yourdomain.com

# Vercel Cron security
CRON_SECRET=your-random-secret          # Used to authenticate /api/cron/monitors

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

# Deploy the worker
wrangler deploy

# Set secrets (never in wrangler.toml)
wrangler secret put WORKER_AUTH_TOKEN
wrangler secret put WORKER_CALLBACK_SECRET
```

Then set `CLOUDFLARE_WORKER_URL` in your app's env to the deployed worker URL.

### Stripe (required for payments)
1. Get keys at [dashboard.stripe.com](https://dashboard.stripe.com/apikeys)
2. Create two products: **Pro** ($29/mo) and **Agency** ($99/mo)
3. Copy their price IDs → `STRIPE_PRO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID`
4. Create webhook at `https://your-domain.com/api/stripe/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
5. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

Local webhook forwarding:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Resend (optional — monitoring email alerts)
1. Create account at [resend.com](https://resend.com)
2. Copy API key → `RESEND_API_KEY`
3. Set `EMAIL_FROM` to a verified sender address
4. If `RESEND_API_KEY` is not set, score-drop emails are silently skipped — all other features work normally

## Database Migrations

```bash
# Apply all migrations to remote Supabase project
npx supabase db push

# Migrations included:
# 001_initial_schema.sql  — analyses, user_settings, subscriptions tables
# 002_rls_policies.sql    — Row Level Security policies
# 003_functions.sql       — triggers, use_credit(), handle_new_user()
# 004_design_comparison.sql — design_screenshot_url column on analyses
# 005_public_reports.sql  — is_public column + public read RLS policy
# 006_monitors.sql        — monitors table for scheduled monitoring
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/analyze` | POST | Create analysis, consume credit, dispatch to Worker |
| `/api/analyze/callback` | POST | Receive Worker results, run AI analysis, save to DB |
| `/api/reports/[id]` | GET | Fetch completed report (auth required) |
| `/api/reports/[id]/pdf` | GET | Download report as PDF |
| `/api/reports/[id]/share` | POST | Toggle `is_public` on a report |
| `/api/ai/analyze` | POST | Direct AI screenshot analysis endpoint |
| `/api/monitors` | GET/POST | List / create scheduled monitors |
| `/api/monitors/[id]` | PATCH/DELETE | Update (pause/resume) / delete a monitor |
| `/api/cron/monitors` | GET | Vercel Cron endpoint — process due monitors (requires `CRON_SECRET`) |
| `/api/stripe/checkout` | POST | Create Stripe checkout session |
| `/api/stripe/webhook` | POST | Handle Stripe subscription events |
| `/api/user/credits` | GET | Get current user's credit balance |

## Public Routes

| Route | Description |
|-------|-------------|
| `/share/[id]` | Public report page — no auth required, only serves `is_public=true` analyses |

## Pages

| Page | Path | Auth |
|------|------|------|
| Landing | `/` | Public |
| Login | `/login` | Public |
| Signup | `/signup` | Public |
| Dashboard | `/dashboard` | Required |
| New Analysis | `/analyze` | Required |
| Analysis Status | `/analyze/[id]` | Required |
| Report Detail | `/reports/[id]` | Required |
| Reports History | `/reports` | Required |
| Monitors | `/monitors` | Required |
| Settings | `/settings` | Required |
| Public Report | `/share/[id]` | None |

## Feature Details

### Design Comparison
Upload a Figma/mockup screenshot when submitting a URL. Claude Vision receives both the design and the live screenshot, returns a **fidelity score** (0–100), a list of **mismatches** (area, severity, what design expects vs what live site shows, CSS fix suggestion), and a list of **matching areas**. Results appear in a dedicated section at the bottom of the report.

### Shareable Reports
Click **Share** on any completed report. The API sets `is_public=true` and returns a `/share/{id}` URL which is immediately copied to the clipboard. The public page is fully server-rendered — no auth token is needed. Un-sharing sets `is_public=false`; the `/share/{id}` route then returns 404.

### AI Code Fix Suggestions
Each AI insight card may include a `codeExample` field. Click **Show code fix** to expand a dark-themed code block. Click **Copy** to copy the snippet to the clipboard. The toggle is hidden when no code example is available.

### Scheduled Monitoring
Navigate to `/monitors` to create monitors. Choose **daily** or **weekly** frequency. Optionally enable score-drop email alerts and set a threshold (1–50 points). Vercel Cron fires `/api/cron/monitors` every hour; the cron handler finds monitors whose `next_run_at` has passed, submits a new analysis for each, and updates `last_run_at` / `next_run_at`. When a run completes, if any Lighthouse score dropped ≥ threshold since the last run, a score-drop alert email is sent via Resend.

Free plan: up to 3 monitors. Pro/Agency: unlimited.

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

## Project Structure

```
src/
├── app/
│   ├── (auth)/               # Login, Signup pages
│   ├── (dashboard)/
│   │   ├── analyze/          # URL input form + analysis status
│   │   ├── reports/          # Report detail + history list
│   │   ├── monitors/         # Scheduled monitoring page
│   │   ├── dashboard/        # Stats + recent analyses
│   │   └── settings/         # Profile + billing
│   ├── share/[id]/           # Public report (no auth)
│   └── api/
│       ├── analyze/           # POST create + POST callback
│       ├── reports/[id]/      # GET report + GET pdf + POST share
│       ├── monitors/          # GET list + POST create + PATCH/DELETE [id]
│       ├── cron/monitors/     # GET Vercel Cron handler
│       ├── ai/analyze/        # POST direct AI analysis
│       ├── stripe/            # POST checkout + POST webhook
│       └── user/credits/      # GET credit balance
├── components/
│   ├── ui/                   # shadcn/ui base components
│   ├── auth/                 # LoginForm, SignupForm, OAuthButtons
│   ├── analyze/              # URLInput (with design upload), AnalysisProgress, QueuePosition
│   ├── reports/
│   │   ├── ReportHeader.tsx          # Share toggle, copy link, public banner
│   │   ├── ShareReportHeader.tsx     # Read-only header for /share/[id]
│   │   ├── PerformanceSection.tsx    # Lighthouse scores + radar chart
│   │   ├── AccessibilitySection.tsx  # WCAG violations
│   │   ├── ConsoleErrorsSection.tsx  # Console errors
│   │   ├── AIInsightsSection.tsx     # AI insights + code fix toggles
│   │   ├── DesignComparisonSection.tsx # Fidelity score + mismatch cards
│   │   └── ScreenshotViewer.tsx
│   ├── monitors/             # MonitorsList, MonitorCard, CreateMonitorForm
│   └── shared/               # Navbar, Sidebar, ErrorBoundary, LoadingSpinner
├── lib/
│   ├── supabase/             # Browser + server + service-role clients
│   ├── ai/
│   │   ├── claude.ts         # analyzeWithAI(), compareWithDesign()
│   │   └── prompts.ts        # All AI prompts (6 functions)
│   ├── email/resend.ts       # sendScoreDropAlert(), sendMonitorSummary()
│   ├── queue/redis.ts        # Upstash Redis client
│   └── stripe/               # Stripe client + plan definitions
├── workers/analyzer/         # Cloudflare Worker (Playwright + Lighthouse + axe-core)
├── types/
│   └── analysis.ts           # All shared TypeScript types
├── hooks/
│   ├── useCredits.ts         # Credits with silent background polling
│   ├── useAnalysis.ts
│   └── usePolling.ts
└── middleware.ts             # Auth protection for /dashboard /analyze /reports /settings /monitors
supabase/migrations/
├── 001_initial_schema.sql
├── 002_rls_policies.sql
├── 003_functions.sql
├── 004_design_comparison.sql
├── 005_public_reports.sql
└── 006_monitors.sql
vercel.json                   # Cron: /api/cron/monitors runs hourly
```

## Deployment

### Vercel
```bash
vercel --prod

# Set all environment variables:
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

### Vercel Cron (Scheduled Monitoring)
Cron is configured in `vercel.json` and runs automatically on Vercel. Locally, trigger it manually:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/monitors
```

## Testing

```bash
npm run test          # Run all unit tests
npm run test:watch    # Watch mode
```

Test suites:

| File | Coverage |
|------|---------|
| `analysis-types.test.ts` | Runtime shape validators for all TypeScript types |
| `prompts.test.ts` | AI prompt output schema contracts |
| `analyze-validation.test.ts` | URL Zod schema (POST /api/analyze) |
| `monitors-validation.test.ts` | Monitor Zod schema (POST /api/monitors) |
| `share-report.test.ts` | Share toggle, status guard, AI summary guard |
| `useCredits.test.ts` | Credits hook including background poll anti-flicker |
| `useAnalysis.test.ts` | Analysis hook |
| `usePolling.test.ts` | Generic polling hook |
| `api-routes.test.ts` | API route integration helpers |
