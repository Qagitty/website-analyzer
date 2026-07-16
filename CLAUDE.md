# 🌐 Website Analyzer SaaS — Claude.md

> Полное руководство по разработке автоматического анализатора веб-сайтов.
> Этот файл содержит всё необходимое для немедленного старта разработки.

---

## 📋 Table of Contents

0. [Current Project Status](#0-current-project-status)
1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Four-Week Development Plan](#5-four-week-development-plan)
6. [Code Examples](#6-code-examples)
7. [Environment Variables](#7-environment-variables)
8. [Testing Checklists](#8-testing-checklists)
9. [Deployment Steps](#9-deployment-steps)
10. [Success Metrics](#10-success-metrics)
11. [Post-MVP Features](#11-post-mvp-features)

---

## 0. Current Project Status

> Last updated: 2026-07-11

### Overall: Sprints 1–10 + security audit cycle complete — production ready

---

### ✅ Implemented & Ready

#### Infrastructure
- All environment variables configured (Supabase, Redis, Anthropic, OpenAI, Stripe, Cloudflare)
- Next.js 14 project with App Router, TypeScript, TailwindCSS, shadcn/ui
- Database migrations: `001` through `035` applied to remote (verified via `supabase migration list --linked` — 2026-07-16)
  - Verify with `npx supabase migration list --linked` before assuming a table exists; a populated Local column does NOT mean the migration ran remotely
  - Use `gen_random_uuid()` (Postgres core), never `uuid_generate_v4()` — `uuid-ossp` lives in the `extensions` schema and is not on the migration `search_path`
  - Migration version numbers must be unique; `schema_migrations` keys on version
- Row-Level Security policies in place
- Auth middleware at `src/middleware.ts` — protects all dashboard routes + enforces CSRF centrally
- **Dark Observatory design system** applied site-wide: `#0A0A0F` base, indigo-500→violet-500 primary, score-aware emerald/amber/red palette, `.text-gradient`, `.glow-indigo`, `.bg-grid` utilities
- `sitemap.ts` and `robots.ts` implemented (Next.js metadata routes)
- Vercel Analytics wired in root layout
- Vercel auto-deploy connected — `git push origin main` triggers deploy

#### Security Infrastructure
- `src/lib/security/url-validator.ts` — SSRF prevention (private IP ranges, cloud metadata, redirect chains; 84+ tests)
- `src/lib/contracts/callback-auth.ts` — HMAC-SHA256 callback auth with discriminated union return type
- `src/lib/contracts/schemas.ts` + `legacy-adapters.ts` — versioned Worker payload schemas
- `src/lib/csrf.ts` — CSRF origin check (excluded: `/api/widget/`, `/api/v1/` — server-to-server callers)
- `src/lib/rate-limit/web.ts` — fail-closed rate limiting (Redis outage → 503, not bypass)
- `src/lib/api-keys/generate.ts` — AES-256-GCM with PBKDF2-SHA256 (600K iterations, `v2:` prefix); all DB keys confirmed v2 as of 2026-06-29
- npm `overrides` in `package.json` — transitive CVE patches for `form-data` and `ws`
- Cloudflare Worker startup guard — exits 500 if `WORKER_AUTH_TOKEN` or `WORKER_CALLBACK_SECRET` not bound

#### Backend — API Routes
| Route | Method | Status |
|-------|--------|--------|
| `/api/analyze` | POST | ✅ Done |
| `/api/analyze/[id]/cancel` | POST | ✅ Done |
| `/api/analyze/callback` | POST | ✅ Done |
| `/api/ai/analyze` | POST | ✅ Done |
| `/api/api-keys` | GET / POST | ✅ Done |
| `/api/api-keys/[id]` | DELETE | ✅ Done |
| `/api/api-keys/[id]/reveal` | GET | ✅ Done |
| `/api/auth/check-email` | GET | ✅ Done |
| `/api/compare` | POST | ✅ Done |
| `/api/compare/[id]` | GET | ✅ Done |
| `/api/cron/monitors` | GET | ✅ Done |
| `/api/cron/reset-credits` | GET | ✅ Done |
| `/api/csp-report` | POST | ✅ Done |
| `/api/health` | GET | ✅ Done |
| `/api/monitors` | GET / POST | ✅ Done |
| `/api/monitors/[id]` | PATCH / DELETE | ✅ Done |
| `/api/remediation` | GET / POST | ✅ Done |
| `/api/remediation/[id]` | GET / PATCH | ✅ Done |
| `/api/reports/[id]` | GET | ✅ Done |
| `/api/reports/[id]/compliance-pdf` | GET | ✅ Done |
| `/api/reports/[id]/docx` | GET | ✅ Done |
| `/api/reports/[id]/json` | GET | ✅ Done |
| `/api/reports/[id]/markdown` | GET | ✅ Done |
| `/api/reports/[id]/pdf` | GET | ✅ Done |
| `/api/reports/[id]/share` | POST | ✅ Done |
| `/api/reports/[id]/xlsx` | GET | ✅ Done |
| `/api/reports/history` | GET | ✅ Done |
| `/api/stripe/checkout` | POST | ✅ Done |
| `/api/stripe/portal` | POST | ✅ Done |
| `/api/stripe/webhook` | POST | ✅ Done |
| `/api/support/contact` | POST | ✅ Done |
| `/api/team` | GET / POST | ✅ Done |
| `/api/team/[id]` | PATCH / DELETE | ✅ Done |
| `/api/team/accept` | POST | ✅ Done |
| `/api/user/branding` | GET / POST | ✅ Done |
| `/api/user/credits` | GET | ✅ Done |
| `/api/user/logo` | POST | ✅ Done |
| `/api/user/password` | POST | ✅ Done |
| `/api/user/profile` | GET / PATCH | ✅ Done |
| `/api/v1/analyze` | POST | ✅ Done (public API) |
| `/api/v1/analyses` | GET | ✅ Done (public API) |
| `/api/v1/reports/[id]` | GET | ✅ Done (public API) |
| `/api/webhooks` | GET / POST | ✅ Done |
| `/api/webhooks/[id]` | DELETE | ✅ Done |
| `/api/widget-script` | GET | ✅ Done |
| `/api/widget/analyze` | POST | ✅ Done |
| `/api/widget/key` | GET | ✅ Done |
| `/api/connected-sites` | GET / POST | ✅ Done |
| `/api/connected-sites/[id]` | GET / PATCH / DELETE | ✅ Done |
| `/api/connected-sites/[id]/verify` | POST | ✅ Done |
| `/api/connected-sites/[id]/rotate-key` | POST | ✅ Done |
| `/api/connected-sites/[id]/status` | GET | ✅ Done |
| `/api/connected-sites/[id]/verification-challenge` | GET | ✅ Done |
| `/api/fix-requests` | GET / POST | ✅ Done |
| `/api/fix-requests/[id]` | GET / PATCH / DELETE | ✅ Done |
| `/api/fix-requests/[id]/send` | POST | ✅ Done |
| `/api/fix-requests/[id]/messages` | GET / POST | ✅ Done |
| `/api/fix-requests/[id]/activities` | GET | ✅ Done |
| `/api/fix-requests/[id]/public-link` | GET / POST / DELETE | ✅ Done |
| `/api/public/fix-request/[token]` | GET | ✅ Done (unauthenticated, token-gated) |
| `/api/site-connect/events` | POST | ✅ Done (telemetry ingestion) |
| `/api/site-connect/v1/script` | GET | ✅ Done (JS snippet delivery) |
| `/api/cron/queue-consumer` | GET | ✅ Done |
| `/api/cron/queue-scheduler` | GET | ✅ Done |
| `/api/admin/queue` | GET | ✅ Done |

#### Pages
| Page | Status |
|------|--------|
| Landing (`/`) | ✅ Done |
| Pricing (`/pricing`) | ✅ Done |
| Changelog (`/changelog`) | ✅ Done |
| Sample report (`/sample-report`) | ✅ Done |
| Legal: cookies / privacy / terms / refund | ✅ Done |
| Login (`/login`) | ✅ Done |
| Signup (`/signup`) | ✅ Done |
| Forgot password (`/forgot-password`) | ✅ Done |
| Update password (`/auth/update-password`) | ✅ Done |
| Dashboard (`/dashboard`) | ✅ Done |
| Analyze — URL form (`/analyze`) | ✅ Done |
| Analyze — status polling (`/analyze/[id]`) | ✅ Done |
| Analyze — competitor compare form (`/analyze/compare`) | ✅ Done |
| Comparison results (`/compare/[id]`) | ✅ Done |
| Reports — history list (`/reports`) | ✅ Done |
| Report — detail view (`/reports/[id]`) | ✅ Done |
| Settings — profile (`/settings`) | ✅ Done |
| Settings — billing (`/settings/billing`) | ✅ Done |
| Settings — developers (`/settings/developers`) | ✅ Done |
| Settings — notifications (`/settings/notifications`) | ✅ Done |
| Settings — team (`/settings/team`) | ✅ Done |
| Monitors (`/monitors`) | ✅ Done |
| Compliance (`/compliance`) | ✅ Done |
| Remediation (`/compliance/remediation`) | ✅ Done |
| Leads (`/leads`) | ✅ Done |
| Developer docs (`/docs`) | ✅ Done |
| Public share (`/share/[id]`) | ✅ Done |
| Widget embed (`/widget/[key]`) | ✅ Done |

#### Components
| Component | Status |
|-----------|--------|
| `LoginForm` | ✅ Done |
| `SignupForm` | ✅ Done |
| `OAuthButtons` | ✅ Done |
| `StatsOverview` | ✅ Done |
| `RecentAnalyses` | ✅ Done |
| `QuickActions` | ✅ Done |
| `CreditsDisplay` | ✅ Done |
| `URLInput` | ✅ Done |
| `AnalysisProgress` | ✅ Done |
| `QueuePosition` | ✅ Done |
| `ReportHeader` | ✅ Done |
| `ShareReportHeader` | ✅ Done |
| `PerformanceSection` (Recharts) | ✅ Done |
| `EAAComplianceSection` | ✅ Done |
| `AccessibilitySection` | ✅ Done |
| `ConsoleErrorsSection` | ✅ Done |
| `AIInsightsSection` | ✅ Done |
| `DesignComparisonSection` | ✅ Done |
| `CompetitorComparisonSection` | ✅ Done |
| `ScreenshotViewer` | ✅ Done |
| `ScoreGauge` | ✅ Done |
| `LLMReadinessSection` | ✅ Done |
| `CrawledPagesSection` | ✅ Done |
| `MonitorsList` | ✅ Done |
| `TrendChart` | ✅ Done |
| `ProfileForm` | ✅ Done |
| `NotificationPrefs` | ✅ Done |
| `BrandingForm` | ✅ Done |
| `SubscriptionCard` | ✅ Done |
| `ApiKeysForm` | ✅ Done |
| `WebhooksForm` | ✅ Done |
| `TeamMembersForm` | ✅ Done |
| `Navbar` | ✅ Done |
| `Sidebar` | ✅ Done |
| `ErrorBoundary` | ✅ Done |
| `OnboardingBanner` | ✅ Done |

#### Libraries / Services
| Module | Status |
|--------|--------|
| `lib/ai/claude.ts` — Claude text + vision analysis | ✅ Done |
| `lib/ai/prompts.ts` — all AI prompts | ✅ Done |
| `lib/supabase/client.ts` + `server.ts` + `storage.ts` | ✅ Done |
| `lib/queue/redis.ts` — Upstash job queue | ✅ Done |
| `lib/stripe/client.ts` + `plans.ts` | ✅ Done |
| `lib/pdf/generator.ts` | ✅ Done |
| `src/workers/analyzer/index.ts` — Cloudflare Worker (fetch-only, no Playwright) | ✅ Done |
| `src/hooks/useAnalysis`, `useCredits`, `usePolling` | ✅ Done |
| `src/types/analysis.ts`, `database.ts` | ✅ Done |
| `src/middleware.ts` — auth + CSRF enforcement | ✅ Done |
| `lib/api-keys/generate.ts` — AES-256-GCM / PBKDF2-SHA256 (`v2:` prefix) | ✅ Done |
| `lib/api-keys/rate-limit.ts` — per-plan rate limiting via Upstash Redis | ✅ Done |
| `lib/api-keys/authenticate.ts` — API key authentication | ✅ Done |
| `lib/webhooks/deliver.ts` — webhook delivery with HMAC signatures + Slack Block Kit | ✅ Done |
| `lib/email/` — email notification service (Resend) | ✅ Done |
| `lib/security/url-validator.ts` — SSRF prevention + URL safety | ✅ Done |
| `lib/contracts/callback-auth.ts` + `schemas.ts` + `legacy-adapters.ts` | ✅ Done |
| `lib/rate-limit/web.ts` — fail-closed brute-force lockout | ✅ Done |
| `lib/csrf.ts` — CSRF origin check helper | ✅ Done |
| `lib/accessibility/standards.ts` — WCAG 2.1/2.2, EN 301 549, Section 508 registry | ✅ Done |
| `lib/accessibility/jurisdictions.ts` — versioned jurisdiction profiles (v2026-07-11.1) | ✅ Done |
| `lib/accessibility/risk-model.ts` — transparent 7-dimension risk model (weights sum=1.0) | ✅ Done |
| `lib/accessibility/applicability.ts` — conservative applicability assessment (never certifies) | ✅ Done |
| `lib/fix-request/state-machine.ts` — 17-status lifecycle with explicit transitions | ✅ Done |
| `lib/fix-request/source-adapters.ts` — 10 source adapters (all WebScore modules → FixRequestDraft) | ✅ Done |
| `lib/fix-request/message-generator.ts` — email HTML/text, WhatsApp/Telegram links, webhook, Slack | ✅ Done |
| `lib/fix-request/channel-adapters.ts` — per-channel delivery with HMAC signing | ✅ Done |
| `lib/queue/types.ts` + `service.ts` + `consumer.ts` + `backoff.ts` + handlers | ✅ Done |
| `lib/site-connect/` — origin validator, indexing checks, crawler registry, script source | ✅ Done |
| `lib/site-keys/generate.ts` — site key generation | ✅ Done |
| `types/accessibility-profile.ts` — all accessibility domain types | ✅ Done |
| `types/fix-request.ts` — all fix request domain types + transition map | ✅ Done |

---

### ✅ Sprints 1–10 + Security Audit Cycle

| Sprint / Phase | Feature | Status |
|---------------|---------|--------|
| Sprint 1 | Core analysis engine (Cloudflare Worker, HTML analysis, scoring) | ✅ Done |
| Sprint 2 | Authentication, URL input, analysis status polling | ✅ Done |
| Sprint 3 | AI analysis with Claude Vision, detailed reports, PDF export | ✅ Done |
| Sprint 4 | Dashboard, Stripe billing, error boundaries, toast notifications | ✅ Done |
| Sprint 5 | API keys system (`wa_live_` prefix, AES-GCM encryption, rate limiting) | ✅ Done |
| Sprint 6 | Webhook delivery (HMAC signatures, Slack Block Kit format) | ✅ Done |
| Sprint 7 | LLM Readiness scoring (evidence-based v2, `LLMReadinessSection`) | ✅ Done |
| Sprint 8 | Onboarding banner, internal link crawler, multi-page analysis | ✅ Done |
| Security Audit | Trail of Bits 4-phase: context → insecure-defaults → sharp-edges → supply-chain → fp-check | ✅ Done |
| Security Fixes | 21 findings reviewed; F1–F6 + SE1–SE9 + supply-chain CVEs + TRUE POSITIVE (SE4) all fixed | ✅ Done |
| Post-audit | Differential review (Worker startup guard LOW + v1→v2 migration MEDIUM); migration confirmed; `legacyKey()` removed | ✅ Done |
| Sprint 9 | Regional Accessibility Risk Assessment — versioned jurisdiction profiles, conservative applicability, 7-dimension risk model, DB migration 029, compliance label overhaul (no overbroad legal claims) | ✅ Done |
| Sprint 10 | Unified Fix Request Workflow — 10 source adapters, 17-status state machine, 6 delivery channels, scoped external tokens, plan-gated features, DB migration 030 | ✅ Done |

---

### ✅ Test Coverage

- **2,071 tests across 79 files**, Vitest v4, jsdom, @testing-library/react
- All tests passing as of 2026-07-11

| Category | Test Files |
|----------|-----------|
| **API (10)** | `api/analyze-validation`, `api/api-routes`, `api/compare-api`, `api/monitors-validation`, `api/reset-credits`, `api/share-report`, `api/team-invite`, `api/v1-api`, `api/widget-analyze`, `api/site-connect-events` |
| **Components (8)** | `components/AIInsightsSection`, `components/CompetitorComparisonSection`, `components/CrawledPagesSection`, `components/DesignComparisonSection`, `components/EAAComplianceSection`, `components/LLMReadinessSection`, `components/OnboardingBanner`, `components/PricingPage` |
| **Contracts (5)** | `contracts/callback-auth`, `contracts/callback-idempotency`, `contracts/legacy-adapters`, `contracts/public-serializer`, `contracts/schemas` |
| **Hooks (3)** | `hooks/useAnalysis`, `hooks/useCredits`, `hooks/usePolling` |
| **Library (29)** | `lib/ai-injection`, `lib/ai-pipeline`, `lib/ai-sanitize`, `lib/ai-templates`, `lib/ai-validate`, `lib/analysis-types`, `lib/api-keys`, `lib/branding`, `lib/cookie-consent`, `lib/env`, `lib/logger`, `lib/monitor-scheduling`, `lib/monitoring-domain`, `lib/pdf-view-model`, `lib/plans`, `lib/prompts`, `lib/rate-limit`, `lib/report-view-model`, `lib/sanitize-url`, `lib/score-adapters`, `lib/url-validator`, `lib/utils`, `lib/webhook-delivery`, `lib/widget-key`, **`lib/accessibility-registry`** (41 tests), **`lib/fix-request`** (48 tests), `lib/indexing-checks`, `lib/queue-backoff`, `lib/queue-service` |
| **Pages (1)** | `pages/changelog` |
| **Security (2)** | `security/regression`, `security/site-connect-security` |
| **Worker (14)** | `worker/accessibility-engine`, `worker/best-practices-engine`, `worker/crawl-page-regression`, `worker/crawled-pages`, `worker/llm-readiness-engine`, `worker/llm-readiness`, `worker/opportunities`, `worker/perf-score`, `worker/score-analysis`, `worker/score-classification`, `worker/scoring-reproducibility`, `worker/security-headers-engine`, `worker/seo-engine`, `worker/url-validation` |
| **Other (7)** | `lib/site-key-generate` + misc |

---

### ✅ Security Audit Results (2026-06-29)

Four-phase Trail of Bits audit style completed. All findings resolved. 0 open issues.

| Phase | Findings | Status |
|-------|---------|--------|
| `audit-context-building` | 10 invariant gaps identified | ✅ 6 patched, 4 by design |
| `insecure-defaults` | F1–F6: fail-open rate limiter, email fallback, CSRF fail-open, cron Bearer "undefined", callback secret in body, HMAC empty-string | ✅ All fixed |
| `sharp-edges` | SE1–SE9: HMAC return type, rate-limit bypass field, SSRF redirect, weak KDF, CSRF opt-in gap, webhook empty secret, decrypt throws, Math.random, nullable URL | ✅ All fixed |
| `supply-chain` | 12 flagged deps — 2 active HIGH CVEs (`form-data`, `ws`) | ✅ npm overrides applied; 0 HIGH vulns |
| `fp-check` | 21 findings verified: 1 TRUE POSITIVE (SE4 SHA-256 KDF) | ✅ Fixed with PBKDF2-SHA256 (600K iter) |
| Differential review | Worker startup guard (LOW) + v1→v2 key migration (MEDIUM) | ✅ Both resolved; `legacyKey()` removed |

CI runs `npm audit --audit-level=high` on every push.

---

### ✅ Sprint 9: Regional Accessibility Risk Assessment (2026-07-11)

**Critical language constraints (MUST be maintained):**
- NEVER use: "guaranteed legal compliance", "immunity from lawsuits", "certification by a government authority", "complete WCAG conformance based only on automated testing", "legal advice"
- ALWAYS use: "Regional accessibility risk assessment", "Accessibility readiness", "Technical conformance evidence", "Potential compliance gaps", "Risk-reduction workflow"

**Implemented:**
- `src/lib/accessibility/standards.ts` — WCAG 2.1 A/AA/AAA, WCAG 2.2 A/AA/AAA, EN 301 549, Section 508
- `src/lib/accessibility/jurisdictions.ts` — 7 jurisdiction profiles (4 full-support, 3 planned); versioned `YYYY-MM-DD.N`; `UNIVERSAL_DISCLAIMER` in all profiles
- `src/lib/accessibility/risk-model.ts` — 7-dimension weighted model; `RISK_WEIGHTS` sums validated at import; `scopeNote` always included
- `src/lib/accessibility/applicability.ts` — Conservative: never returns "definitely does not apply"; `UNIVERSAL_CAVEATS` in every result
- `src/types/accessibility-profile.ts` — All shared types
- `supabase/migrations/029_accessibility_profiles.sql` — 10 tables; `technical_status` CHECK uses neutral language; `private_notes` column never exported
- `src/lib/compliance.ts` — `ComplianceLevel` migrated: `compliant→no_blockers`, `partial→gaps`, `non-compliant→blockers`; `normalizeLegacyLevel()` adapter provided
- `src/components/reports/EAAComplianceSection.tsx` — All 3 overbroad strings removed
- `src/lib/pdf/compliance-generator.tsx` — Unsourced "30–40% of issues" claim removed
- `src/__tests__/lib/accessibility-registry.test.ts` — 41 tests covering registry, risk model, applicability, label safety

### ✅ Sprint 10: Unified Fix Request Workflow (2026-07-11)

**Delivery channels:** email, WhatsApp link, Telegram share link, internal assignment, HMAC-signed webhook, external scoped-token link, internal chat

**Security design:**
- External recipients receive scoped tokens only — no direct Supabase access
- `isPrivate: true` evidence items never exposed externally
- `internal_notes` field stripped from all non-owner API responses
- Phone numbers and emails consumed at delivery time; not logged
- External link tokens: `hex(gen_random_bytes(32))`, expiring, revocable, RLS-gated
- Webhook delivery reuses existing HMAC-SHA256 signing (empty secret guard)

**Implemented:**
- `src/types/fix-request.ts` — All types + `FIX_REQUEST_TRANSITIONS` map + `canTransition()`
- `src/lib/fix-request/state-machine.ts` — Explicit transition validation
- `src/lib/fix-request/source-adapters.ts` — 10 adapters + `buildDraftFromSource()` dispatcher
- `src/lib/fix-request/message-generator.ts` — HTML email (XSS-escaped), WhatsApp/Telegram links, webhook JSON, Slack Block Kit
- `src/lib/fix-request/channel-adapters.ts` — Per-channel delivery + `deliverToChannel()` router
- `src/lib/email/resend.ts` — Added `sendFixRequestEmail()`
- `src/lib/billing/limits.ts` — 6 new feature flags: `fixRequests`, `fixRequestEmailDelivery`, `fixRequestExternalLinks`, `fixRequestWebhookDelivery`, `fixRequestTeamAssignment`, `fixRequestVerification`
- `supabase/migrations/030_fix_requests.sql` — 6 tables + `fix_request_link_record_view()` helper; all RLS-gated
- API routes: `GET/POST /api/fix-requests`, full CRUD `[id]`, `[id]/send`, `[id]/messages`, `[id]/activities`, `[id]/public-link`, unauthenticated `/api/public/fix-request/[token]`
- `src/__tests__/lib/fix-request.test.ts` — 48 tests: state machine, adapters, message generator, XSS escaping, secret-leakage checks, plan gates, privacy invariants

**Plan entitlements:**
| Feature | Free | Pro | Agency | Compliance |
|---------|------|-----|--------|------------|
| `fixRequests` | ❌ | ✅ | ✅ | ✅ |
| `fixRequestEmailDelivery` | ❌ | ✅ | ✅ | ✅ |
| `fixRequestExternalLinks` | ❌ | ✅ | ✅ | ✅ |
| `fixRequestVerification` | ❌ | ✅ | ✅ | ✅ |
| `fixRequestWebhookDelivery` | ❌ | ❌ | ✅ | ✅ |
| `fixRequestTeamAssignment` | ❌ | ❌ | ✅ | ✅ |

---

### Known Gaps vs Original Spec
| Spec Item | Reality |
|-----------|---------|
| `lib/ai/openai.ts` | Not created — GPT-4o text analysis deferred to post-MVP |
| Worker sub-files (`screenshot.ts`, `lighthouse.ts`, etc.) | Not created; Worker is fetch-only (no Playwright) |
| `src/types/report.ts`, `api.ts` | Types inlined or in `analysis.ts` |
| `supabase/seed.sql` | Empty placeholder |
| `public/og-image.png` | **Still missing** — needed for social media previews |
| Fix Request UI pages | API + domain logic done; `/fix-requests` dashboard page not yet built |
| Accessibility Profile UI | API + domain logic done; profile setup page not yet built |

### ✅ Previously Gaps — Now Resolved
| Item | Resolution |
|------|-----------|
| `lib/supabase/middleware.ts` | ✅ Lives at `src/middleware.ts` — same functionality |
| sitemap.xml / robots.txt | ✅ `src/app/sitemap.ts` + `src/app/robots.ts` |
| Loading skeletons | ✅ Skeleton components wired across dashboard and report pages |
| Responsive design | ✅ Dark Observatory rollout included mobile-first layout audit |
| Vercel Analytics | ✅ `<Analytics />` in root layout |
| Settings page | ✅ Full settings: profile, billing, developers, notifications, team |
| Security headers | ✅ Configured in `next.config.js` |
| `lib/queue/jobs.ts` | ✅ Full typed queue system: `lib/queue/types.ts` + `service.ts` + `consumer.ts` + `backoff.ts` + 5 handlers |
| Overbroad compliance claims | ✅ Removed "meets WCAG 2.1 AA", "full certification", "€100k fines", "30–40% of issues" from all UI and PDFs |

---

## 1. Project Overview

**Website Analyzer** — это SaaS-платформа, которая автоматически анализирует веб-сайты и предоставляет детальные отчёты с AI-рекомендациями.

### Что делает продукт:
- 📸 Делает скриншоты страниц (full-page)
- ⚡ Запускает Lighthouse для оценки производительности
- ♿ Проверяет доступность (WCAG compliance)
- 🐛 Собирает console errors и network issues
- 🤖 Анализирует результаты с помощью Claude + GPT-4
- 📊 Генерирует визуальные отчёты с рекомендациями
- 📄 Экспортирует отчёты в PDF

### Target Audience:
- Frontend-разработчики
- QA-инженеры
- Владельцы сайтов и маркетологи
- Digital-агентства

### Business Model:
- Free tier: 3 анализа в месяц
- Pro: $29/мес — 100 анализов
- Agency: $99/мес — безлимит + API

---

## 2. Technology Stack

| Слой | Технология | Версия | Назначение |
|------|-----------|--------|------------|
| **Frontend** | Next.js | 14.x | App Router, SSR/SSG |
| **UI Framework** | React | 18.x | Компоненты |
| **Styling** | TailwindCSS | 3.x | Утилитарный CSS |
| **UI Components** | shadcn/ui | latest | Готовые компоненты |
| **Charts** | Recharts | 2.x | Визуализация данных |
| **Backend** | Next.js API Routes | 14.x | REST API |
| **Edge Runtime** | Cloudflare Workers | latest | Browser automation |
| **Database** | Supabase (PostgreSQL) | latest | Данные + Auth + Storage |
| **Cache/Queue** | Upstash Redis | latest | Job queue, rate limiting |
| **AI (Vision)** | Claude API (Anthropic) | claude-sonnet-4-6 | Анализ скриншотов |
| **AI (Text)** | OpenAI GPT-4o | latest | Текстовые рекомендации |
| **Payments** | Stripe | latest | Подписки и кредиты |
| **Browser** | Playwright | latest | Скриншоты, тестирование |
| **Performance** | Lighthouse CI | latest | Метрики производительности |
| **Deployment** | Vercel | latest | Frontend + API |
| **Monitoring** | Sentry | latest | Error tracking |
| **Analytics** | Vercel Analytics | latest | Usage metrics |

---

## 3. Project Structure

```
website-analyzer/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx              # Страница входа
│   │   │   ├── signup/
│   │   │   │   └── page.tsx              # Страница регистрации
│   │   │   ├── callback/
│   │   │   │   └── route.ts              # OAuth callback handler
│   │   │   └── layout.tsx                # Auth layout (centered card)
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx              # Главный дашборд
│   │   │   ├── analyze/
│   │   │   │   ├── page.tsx              # Форма запуска анализа
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # Статус конкретного анализа
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx              # История всех отчётов
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # Детальный отчёт
│   │   │   ├── settings/
│   │   │   │   └── page.tsx              # Настройки аккаунта
│   │   │   └── layout.tsx                # Dashboard layout (sidebar)
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   │   ├── route.ts              # POST: создать анализ
│   │   │   │   └── callback/
│   │   │   │       └── route.ts          # POST: получить результаты от Worker
│   │   │   ├── ai/
│   │   │   │   └── analyze/
│   │   │   │       └── route.ts          # POST: AI анализ скриншота
│   │   │   ├── reports/
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts          # GET: получить отчёт
│   │   │   │       └── pdf/
│   │   │   │           └── route.ts      # GET: экспорт в PDF
│   │   │   ├── stripe/
│   │   │   │   ├── checkout/
│   │   │   │   │   └── route.ts          # POST: создать Stripe session
│   │   │   │   └── webhook/
│   │   │   │       └── route.ts          # POST: Stripe webhook handler
│   │   │   └── user/
│   │   │       └── credits/
│   │   │           └── route.ts          # GET: баланс кредитов
│   │   ├── layout.tsx                    # Root layout
│   │   ├── page.tsx                      # Landing page
│   │   ├── globals.css
│   │   └── favicon.ico
│   ├── components/
│   │   ├── ui/                           # shadcn/ui компоненты
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx             # Форма входа
│   │   │   ├── SignupForm.tsx            # Форма регистрации
│   │   │   └── OAuthButtons.tsx         # Google OAuth кнопки
│   │   ├── dashboard/
│   │   │   ├── StatsOverview.tsx        # Карточки со статистикой
│   │   │   ├── RecentAnalyses.tsx       # Список последних анализов
│   │   │   ├── QuickActions.tsx         # Быстрые действия
│   │   │   └── CreditsDisplay.tsx       # Отображение кредитов
│   │   ├── analyze/
│   │   │   ├── URLInput.tsx             # Форма ввода URL
│   │   │   ├── AnalysisProgress.tsx     # Прогресс анализа
│   │   │   └── QueuePosition.tsx        # Позиция в очереди
│   │   ├── reports/
│   │   │   ├── ReportHeader.tsx         # Заголовок отчёта
│   │   │   ├── PerformanceSection.tsx   # Lighthouse метрики
│   │   │   ├── AccessibilitySection.tsx # WCAG issues
│   │   │   ├── ConsoleErrorsSection.tsx # Ошибки консоли
│   │   │   ├── AIInsightsSection.tsx    # AI рекомендации
│   │   │   ├── ScreenshotViewer.tsx     # Просмотр скриншота
│   │   │   └── ScoreGauge.tsx          # Индикатор оценки
│   │   └── shared/
│   │       ├── Navbar.tsx
│   │       ├── Sidebar.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── LoadingSpinner.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                # Browser Supabase client
│   │   │   ├── server.ts                # Server Supabase client
│   │   │   └── middleware.ts            # Auth middleware
│   │   ├── ai/
│   │   │   ├── claude.ts               # Anthropic client
│   │   │   ├── openai.ts               # OpenAI client
│   │   │   └── prompts.ts              # AI prompts
│   │   ├── queue/
│   │   │   ├── redis.ts                # Upstash Redis client
│   │   │   └── jobs.ts                 # Job queue logic
│   │   ├── stripe/
│   │   │   ├── client.ts               # Stripe client
│   │   │   └── plans.ts                # Планы подписок
│   │   ├── pdf/
│   │   │   └── generator.ts            # PDF генератор
│   │   └── utils.ts                    # Утилиты
│   ├── types/
│   │   ├── analysis.ts                 # Типы для анализа
│   │   ├── report.ts                   # Типы для отчётов
│   │   ├── database.ts                 # Supabase generated types
│   │   └── api.ts                      # API request/response types
│   ├── hooks/
│   │   ├── useAnalysis.ts              # Хук для работы с анализом
│   │   ├── useCredits.ts               # Хук для кредитов
│   │   └── usePolling.ts               # Хук для polling статуса
│   └── workers/
│       └── analyzer/
│           ├── index.ts                # Cloudflare Worker entry point
│           ├── screenshot.ts           # Screenshot logic
│           ├── lighthouse.ts           # Lighthouse runner
│           ├── accessibility.ts        # Accessibility checks
│           └── errors.ts               # Error collection
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_functions.sql
│   └── seed.sql
├── public/
│   ├── og-image.png
│   └── favicon.ico
├── .env.local.example
├── .env.local                          # (gitignored)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── claude.md                           # Этот файл
```

---

## 4. Database Schema

### Full SQL Schema

```sql
-- ============================================
-- 001_initial_schema.sql
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: analyses
-- ============================================
CREATE TABLE analyses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed')),

  -- Raw results from Cloudflare Worker
  screenshot_url        TEXT,
  lighthouse_scores     JSONB,   -- { performance, accessibility, best-practices, seo }
  console_errors        JSONB,   -- Array of { message, type, source, line }
  accessibility_issues  JSONB,   -- Array of WCAG violations
  network_requests      JSONB,   -- Summary of network activity

  -- AI-generated content
  ai_insights           JSONB,   -- Structured AI analysis
  ai_summary            TEXT,    -- Human-readable summary

  -- Metadata
  error_message   TEXT,          -- If status = 'failed'
  queue_position  INTEGER,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX idx_analyses_url ON analyses(url);

-- ============================================
-- TABLE: user_settings
-- ============================================
CREATE TABLE user_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  credits           INTEGER NOT NULL DEFAULT 3,         -- Free tier starts with 3
  credits_used      INTEGER NOT NULL DEFAULT 0,
  notifications     JSONB NOT NULL DEFAULT '{
    "email_on_complete": true,
    "email_on_fail": true,
    "weekly_digest": false
  }',
  preferences       JSONB NOT NULL DEFAULT '{
    "default_device": "desktop",
    "default_throttling": "none",
    "timezone": "UTC"
  }',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- ============================================
-- TABLE: subscriptions
-- ============================================
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan                  TEXT NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free', 'pro', 'agency')),
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- ============================================
-- 002_rls_policies.sql
-- ============================================

-- Row Level Security
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- analyses: users see only their own
CREATE POLICY "analyses_select_own" ON analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "analyses_insert_own" ON analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analyses_update_own" ON analyses
  FOR UPDATE USING (auth.uid() = user_id);

-- user_settings: users see only their own
CREATE POLICY "user_settings_select_own" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- subscriptions: users see only their own
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role bypass (for Cloudflare Worker callbacks)
CREATE POLICY "analyses_service_role" ON analyses
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "user_settings_service_role" ON user_settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "subscriptions_service_role" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 003_functions.sql
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user_settings on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Decrement credits helper (atomic)
CREATE OR REPLACE FUNCTION use_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  SELECT credits INTO v_credits
  FROM user_settings
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_credits <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE user_settings
  SET credits = credits - 1,
      credits_used = credits_used + 1
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Four-Week Development Plan

### Week 1: Core Analysis Engine

**Цель**: Рабочий анализ одного сайта от URL до сохранённых результатов

---

#### Day 1-2: Project Setup

```bash
# Инициализация
npx create-next-app@latest website-analyzer \
  --typescript --tailwind --eslint --app --src-dir

cd website-analyzer

# shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card input badge progress skeleton toast

# Зависимости
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  @anthropic-ai/sdk \
  openai \
  @upstash/redis \
  stripe \
  @stripe/stripe-js \
  recharts \
  zod \
  react-hook-form \
  @hookform/resolvers \
  lucide-react \
  date-fns \
  sonner

# Dev зависимости
npm install -D \
  @types/node \
  supabase \
  wrangler
```

**Tasks Week 1**:
- [x] Инициализировать Next.js проект с TypeScript
- [x] Настроить shadcn/ui с темой
- [x] Создать Supabase проект и запустить миграции
- [x] Создать Cloudflare Worker с базовой структурой (`src/workers/analyzer/index.ts`)
- [x] Реализовать screenshot capture через Playwright
- [x] Интегрировать Lighthouse
- [x] Добавить accessibility checks (axe-core)
- [x] Настроить Upstash Redis очередь
- [x] Создать API route POST /api/analyze
- [x] Создать API route POST /api/analyze/callback
- [x] Загрузка скриншотов в Supabase Storage

**Deliverables Week 1**: ✅ Complete
- Worker принимает URL → возвращает JSON с полными данными
- Database корректно хранит результаты
- Screenshots загружаются в Supabase Storage

---

### Week 2: Frontend + Authentication

**Цель**: Пользователь может создать аккаунт и запустить первый анализ

**Tasks Week 2**:
- [x] Страница Login (email/password + Google OAuth)
- [x] Страница Signup с валидацией
- [x] Auth callback handler для OAuth (`/auth/callback/route.ts`)
- [x] Защищённый middleware для dashboard routes (`src/middleware.ts`)
- [x] Компонент URLInput с валидацией
- [x] Loading states и error handling
- [x] Проверка кредитов перед запуском (atomic `use_credit` DB function)
- [x] Страница статуса анализа с polling (`/analyze/[id]`)
- [x] Отображение позиции в очереди (in `AnalysisProgress`)
- [x] Базовый просмотр результатов (скриншот + score)

**Deliverables Week 2**: ✅ Complete
- Пользователь может: signup → login → submit URL → see status

---

### Week 3: AI Analysis + Detailed Reporting

**Цель**: Полноценные отчёты с AI-рекомендациями

**Tasks Week 3**:
- [x] Интеграция Claude API для анализа скриншотов (vision) — `lib/ai/claude.ts`
- [ ] Интеграция GPT-4o для текстовых рекомендаций — `lib/ai/openai.ts` not yet created
- [x] AI промпты для всех типов анализа (5 prompts in `lib/ai/prompts.ts`)
- [x] Детальная страница отчёта (`/reports/[id]`)
- [x] Performance Section с Recharts
- [x] Accessibility Section с WCAG issues
- [x] Console Errors Section с интерпретацией
- [x] AI Insights Section с рекомендациями
- [x] Screenshot viewer
- [x] PDF export route (`/api/reports/[id]/pdf`)
- [x] История анализов (`/reports`)
- [ ] Сравнение "до/после" — not implemented (post-MVP)

**Deliverables Week 3**: ✅ Mostly complete (GPT-4o and comparison view deferred)

---

### Week 4: Dashboard + Polish + Deployment

**Цель**: Production-ready MVP

**Tasks Week 4**:
- [x] Dashboard: stats overview, recent analyses, quick actions
- [x] Settings: profile, notifications, billing portal, API keys, webhooks, team members
- [x] Stripe checkout flow
- [x] Stripe webhook handler (subscription updates, credits)
- [x] Error boundaries на всех страницах
- [x] Loading skeletons
- [x] Toast уведомления (sonner)
- [x] Responsive design (mobile-first)
- [x] SEO: metadata, sitemap.xml (`sitemap.ts`), robots.txt (`robots.ts`)
- [x] Security headers (next.config.js)
- [ ] Sentry интеграция — deferred (SENTRY_DSN not configured)
- [x] Vercel Analytics — `<Analytics />` in root layout
- [x] Deploy на Vercel (production) — deployed, auto-deploys on push
- [ ] Deploy Cloudflare Worker — pending
- [ ] Настройка env variables on Vercel — pending (Vercel CLI token expired)
- [ ] Кастомный домен — not done
- [x] **Dark Observatory design system** — full site-wide rollout (43 files)

**Deliverables Week 4**: ✅ Complete (3 items deferred: Sentry, Worker deploy, custom domain)

---

## 6. Code Examples

### 6.1 Cloudflare Worker — Analyzer

```typescript
// src/workers/analyzer/index.ts
import { chromium } from 'playwright-core';

interface AnalysisRequest {
  analysisId: string;
  url: string;
  callbackUrl: string;
  authToken: string;
}

interface AnalysisResult {
  analysisId: string;
  screenshotBase64: string;
  lighthouseScores: LighthouseScores;
  consoleErrors: ConsoleError[];
  accessibilityIssues: AccessibilityIssue[];
  networkSummary: NetworkSummary;
}

interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcp: number;   // Largest Contentful Paint (ms)
  fid: number;   // First Input Delay (ms)
  cls: number;   // Cumulative Layout Shift
  ttfb: number;  // Time to First Byte (ms)
}

interface ConsoleError {
  message: string;
  type: 'error' | 'warning' | 'info';
  source: string;
  line?: number;
  timestamp: number;
}

interface AccessibilityIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  nodes: string[];
  wcagCriteria: string[];
}

interface NetworkSummary {
  totalRequests: number;
  totalBytes: number;
  failedRequests: number;
  slowRequests: number; // > 3s
}

export default {
  async fetch(request: Request): Promise<Response> {
    // Verify auth
    const authHeader = request.headers.get('Authorization');
    const expectedToken = `Bearer ${process.env.WORKER_AUTH_TOKEN}`;
    if (authHeader !== expectedToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body: AnalysisRequest;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    // Run analysis in background, return immediately
    const ctx = (globalThis as any).executionContext;
    ctx.waitUntil(runAnalysis(body));

    return new Response(JSON.stringify({ status: 'queued', analysisId: body.analysisId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function runAnalysis(req: AnalysisRequest): Promise<void> {
  const timeout = 90_000; // 90s hard limit
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0; +https://websiteanalyzer.dev)',
    });

    const page = await context.newPage();
    const consoleErrors: ConsoleError[] = [];
    const networkRequests: { url: string; duration: number; failed: boolean; bytes: number }[] = [];

    // Collect console messages
    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) {
        consoleErrors.push({
          message: msg.text(),
          type: msg.type() as 'error' | 'warning',
          source: msg.location().url ?? 'unknown',
          line: msg.location().lineNumber,
          timestamp: Date.now(),
        });
      }
    });

    // Collect network activity
    const requestTimes = new Map<string, number>();
    page.on('request', (req) => requestTimes.set(req.url(), Date.now()));
    page.on('response', async (resp) => {
      const start = requestTimes.get(resp.url()) ?? Date.now();
      const duration = Date.now() - start;
      let bytes = 0;
      try {
        const buf = await resp.body();
        bytes = buf.byteLength;
      } catch {}
      networkRequests.push({
        url: resp.url(),
        duration,
        failed: !resp.ok(),
        bytes,
      });
    });

    // Navigate with timeout
    await page.goto(req.url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // Screenshot (full page)
    const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    const screenshotBase64 = Buffer.from(screenshotBuffer).toString('base64');

    // Accessibility check via axe-core injected into page
    const accessibilityIssues = await runAccessibilityChecks(page);

    // Lighthouse (runs in separate CDP session)
    const lighthouseScores = await runLighthouse(req.url);

    // Network summary
    const networkSummary: NetworkSummary = {
      totalRequests: networkRequests.length,
      totalBytes: networkRequests.reduce((sum, r) => sum + r.bytes, 0),
      failedRequests: networkRequests.filter((r) => r.failed).length,
      slowRequests: networkRequests.filter((r) => r.duration > 3000).length,
    };

    await browser.close();

    const result: AnalysisResult = {
      analysisId: req.analysisId,
      screenshotBase64,
      lighthouseScores,
      consoleErrors: consoleErrors.slice(0, 50), // max 50 errors
      accessibilityIssues,
      networkSummary,
    };

    await sendCallback(req.callbackUrl, req.authToken, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await sendCallback(req.callbackUrl, req.authToken, {
      analysisId: req.analysisId,
      error: message,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runAccessibilityChecks(page: any): Promise<AccessibilityIssue[]> {
  // Inject axe-core and run
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js',
  });

  const results = await page.evaluate(async () => {
    // @ts-ignore — axe injected at runtime
    const axeResults = await axe.run();
    return axeResults.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n: any) => n.target.join(', ')).slice(0, 5),
      wcagCriteria: v.tags.filter((t: string) => t.startsWith('wcag')),
    }));
  });

  return results as AccessibilityIssue[];
}

async function runLighthouse(url: string): Promise<LighthouseScores> {
  // Simplified — in production use lighthouse npm package via Node.js runner
  // Cloudflare Workers don't support Node.js lighthouse directly;
  // trigger via a separate Node.js service or use the Chrome DevTools Protocol
  return {
    performance: 85,
    accessibility: 92,
    bestPractices: 88,
    seo: 90,
    lcp: 2400,
    fid: 45,
    cls: 0.08,
    ttfb: 320,
  };
}

async function sendCallback(url: string, token: string, data: object): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}
```

---

### 6.2 API Routes

#### POST /api/analyze

```typescript
// src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { redis } from '@/lib/queue/redis';
import { z } from 'zod';

const schema = z.object({
  url: z
    .string()
    .url('Invalid URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL must start with http:// or https://'
    ),
});

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate input
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { url } = parsed.data;

  // Check & consume credit (atomic DB function)
  const { data: hasCredit, error: creditError } = await supabase.rpc('use_credit', {
    p_user_id: user.id,
  });

  if (creditError || !hasCredit) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.' },
      { status: 402 }
    );
  }

  // Create analysis record
  const { data: analysis, error: insertError } = await supabase
    .from('analyses')
    .insert({ user_id: user.id, url, status: 'pending' })
    .select('id')
    .single();

  if (insertError || !analysis) {
    // Refund credit on failure
    await supabase.rpc('refund_credit', { p_user_id: user.id });
    return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 });
  }

  // Add to Redis queue
  await redis.lpush('analysis:queue', JSON.stringify({
    analysisId: analysis.id,
    url,
    userId: user.id,
    createdAt: new Date().toISOString(),
  }));

  // Update status to queued + get queue position
  const queueLength = await redis.llen('analysis:queue');
  await supabase
    .from('analyses')
    .update({ status: 'queued', queue_position: queueLength })
    .eq('id', analysis.id);

  // Trigger Cloudflare Worker
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;

  fetch(`${process.env.CLOUDFLARE_WORKER_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      analysisId: analysis.id,
      url,
      callbackUrl,
      authToken: process.env.WORKER_CALLBACK_SECRET,
    }),
  }).catch(console.error); // fire-and-forget

  return NextResponse.json(
    { analysisId: analysis.id, status: 'queued', queuePosition: queueLength },
    { status: 202 }
  );
}
```

#### POST /api/analyze/callback

```typescript
// src/app/api/analyze/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { analyzeWithAI } from '@/lib/ai/claude';
import { uploadScreenshot } from '@/lib/supabase/storage';

export async function POST(req: NextRequest) {
  // Verify callback authenticity
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.WORKER_CALLBACK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient(); // bypasses RLS
  const body = await req.json();

  const { analysisId, error: workerError, ...results } = body;

  // Handle worker error
  if (workerError) {
    await supabase
      .from('analyses')
      .update({
        status: 'failed',
        error_message: workerError,
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    return NextResponse.json({ received: true });
  }

  try {
    // Upload screenshot to Supabase Storage
    let screenshotUrl: string | null = null;
    if (results.screenshotBase64) {
      const buffer = Buffer.from(results.screenshotBase64, 'base64');
      screenshotUrl = await uploadScreenshot(supabase, analysisId, buffer);
    }

    // Run AI analysis (non-blocking — update DB when done)
    const aiInsights = await analyzeWithAI({
      screenshotBase64: results.screenshotBase64,
      lighthouseScores: results.lighthouseScores,
      consoleErrors: results.consoleErrors,
      accessibilityIssues: results.accessibilityIssues,
    });

    // Save everything to DB
    await supabase
      .from('analyses')
      .update({
        status: 'completed',
        screenshot_url: screenshotUrl,
        lighthouse_scores: results.lighthouseScores,
        console_errors: results.consoleErrors,
        accessibility_issues: results.accessibilityIssues,
        network_requests: results.networkSummary,
        ai_insights: aiInsights,
        ai_summary: aiInsights.summary,
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    return NextResponse.json({ received: true, status: 'completed' });
  } catch (err) {
    console.error('Callback processing error:', err);

    await supabase
      .from('analyses')
      .update({
        status: 'failed',
        error_message: 'Failed to process analysis results',
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    return NextResponse.json({ received: true, status: 'failed' });
  }
}
```

#### GET /api/reports/[id]

```typescript
// src/app/api/reports/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id) // RLS also enforces this
    .single();

  if (error || !analysis) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  return NextResponse.json(analysis);
}
```

---

### 6.3 React Components

#### LoginForm

```typescript
// src/components/auth/LoginForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(data);
      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email address"
            {...register('email')}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div>
          <Input
            type="password"
            placeholder="Password"
            {...register('password')}
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={loginWithGoogle}>
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          {/* Google icon path */}
        </svg>
        Google
      </Button>
    </div>
  );
}
```

#### URLInput

```typescript
// src/components/analyze/URLInput.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const urlSchema = z.string().url('Please enter a valid URL (include https://)');

export function URLInput({ credits }: { credits: number }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validate = (value: string): boolean => {
    const result = urlSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(url)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (res.status === 402) {
        toast.error('No credits remaining. Please upgrade your plan.');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to start analysis');
      }

      const { analysisId } = await res.json();
      router.push(`/analyze/${analysisId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) validate(e.target.value);
          }}
          className="flex-1"
          aria-label="Website URL"
          aria-invalid={!!error}
          aria-describedby={error ? 'url-error' : undefined}
        />
        <Button type="submit" disabled={loading || credits === 0}>
          {loading ? 'Starting...' : 'Analyze'}
        </Button>
      </div>

      {error && (
        <p id="url-error" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {credits} credit{credits !== 1 ? 's' : ''} remaining
      </p>
    </form>
  );
}
```

#### AnalysisProgress (with polling)

```typescript
// src/components/analyze/AnalysisProgress.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

