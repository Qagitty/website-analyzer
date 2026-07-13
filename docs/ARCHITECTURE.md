# WebScore — Architecture Overview

**Last updated:** 2026-07-12  
**Sprints complete:** 1–17

---

## System Components

### Frontend (Next.js 15, App Router)

**Dashboard routes (auth required):**
- `/dashboard` — stats overview, recent analyses, quick actions
- `/analyze`, `/analyze/[id]` — URL input form, analysis status polling
- `/analyze/compare`, `/compare/[id]` — competitor comparison
- `/reports`, `/reports/[id]` — report history and detail
- `/monitors`, `/monitors/[id]/runs/[runId]` — scheduled monitoring with run detail
- `/sites`, `/sites/new`, `/sites/[id]` — Connected Sites (6-tab dashboard)
- `/fix-requests`, `/fix-requests/new`, `/fix-requests/[id]` — Fix Request workflow (Pro+)
- `/errors`, `/errors/new`, `/errors/[id]`, `/errors/[id]/issues/[issueId]` — Error Monitoring (Pro+)
- `/accessibility`, `/accessibility/new`, `/accessibility/[id]` — Accessibility profiles (Pro+)
- `/accessibility/assessments/[id]` — Assessment detail
- `/accessibility/statements/[id]` — Statement editor (Agency+)
- `/compliance`, `/compliance/remediation` — accessibility compliance and remediation board
- `/leads` — Agency Lead Widget captured leads (Agency+)
- `/docs` — developer documentation
- `/settings` (profile, billing, developers, notifications, team)

**Public routes (no auth):**
- `/` — landing page
- `/pricing`, `/changelog`, `/docs` — marketing
- `/share/[id]` — public report (no auth, `is_public=true` required)
- `/fix-request/[token]` — public Fix Request view (scoped token-gated)
- `/widget/[key]` — hosted widget embed

---

### Database (Supabase / PostgreSQL)

33 migrations applied. All tables have Row-Level Security. Service-role client used only for Worker callbacks, cron jobs, and ingestion routes.

**Migration groups:**

| Range | Content |
|-------|---------|
| 001–005 | analyses, user_settings, subscriptions, design comparison, public reports |
| 006–018 | monitors, team_members, webhooks, api_keys, crawl_pages, api key encryption, team invite expiry, remediation_items, widget_key |
| 019–028 | Connected Sites (connected_sites, keys, telemetry_events), queue system (queue_jobs, job_ledger), multi-page monitoring (monitor_pages, monitor_runs, monitor_execution_leases, alert policies) |
| 029 | Accessibility profiles (10 tables for jurisdiction profiles, risk assessments, standards registry) |
| 030 | Fix Requests (fix_requests, fix_request_recipients, fix_request_deliveries, fix_request_messages, fix_request_activities, fix_request_public_links) |
| 031 | fix_request_read_states |
| 032 | Error Monitoring (error_projects, error_events, error_issues, error_issue_activities, error_alert_policies, error_project_quotas) |
| 033 | Accessibility E2E — 8 tables: accessibility_critical_journeys, accessibility_assessment_pages, accessibility_manual_check_catalog (22 checks seeded), accessibility_manual_check_results, accessibility_statements, accessibility_statement_versions, accessibility_activities; all RLS-gated |

---

### Queue (Upstash Redis)

Job types (24 total):

| Category | Jobs |
|----------|------|
| Analysis | `analysis.run` |
| Monitoring | `monitor.run`, `monitor.page_check`, `monitor.discovery` |
| Alerts | `alert.evaluate` |
| Delivery | `email.send`, `webhook.deliver` |
| Reports | `report.generate` |
| Maintenance | `retention.cleanup` |
| Connected Sites | `site_verification.check`, `site_connect.event_process`, `site_connect.verify`, `site_connect.route_candidate` |
| Error Monitoring | `error_event.process`, `error_issue.aggregate`, `error_alert.evaluate`, `error_retention.cleanup` |
| Accessibility | `accessibility.assessment.start`, `accessibility.assessment.page`, `accessibility.assessment.finalize`, `accessibility.regression.check`, `accessibility.alert.evaluate`, `accessibility.statement.generate` |

Cron endpoints:
- `GET /api/cron/queue-scheduler` — promotes scheduled jobs → ready (every minute via Vercel Cron)
- `GET /api/cron/queue-consumer` — claims and executes ready jobs (every minute)
- `GET /api/cron/monitors` — triggers due monitors (hourly)
- `GET /api/cron/reset-credits` — resets free-tier credits (monthly, 1st of month)