type Status = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

interface AnalysisState {
  status: Status;
  queuePosition?: number;
  url: string;
}

const STATUS_MESSAGES: Record<Status, string> = {
  pending: 'Initializing...',
  queued: 'Waiting in queue',
  running: 'Analyzing your website',
  completed: 'Analysis complete!',
  failed: 'Analysis failed',
};

const STATUS_PROGRESS: Record<Status, number> = {
  pending: 5,
  queued: 15,
  running: 60,
  completed: 100,
  failed: 0,
};

export function AnalysisProgress({ analysisId }: { analysisId: string }) {
  const [state, setState] = useState<AnalysisState | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${analysisId}`);
        if (!res.ok) throw new Error('Failed to fetch status');

        const data = await res.json();
        setState({
          status: data.status,
          queuePosition: data.queue_position,
          url: data.url,
        });

        if (data.status === 'completed') {
          clearInterval(interval);
          // Small delay so user sees 100% progress
          setTimeout(() => router.push(`/reports/${analysisId}`), 1500);
        }

        if (data.status === 'failed') {
          clearInterval(interval);
          setError(data.error_message ?? 'Analysis failed. Please try again.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    poll(); // immediate first call
    interval = setInterval(poll, 3000); // poll every 3s

    return () => clearInterval(interval);
  }, [analysisId, router]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-medium">Analysis Failed</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!state) {
    return <div className="animate-pulse h-24 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium truncate max-w-xs">{state.url}</p>
        <Badge variant={state.status === 'failed' ? 'destructive' : 'secondary'}>
          {state.status}
        </Badge>
      </div>

      <Progress value={STATUS_PROGRESS[state.status]} className="h-2" />

      <p className="text-sm text-muted-foreground text-center">
        {STATUS_MESSAGES[state.status]}
        {state.status === 'queued' && state.queuePosition && (
          <span> — Position #{state.queuePosition} in queue</span>
        )}
      </p>
    </div>
  );
}
```

#### PerformanceSection with Recharts

```typescript
// src/components/reports/PerformanceSection.tsx
'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBadge(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 90) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
}

export function PerformanceSection({ scores }: { scores: LighthouseScores }) {
  const radarData = [
    { subject: 'Performance', value: scores.performance },
    { subject: 'Accessibility', value: scores.accessibility },
    { subject: 'Best Practices', value: scores.bestPractices },
    { subject: 'SEO', value: scores.seo },
  ];

  const coreWebVitals = [
    { label: 'LCP', value: `${(scores.lcp / 1000).toFixed(1)}s`, good: scores.lcp < 2500 },
    { label: 'FID', value: `${scores.fid}ms`, good: scores.fid < 100 },
    { label: 'CLS', value: scores.cls.toFixed(3), good: scores.cls < 0.1 },
    { label: 'TTFB', value: `${scores.ttfb}ms`, good: scores.ttfb < 800 },
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Performance</h2>

      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {radarData.map((item) => (
          <Card key={item.subject}>
            <CardContent className="pt-6 text-center">
              <div className={`text-4xl font-bold ${getScoreColor(item.value)}`}>
                {item.value}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{item.subject}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Radar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Score Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.3}
              />
              <Tooltip formatter={(value) => [`${value}/100`]} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Core Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle>Core Web Vitals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {coreWebVitals.map((vital) => (
              <div key={vital.label} className="text-center space-y-2">
                <Badge variant={vital.good ? 'default' : 'destructive'}>
                  {vital.label}
                </Badge>
                <p className="text-2xl font-semibold">{vital.value}</p>
                <p className="text-xs text-muted-foreground">
                  {vital.good ? '✓ Good' : '✗ Needs work'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
```

#### AIInsightsSection

```typescript
// src/components/reports/AIInsightsSection.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AIInsight {
  category: 'performance' | 'accessibility' | 'ux' | 'seo' | 'security';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  estimatedImpact: string;
}

interface AIInsights {
  summary: string;
  overallScore: number;
  insights: AIInsight[];
  quickWins: string[];
}

const PRIORITY_COLORS: Record<AIInsight['priority'], string> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

const CATEGORY_ICONS: Record<AIInsight['category'], string> = {
  performance: '⚡',
  accessibility: '♿',
  ux: '🎨',
  seo: '🔍',
  security: '🔒',
};

export function AIInsightsSection({ insights }: { insights: AIInsights }) {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">AI Insights</h2>

      {/* Summary card */}
      <Card className="border-indigo-200 bg-indigo-50 dark:bg-indigo-950">
        <CardContent className="pt-6">
          <p className="text-sm leading-relaxed">{insights.summary}</p>
        </CardContent>
      </Card>

      {/* Quick wins */}
      {insights.quickWins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">⚡ Quick Wins</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.quickWins.map((win, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{win}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Detailed insights */}
      <div className="space-y-4">
        {insights.insights.map((insight, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_ICONS[insight.category]}</span>
                  <CardTitle className="text-base">{insight.title}</CardTitle>
                </div>
                <Badge variant={PRIORITY_COLORS[insight.priority] as any}>
                  {insight.priority}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{insight.description}</p>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium mb-1">Recommendation:</p>
                <p className="text-sm">{insight.recommendation}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Expected impact: {insight.estimatedImpact}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
```

---

### 6.4 AI Prompts

```typescript
// src/lib/ai/prompts.ts

export const AI_PROMPTS = {
  /**
   * Analyses screenshot for UX/visual issues via Claude Vision.
   * Returns structured JSON with specific issues found.
   */
  screenshotAnalysis: () => `
You are an expert UX and web design analyst. Analyze the provided website screenshot and identify issues.

Focus on:
1. Visual hierarchy and readability (font sizes, contrast ratios, spacing)
2. Layout problems (overlapping elements, broken grids, alignment issues)
3. Call-to-action visibility and placement
4. Mobile-friendliness indicators visible in the screenshot
5. Trust signals (professional appearance, clear branding)
6. Content clarity and information architecture

Return ONLY valid JSON in this exact format:
{
  "overallUXScore": <0-100>,
  "issues": [
    {
      "category": "readability" | "layout" | "cta" | "trust" | "content",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "<short issue title>",
      "description": "<what is wrong and where>",
      "recommendation": "<specific actionable fix>",
      "estimatedImpact": "<expected improvement if fixed>"
    }
  ],
  "positives": ["<what the site does well>"],
  "quickWins": ["<easy fix that would have significant impact>"]
}

Be specific and actionable. Reference exact elements you can see in the screenshot.
`,

  /**
   * Interprets Lighthouse performance data.
   * Returns optimization priorities with estimated impact.
   */
  performanceAnalysis: (data: {
    performance: number;
    lcp: number;
    fid: number;
    cls: number;
    ttfb: number;
    networkSummary: {
      totalRequests: number;
      totalBytes: number;
      failedRequests: number;
      slowRequests: number;
    };
  }) => `
You are a web performance expert. Analyze these Lighthouse metrics and provide actionable recommendations.

Metrics:
- Performance Score: ${data.performance}/100
- LCP (Largest Contentful Paint): ${data.lcp}ms (good: <2500ms)
- FID (First Input Delay): ${data.fid}ms (good: <100ms)
- CLS (Cumulative Layout Shift): ${data.cls} (good: <0.1)
- TTFB (Time to First Byte): ${data.ttfb}ms (good: <800ms)
- Total network requests: ${data.networkSummary.totalRequests}
- Total page weight: ${Math.round(data.networkSummary.totalBytes / 1024)}KB
- Failed requests: ${data.networkSummary.failedRequests}
- Slow requests (>3s): ${data.networkSummary.slowRequests}

Return ONLY valid JSON:
{
  "summary": "<2-3 sentence performance overview>",
  "criticalIssues": [
    {
      "metric": "LCP" | "FID" | "CLS" | "TTFB" | "weight" | "requests",
      "currentValue": "<current>",
      "targetValue": "<target>",
      "fix": "<specific technical recommendation>",
      "expectedImprovement": "<e.g., reduce LCP by ~30%>"
    }
  ],
  "recommendations": [
    "<prioritized list of improvements>"
  ],
  "estimatedScoreAfterFixes": <0-100>
}
`,

  /**
   * Interprets WCAG accessibility violations.
   * Explains issues in plain language with fix examples.
   */
  accessibilityAnalysis: (issues: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: string[];
    wcagCriteria: string[];
  }>) => `
You are an accessibility expert. Interpret these WCAG violations for a developer who may not know accessibility rules well.

Issues found:
${JSON.stringify(issues, null, 2)}

For each issue, explain:
1. What it is in plain language (not WCAG jargon)
2. Who it affects (e.g., screen reader users, keyboard users)
3. Exactly how to fix it with a code example

Return ONLY valid JSON:
{
  "overallAccessibilityLevel": "A" | "AA" | "AAA" | "non-compliant",
  "criticalCount": <number>,
  "interpretedIssues": [
    {
      "originalId": "<axe rule id>",
      "plainEnglish": "<explanation without jargon>",
      "affectedUsers": "<who this impacts>",
      "fixExample": "<HTML/CSS/JS code snippet showing the fix>",
      "wcagLevel": "A" | "AA" | "AAA",
      "estimatedFixTime": "<e.g., 5 minutes, 1 hour>"
    }
  ],
  "prioritizedFixes": ["<ordered list: fix these first>"]
}
`,

  /**
   * Explains console errors in developer-friendly language.
   * Groups similar errors and suggests root causes.
   */
  consoleErrorsAnalysis: (errors: Array<{
    message: string;
    type: string;
    source: string;
    line?: number;
  }>) => `
You are a JavaScript debugging expert. Analyze these browser console errors and explain them.

Console output:
${JSON.stringify(errors, null, 2)}

Group similar errors, identify root causes, and provide fixes.

Return ONLY valid JSON:
{
  "totalErrors": <number>,
  "criticalErrors": <number>,
  "errorGroups": [
    {
      "pattern": "<error pattern/type>",
      "count": <occurrences>,
      "severity": "critical" | "warning" | "info",
      "plainExplanation": "<what this error means in plain English>",
      "likelyRootCause": "<why this is probably happening>",
      "fixSuggestion": "<specific code or config fix>",
      "affectsUsers": true | false
    }
  ],
  "hasBlockingErrors": true | false,
  "summary": "<overall assessment of console health>"
}
`,

  /**
   * Combines all analysis data into final report summary.
   */
  finalSummary: (data: {
    url: string;
    performanceScore: number;
    accessibilityScore: number;
    seoScore: number;
    errorCount: number;
    accessibilityIssueCount: number;
  }) => `
You are a web quality expert. Write a concise executive summary for a website analysis report.

Site: ${data.url}
- Performance: ${data.performanceScore}/100
- Accessibility: ${data.accessibilityScore}/100  
- SEO: ${data.seoScore}/100
- Console errors: ${data.errorCount}
- Accessibility issues: ${data.accessibilityIssueCount}

Write a 3-4 sentence executive summary that:
1. States overall site health plainly
2. Highlights the most important issue to fix
3. Ends with an encouraging note about improvement potential

Write for a non-technical business owner. No jargon. No JSON, just plain text.
`,
};
```

---

### 6.5 Supabase Clients

```typescript
// src/lib/supabase/client.ts — browser
import { createBrowserClient as _createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createBrowserClient() {
  return _createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// src/lib/supabase/server.ts — server (API routes, Server Components)
import { createServerClient as _createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export function createServerClient() {
  const cookieStore = cookies();
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

// Bypasses RLS — only for trusted server-side operations (webhooks, Worker callbacks)
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

---

### 6.6 Claude AI Client

```typescript
// src/lib/ai/claude.ts
import Anthropic from '@anthropic-ai/sdk';
import { AI_PROMPTS } from './prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnalysisInput {
  screenshotBase64: string;
  lighthouseScores: any;
  consoleErrors: any[];
  accessibilityIssues: any[];
}

export async function analyzeWithAI(input: AnalysisInput) {
  const [screenshotAnalysis, performanceAnalysis, accessibilityAnalysis, errorsAnalysis] =
    await Promise.all([
      analyzeScreenshot(input.screenshotBase64),
      analyzePerformance(input.lighthouseScores),
      analyzeAccessibility(input.accessibilityIssues),
      analyzeErrors(input.consoleErrors),
    ]);

  return {
    screenshot: screenshotAnalysis,
    performance: performanceAnalysis,
    accessibility: accessibilityAnalysis,
    errors: errorsAnalysis,
    summary: screenshotAnalysis.overallUXScore,
    quickWins: [
      ...(screenshotAnalysis.quickWins ?? []),
      ...(performanceAnalysis.recommendations?.slice(0, 2) ?? []),
    ],
  };
}

async function analyzeScreenshot(screenshotBase64: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshotBase64,
            },
          },
          {
            type: 'text',
            text: AI_PROMPTS.screenshotAnalysis(),
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text);
}

async function analyzePerformance(scores: any) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: AI_PROMPTS.performanceAnalysis(scores),
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text);
}

async function analyzeAccessibility(issues: any[]) {
  if (!issues.length) return { overallAccessibilityLevel: 'AA', criticalCount: 0, interpretedIssues: [] };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: AI_PROMPTS.accessibilityAnalysis(issues),
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text);
}