---

### Public Ingestion Endpoints (no user auth session)

| Endpoint | Auth method | Purpose |
|----------|-------------|---------|
| `POST /api/analyze/callback` | HMAC-SHA256 signature | Worker analysis result callback |
| `POST /api/site-connect/events` | Site key (SHA-256 lookup) | Connected Sites telemetry ingestion |
| `POST /api/error-monitoring/envelope` | Project key (SHA-256 lookup) | Error event ingestion (64KB limit) |
| `POST /api/widget/analyze` | Widget key (plaintext lookup) | Lead Widget analysis trigger |
| `GET /api/error-monitoring/sdk` | None (public CDN) | Browser SDK delivery |
| `GET /api/site-connect/v1/script` | None (public CDN) | Connected Sites JS snippet |

---

### Security Architecture

**Key storage:**
- API keys (`wa_live_`): SHA-256 hash in DB for lookup; AES-256-GCM + PBKDF2-SHA256 (600K iter) encrypted blob for reveal (`v2:` prefix)
- Site keys (`ws_site_`): SHA-256 hash only
- Error project keys (`ws_err_`): SHA-256 hash only
- Widget keys (`wk_live_`): plaintext (low-risk; used only for public widget)
- Fix Request external tokens: 64 hex chars, stored hashed, short-lived

**Security controls:**
- CSRF: enforced in `src/middleware.ts`; excluded for server-to-server routes (`/api/widget/`, `/api/v1/`, `/api/error-monitoring/`, `/api/site-connect/`)
- SSRF prevention: `validateAnalysisUrl()` blocks private IPs, cloud metadata endpoints, redirect-chain hops to different hostnames
- Rate limiting: fail-closed (Redis outage → 503, not bypass); per-plan limits for API keys; IP-based limits for public ingestion
- Supply chain: npm `overrides` for `form-data` + `ws` CVEs; CI runs `npm audit --audit-level=high`
- Cloudflare Worker startup guard: exits 500 if `WORKER_AUTH_TOKEN` or `WORKER_CALLBACK_SECRET` not bound

**Privacy (Error Monitoring SDK):**
- No form field values, DOM text, or keystrokes captured
- URL scrubbing removes sensitive query params before event is sent
- No request/response bodies captured

---

### AI Integration

- **Claude `claude-sonnet-4-6`** (Anthropic): screenshot vision analysis, accessibility issue interpretation, performance analysis, console error explanation, final report summary
- Prompts defined in `src/lib/ai/prompts.ts` (5 prompt types)
- All AI calls are asynchronous; results stored in `analyses.ai_insights` JSONB column

---

### External Services

| Service | Purpose |
|---------|---------|
| Supabase | Database, auth (email + Google OAuth), storage (screenshots, source maps) |
| Upstash Redis | Job queue, rate limiting, monitor execution leases |
| Anthropic | AI analysis (Claude claude-sonnet-4-6) |
| Stripe | Billing (free/pro/agency/compliance plans), subscription webhooks |
| Resend | Transactional email (score-drop alerts, fix request emails, monitor summaries) |
| Cloudflare Workers | Website analysis engine (fetch-based, HTML parsing, axe-core accessibility, scoring) |
| Vercel | Hosting, serverless API routes, Cron jobs, Analytics |

---

### Key source files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Auth protection for all dashboard routes + centralized CSRF |
| `src/lib/ai/prompts.ts` | All AI prompts (5 functions) |
| `src/workers/analyzer/index.ts` | Cloudflare Worker analysis engine (fetch-only) |
| `src/lib/security/url-validator.ts` | SSRF prevention (84+ tests) |
| `src/lib/billing/limits.ts` | 27+ feature flags per plan |
| `src/lib/fix-request/state-machine.ts` | 17-status Fix Request lifecycle |
| `src/lib/fix-request/source-adapters.ts` | 10 adapters (any finding → Fix Request draft) |
| `src/lib/accessibility/risk-model.ts` | 7-dimension weighted accessibility risk model |
| `src/lib/queue/consumer.ts` | Distributed job consumer with lease + backoff |
| `src/data/changelog.ts` | Product changelog — single source of truth |
| `supabase/migrations/` | 32 migrations (001–032) |