async function analyzeErrors(errors: any[]) {
  if (!errors.length) return { totalErrors: 0, criticalErrors: 0, errorGroups: [], hasBlockingErrors: false };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: AI_PROMPTS.consoleErrorsAnalysis(errors),
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text);
}
```

---

### 6.7 Middleware (Auth Protection)

```typescript
// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_ROUTES = ['/dashboard', '/analyze', '/reports', '/settings'];
const AUTH_ROUTES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
```

---

## 7. Environment Variables

```env
# ============================================
# .env.local.example
# ============================================

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Never expose to browser

# Redis (Upstash)
UPSTASH_REDIS_URL=https://...upstash.io
UPSTASH_REDIS_TOKEN=...

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Cloudflare Worker
CLOUDFLARE_WORKER_URL=https://analyzer.yourname.workers.dev
CLOUDFLARE_WORKER_AUTH_TOKEN=...    # Worker validates this header
WORKER_CALLBACK_SECRET=...          # App validates callback with this

# Stripe
STRIPE_SECRET_KEY=sk_live_...       # Use sk_test_... for development
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# App
NEXT_PUBLIC_APP_URL=https://websiteanalyzer.dev   # No trailing slash
```

### Variable Setup Checklist:
- [ ] Create Supabase project → copy URL + anon key + service_role key
- [ ] Create Upstash Redis database → copy URL + token
- [ ] Create Anthropic account → generate API key
- [ ] Create OpenAI account → generate API key
- [ ] Deploy Cloudflare Worker → copy Worker URL, generate auth tokens
- [ ] Create Stripe account → copy keys, set up webhook endpoint
- [ ] Set all vars in Vercel Dashboard → Settings → Environment Variables
- [ ] Set Cloudflare Worker secrets via `wrangler secret put`

---

## 8. Testing Checklists

### Week 1 Testing
- [ ] Worker accepts valid URL and returns JSON response
- [ ] Worker returns error for unreachable URL (timeout handling)
- [ ] Screenshot is generated and is valid PNG
- [ ] Lighthouse scores are within expected ranges (0-100)
- [ ] Accessibility violations are detected on a known-bad page
- [ ] Console errors are captured (test with a page that has `console.error`)
- [ ] `/api/analyze` returns 401 for unauthenticated request
- [ ] `/api/analyze` returns 400 for invalid URL
- [ ] `/api/analyze` returns 402 when credits = 0
- [ ] `/api/analyze/callback` validates the auth token
- [ ] Analysis record is created in database with correct status
- [ ] Screenshot is uploaded to Supabase Storage
- [ ] Status transitions: pending → queued → running → completed

### Week 2 Testing
- [ ] User can sign up with email + password
- [ ] User can sign up with Google OAuth
- [ ] Login with wrong password shows error message
- [ ] Login redirects to dashboard
- [ ] Unauthenticated access to /dashboard redirects to /login
- [ ] URL input validates and shows error for `not-a-url`
- [ ] URL input accepts `https://example.com`
- [ ] Credits counter decrements after submitting analysis
- [ ] Analysis status page polls and updates
- [ ] Queue position is displayed when status = queued
- [ ] Completed analysis redirects to report page
- [ ] Failed analysis shows error message

### Week 3 Testing
- [ ] AI screenshot analysis returns valid JSON
- [ ] AI performance analysis includes actionable recommendations
- [ ] AI accessibility analysis explains issues in plain language
- [ ] AI console error analysis groups similar errors
- [ ] Recharts render correctly with real data
- [ ] PDF export downloads a valid PDF file
- [ ] PDF contains all sections (performance, accessibility, AI insights)
- [ ] Analysis history shows all past analyses
- [ ] Analyses are sorted by date (newest first)
- [ ] Clicking a history item navigates to report

### Week 4 Testing
- [ ] Dashboard stats are accurate (count from DB)
- [ ] Settings page saves profile changes
- [ ] Stripe checkout opens for Pro plan
- [ ] Stripe webhook updates subscription status in DB
- [ ] Credits are added after successful payment
- [ ] Error boundary catches component crashes gracefully
- [ ] Mobile layout is usable on 375px screen width
- [ ] sitemap.xml is accessible at /sitemap.xml
- [ ] robots.txt allows indexing of public pages
- [ ] Sentry captures a test error
- [ ] Vercel Analytics shows page views

---

## 9. Deployment Steps

### 9.1 Supabase Setup

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push

# Enable Google OAuth in Supabase Dashboard:
# Authentication → Providers → Google → Enable
# Add: Site URL = https://your-domain.com
# Add redirect URL: https://your-domain.com/auth/callback

# Create storage bucket for screenshots
# Storage → New bucket → "screenshots" → Public: false
# Set policy: allow authenticated users to upload
```

### 9.2 Cloudflare Worker Deployment

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create worker project
cd src/workers/analyzer
wrangler init

# wrangler.toml
cat > wrangler.toml << 'EOF'
name = "website-analyzer"
main = "index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

# Add Playwright binding if using Cloudflare Browser Rendering
# browser = { binding = "BROWSER" }
EOF

# Set secrets (never in wrangler.toml)
wrangler secret put WORKER_AUTH_TOKEN
wrangler secret put WORKER_CALLBACK_SECRET

# Deploy
wrangler deploy

# Verify
wrangler tail  # stream live logs
```

### 9.3 Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (first time)
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add OPENAI_API_KEY production
vercel env add CLOUDFLARE_WORKER_URL production
vercel env add CLOUDFLARE_WORKER_AUTH_TOKEN production
vercel env add WORKER_CALLBACK_SECRET production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_APP_URL production

# Deploy to production
vercel --prod

# Add custom domain in Vercel Dashboard:
# Settings → Domains → Add domain
```

### 9.4 Stripe Setup

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Create products (one-time setup)
stripe products create --name="Pro Plan"
stripe prices create \
  --product=prod_xxx \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month

# Forward webhooks in development
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Register webhook in production at: dashboard.stripe.com/webhooks
# URL: https://your-domain.com/api/stripe/webhook
# Events to listen:
#   - customer.subscription.created
#   - customer.subscription.updated
#   - customer.subscription.deleted
#   - invoice.payment_succeeded
#   - invoice.payment_failed
```

---

## 10. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Analysis completion rate | > 95% | `analyses WHERE status='completed' / total` |
| Average analysis time | < 60s | `AVG(completed_at - created_at)` |
| API response time | < 200ms | Vercel Analytics → Functions |
| Error rate | < 1% | Sentry error rate dashboard |
| Time to first analysis | < 3 min | Track signup → first completed analysis |
| Credit conversion rate | > 20% | free users who upgrade |
| AI analysis accuracy | Qualitative | User feedback / thumbs up |

### Monitoring Queries (Supabase SQL Editor):

```sql
-- Completion rate (last 7 days)
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) AS completion_rate,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) AS avg_seconds
FROM analyses
WHERE created_at > NOW() - INTERVAL '7 days';

-- Error rate
SELECT
  COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*) AS error_rate
FROM analyses
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Active users (submitted at least one analysis)
SELECT COUNT(DISTINCT user_id) AS active_users
FROM analyses
WHERE created_at > NOW() - INTERVAL '30 days';
```

---

## 11. Post-MVP Features

### Scheduled Monitoring
- Users can set up recurring checks (daily/weekly/monthly)
- Get email alerts when scores drop below threshold
- Uses Vercel Cron or Upstash QStash

### Developer API
```typescript
// API Key generation → stored hashed in DB
// Rate limiting via Upstash Redis
// SDK: npm install @website-analyzer/sdk
const analyzer = new WebsiteAnalyzer({ apiKey: 'wa_live_...' });
const report = await analyzer.analyze('https://example.com');
```

### Integrations
- **Slack**: Post report summaries to a channel
- **Discord**: Webhook notifications
- **GitHub Actions**: `website-analyzer-action` for CI/CD checks
- **Zapier**: Connect to 5000+ apps

### Comparison Views
- Side-by-side before/after analysis
- Track improvement over time with trend charts
- Benchmark against competitors

### White-Label Solution
- Custom branding (logo, colors)
- Custom domain: `reports.youragency.com`
- Remove "Powered by" attribution
- Agency plan pricing

### Team Features
- Invite team members
- Shared analysis history
- Role-based access control
- Team usage dashboard

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev                    # Start Next.js dev server
supabase start                 # Start local Supabase
wrangler dev                   # Start Worker in local mode

# Database
supabase db push               # Apply migrations to remote
supabase gen types typescript  # Regenerate TypeScript types
supabase db reset              # Reset local DB (DESTRUCTIVE)

# Deployment
vercel --prod                  # Deploy to production
wrangler deploy                # Deploy Cloudflare Worker
stripe listen --forward-to ... # Forward webhooks locally
```

### Useful URLs

| Service | URL |
|---------|-----|
| Supabase Dashboard | https://supabase.com/dashboard |
| Cloudflare Dashboard | https://dash.cloudflare.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| Stripe Dashboard | https://dashboard.stripe.com |
| Upstash Console | https://console.upstash.com |
| Sentry | https://sentry.io |

### Key Files to Know

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Auth protection for all routes |
| `src/lib/ai/prompts.ts` | All AI prompts — tweak these to improve output |
| `src/workers/analyzer/index.ts` | Core analysis engine |
| `supabase/migrations/001_initial_schema.sql` | DB schema |
| `src/app/api/analyze/route.ts` | Analysis creation endpoint |
| `src/app/api/analyze/callback/route.ts` | Worker result handler |

---

*Last updated: 2026-05-12 | Stack: Next.js 14 + Supabase + Cloudflare Workers + Claude API*
