# Website Analyzer — Fixes & Updates Log

**Document created:** 2026-05-14  
**Last updated:** 2026-06-29  
**Covers:** All changes made across Sprints 1–8, compliance platform Sprints 2–4, Agency Lead Widget Sprint 5, Content/SEO Sprint 6, and the full Trail of Bits 4-phase security audit cycle.

---

## Session 2026-06-29 — Security Audit Cycle Complete

### Trail of Bits 4-Phase Audit — All Findings Resolved

**Test count after this session: 1,819 (65 files, all passing)**

#### Phase 1 — Audit Context Building
Established full architectural context: actors, trust model, 10 invariant gaps identified.
6 gaps patched (see insecure-defaults + sharp-edges); 4 confirmed by design.

#### Phase 2 — Insecure Defaults (F1–F6)

| Finding | Fix | Commit |
|---------|-----|--------|
| F1 — `EMAIL_FROM` fallback to shared Resend inbox | Module-level startup throw in production when `resend && !EMAIL_FROM` | `234e889` |
| F2 — `checkAccountLockout` fails open on Redis absence | Both `!redis` and `catch` paths now return 503 | `234e889` |
| F3 — CSRF fails open when `APP_URL` missing | `!appUrl → 500` in production; dev-only fail-open | `234e889` |
| F4 — Cron secret → `Bearer undefined` | `!cronSecret → 503` guard exits before comparison | `234e889` |
| F5 — `authToken` sent in Worker dispatch body | Field removed from all 5 dispatch sites | `234e889` |
| F6 — `WORKER_CALLBACK_SECRET` unvalidated in callback | `!callbackSecret → 503` exits before Bearer/HMAC check | `234e889` |

#### Phase 3 — Sharp Edges (SE1–SE9)

| Finding | Fix | Commit |
|---------|-----|--------|
| SE1 — HMAC return type ambiguity | Discriminated union for `verifyCallbackSignature` | `89bd48e` |
| SE2 — Rate limit `bypassed` flag unused | `checkWebRateLimit` fail-closed; `checkAccountLockout` independently closed | `89bd48e` |
| SE3 — Per-hop SSRF via crawler redirect | `fetchSameOriginOnly()` rejects hops where hostname changes | `89bd48e` |
| SE4 — SHA-256 as KDF for AES-256-GCM | PBKDF2-SHA256 (600K iterations, `v2:` prefix) | `8a6854d` |
| SE5 — CSRF opt-in per-route | Centralized in middleware; excludes `/api/widget/` + `/api/v1/` | `89bd48e` |
| SE6 — `deliverWebhook` accepts empty string secret | Early return + warn before HMAC when `!secret` | `89bd48e` |
| SE7 — `decryptApiKey` throws on malformed input | Returns `null` instead of throwing | `89bd48e` |
| SE8 — `Math.random` in idempotency key | Replaced with CSPRNG (`crypto.randomBytes`) | `89bd48e` |
| SE9 — `UrlValidationResult` `!` assertions | Discriminated union removes need for assertions | `89bd48e` |

#### Phase 4 — Supply Chain

| Action | Commit |
|--------|--------|
| npm `overrides`: `form-data ^4.0.6` + `ws ^8.21.0` | `27955d0` |
| `npm audit --audit-level=high` added to CI `verify` script | `27955d0` |

#### Post-Audit Differential Review

| Finding | Severity | Fix | Commit |
|---------|---------|-----|--------|
| Worker startup guard (env bindings not validated at boot) | LOW | Returns 500 immediately if `WORKER_AUTH_TOKEN`/`WORKER_CALLBACK_SECRET` not bound | `61ff352` |
| Legacy v1 decrypt path permanent until migration | MEDIUM | Migration script confirmed 0 v1 rows; `legacyKey()` removed | `6084deb` |

**Final state:** 0 open findings. All DB keys in `v2:` format. 1,819 tests. `npm audit` = 0 HIGH.

---

## Session 2026-06-09 — Content/SEO Pages (Sprint 6)

### Sprint 6 — Pricing Page + Changelog Page

| File | Change |
|------|--------|
| `src/components/pricing/PricingPage.tsx` | **Created** — full client component: `COMPARE_ROWS` (21-row feature comparison with group headers), `Cell` helper, `FAQItem` accordion with `aria-expanded`, billing toggle (monthly/annual, 20% discount via `Math.round`), `AuthModal` integration for CTAs. Exports `COMPARE_ROWS` for test imports. |
| `src/app/pricing/page.tsx` | **Created** — server component with `export const metadata`; Schema.org JSON-LD (`SoftwareApplication` + 4 `Offer` objects); renders `<PricingPage />` client component |
| `src/app/pricing/opengraph-image.tsx` | **Created** — `runtime = 'edge'`, 1200×630, renders 4 tier pricing pills with plan name and price |
| `src/data/changelog.ts` | **Created** — `TagType` union, `Release` interface, `RELEASES` array (10 releases v1.0–v2.1, newest-first). Single source of truth — pure TypeScript, no server-only imports. |
| `src/app/changelog/page.tsx` | **Created** — server component; imports + re-exports `RELEASES` from `@/data/changelog`; vertical timeline layout (`absolute left-[7px]` line + dots); `TAG_STYLE` + `TAG_ICON` per tag type |
| `src/app/changelog/opengraph-image.tsx` | **Created** — Edge `ImageResponse`, shows 3 most recent releases as version+title cards |
| `src/app/sitemap.ts` | **Updated** — imports `RELEASES[0].date` for changelog `lastModified`; added `/pricing` (priority 0.9) and `/changelog` (priority 0.7) entries |
| `src/app/page.tsx` | **Updated** — added Pricing and Changelog links to nav and footer |
| `src/__tests__/components/PricingPage.test.tsx` | **Created** — 25 tests: COMPARE_ROWS data integrity (8 invariant checks), render (plan names, prices, billing toggle, FAQ expand/collapse, comparison table heading, "Which plan" section, auth modal on CTA click) |
| `src/__tests__/pages/changelog.test.ts` | **Created** — 9 tests: imports from `@/data/changelog` (not page); validates sort order, unique versions, ISO dates, tag enum, required fields, ≥2 items per release |

**Key decisions:**
- Changelog data extracted to `src/data/changelog.ts` so tests can import it without pulling in server-only modules (lucide-react, ThemeToggle etc.)
- `React.Fragment key={row.label}` used in comparison table to render group header `<tr>` + data `<tr>` pairs without missing key prop warnings
- Annual price calc: `Math.round(monthly * 0.8)` — Pro=$23, Agency=$79, Compliance=$199
- Mock pattern in `PricingPage.test.tsx` avoids JSX in `vi.mock` factories (uses `require('react').createElement(...)`) due to Vitest hoisting before JSX transform
- `getAllByRole('button', { name: /annual/i }).find(b => /^annual/i.test(b.textContent))` to disambiguate billing toggle from FAQ "Do you offer annual billing?" button

**Test total after this session: 552 (all passing)**

---

## Session 2026-06-09 — Agency Lead Widget (Sprint 5)

### Sprint 5 — Lead Widget Feature

| File | Change |
|------|--------|
| `supabase/migrations/018_widget_key.sql` | **Created** — `widget_key TEXT` and `widget_settings JSONB` columns on `user_settings`; RLS allows owner read/write |
| `src/lib/widget-key/generate.ts` | **Created** — `generateWidgetKey()` returns `wk_live_` + 32 random lowercase hex chars; `isValidWidgetKeyFormat()` validates prefix + hex body + exact length |
| `src/lib/rate-limit/web.ts` | **Updated** — added `checkWebRateLimit()` helper for public (non-authenticated) endpoints keyed by widget key; 10 req/hr default |
| `src/app/api/widget/analyze/route.ts` | **Created** — public POST endpoint: validates `widgetKey` format → service-role lookup in `user_settings` → validates URL (normalises bare domains) → `use_credit()` → creates `analyses` row → dispatches Worker; CORS headers on all responses; OPTIONS 204 preflight handler; rate limit via `checkWebRateLimit` |
| `src/app/api/widget/key/route.ts` | **Created** — authenticated PATCH: updates `widget_settings` JSONB (buttonText, buttonColor, position, showEmail) for the logged-in Agency+ user |
| `src/app/api/leads/route.ts` | **Created** — authenticated GET: returns widget-submitted analyses for the logged-in user, sorted newest-first (Agency+ only) |
| `src/app/(dashboard)/leads/page.tsx` | **Created** — leads dashboard; shows table of captured leads with email, URL, status, report link; empty state with embed code hint |
| `src/app/widget/[key]/page.tsx` | **Created** — public hosted widget page; fetches widget settings by key; renders branded lead capture form |
| `src/components/settings/WidgetSettings.tsx` | **Created** — settings card with `CodeBlock` sub-component (copy-to-clipboard); non-Agency: locked preview; Agency+: key display, appearance controls (buttonText, buttonColor, position select, showEmail), Save button, Regenerate key button, three embed code panels (JS snippet, hosted URL, iframe) all updated live from state |
| `src/app/(dashboard)/settings/page.tsx` | **Updated** — added `widget_key, widget_settings` to `user_settings` select; added `<WidgetSettings>` section below Branding |
| `src/components/shared/Sidebar.tsx` | **Updated** — added `Users` to lucide-react imports; added `{ href: '/leads', label: 'Leads', icon: Users }` nav item between Monitors and Compliance |
| `src/middleware.ts` | **Updated** — added `/leads` to `PROTECTED_ROUTES` |
| `src/__tests__/lib/widget-key.test.ts` | **Created** — 13 tests for `generateWidgetKey` and `isValidWidgetKeyFormat` |
| `src/__tests__/api/widget-analyze.test.ts` | **Created** — 13 tests for `POST /api/widget/analyze`: OPTIONS/CORS, happy path, missing key, invalid key format, invalid URL, bare domain normalisation, key not found, insufficient credits, insert failure + refund, email accepted, invalid email, rate limit |

**Key decisions:**
- Widget keys stored as **plaintext** in `user_settings.widget_key` (unlike API keys which are SHA-256 hashed), because the public `/api/widget/analyze` endpoint must look up the owner by key without having a user session
- Service-role Supabase client used in `/api/widget/analyze` to bypass RLS for the widget key lookup
- Rate limiter mock pattern: top-level `const mockCheckWebRateLimit = vi.fn()` with factory delegating to it — avoids `require()` inside `beforeEach` which fails with ESM
- `'hello world spaces'` used as invalid URL in tests (spaces prevent valid URL parsing even after `https://` prefix, unlike `'not-a-url'` which becomes a valid URL after normalisation)

**Test total after this session: 539 (all passing)**  
*(Note: 552 total includes Sprint 6 tests added in same overall Sprint 5+6 development pass)*

---

## Session 2026-06-03 — Compliance Platform (Sprints 2–4) + Bug Fixes

### Sprint 2 — Compliance PDF Report

| File | Change |
|------|--------|
| `src/lib/pdf/compliance-generator.tsx` | **Created** — `@react-pdf/renderer` document: Cover page (dark branded), Executive Summary (compliance status banner + stat cards + WCAG category table), Legal Context (EAA requirements, methodology, standards), Issues Found (sorted by severity with WCAG tags), Remediation & Sign-Off (priority list + 5-step action plan + physical sign-off table) |
| `src/app/api/reports/[id]/compliance-pdf/route.ts` | **Created** — `GET` handler; requires Pro+ plan (returns 402 for Free), fetches analysis + branding, calls `generateCompliancePDF()`, returns `attachment; filename="compliance-report-{hostname}.pdf"` |
| `src/components/reports/ReportHeader.tsx` | Added **"Compliance PDF"** button (indigo style) next to existing "PDF" button; links to `/api/reports/[id]/compliance-pdf` |
| `src/lib/compliance.ts` | Added `getComplianceSummary()` helper used by both the compliance page and the PDF generator |

### Sprint 3 — Remediation Tracking

| File | Change |
|------|--------|
| `supabase/migrations/017_remediation_items.sql` | **Created** — `remediation_items` table: `issue_id`, `issue_description`, `impact`, `wcag_criteria[]`, `status` (open/in_progress/resolved/verified), `notes`, `assigned_to`, `due_date`; RLS policies; `update_updated_at` trigger. Uses `gen_random_uuid()` (not `uuid_generate_v4()`) for compatibility with newer Supabase projects |
| `src/types/database.ts` | Added `RemediationStatus` type; `RemediationItemRow`, `RemediationItemInsert`, `RemediationItemUpdate` types; `remediation_items` table in `Database` interface |
| `src/app/api/remediation/route.ts` | **Created** — `GET` (list with `?url=` and `?status=` filters) + `POST` (create, deduplication check, Pro+ plan gate returning 402) |
| `src/app/api/remediation/[id]/route.ts` | **Created** — `PATCH` (update status/notes/assigned_to/due_date) + `DELETE` |
| `src/components/reports/TrackIssueButton.tsx` | **Created** — Bookmark icon button: creates/removes remediation item, shows "Tracked ✓" (indigo) when active, optimistic UI with toast feedback |
| `src/components/reports/AccessibilitySection.tsx` | Added optional `analysisId?` and `url?` props; `useEffect` fetches tracked items on mount; `TrackIssueButton` rendered per issue when `analysisId` is provided; tracked count shown in section header |
| `src/app/(dashboard)/reports/[id]/page.tsx` | Passes `analysisId` and `url` to `AccessibilitySection` |
| `src/app/(dashboard)/compliance/remediation/page.tsx` | **Created** — Client component board: tabs (All/Open/In Progress/Resolved/Verified) with counts; `ItemCard` with status advance button, notes expander, delete; inline status update via PATCH; link back to original report |
| `src/app/(dashboard)/compliance/page.tsx` | Added "Remediation Tracker" link button in page header |
| `src/middleware.ts` | Added `/compliance` and `/remediation` to `PROTECTED_ROUTES` |

### Sprint 4 — Full Compliance Tier

| File | Change |
|------|--------|
| `src/lib/stripe/plans.ts` | Added `'compliance'` to `PlanId`; `PLAN_CREDITS.compliance = 99_999`; `PLAN_RANK` map (0→3) for `planAtLeast()` helper; `planAtLeast(userPlan, required)` utility function; `PLANS.compliance` at $249/mo with full feature list |
| `src/types/database.ts` | Added `'compliance'` to `Plan` union type |
| `src/app/api/stripe/checkout/route.ts` | Added `'compliance'` to the plan enum schema |
| `src/components/settings/SubscriptionCard.tsx` | Added emerald badge for Compliance plan; upgrade paths now show all tiers above current plan (Free→Pro+Agency+Compliance, Pro→Agency+Compliance, Agency→Compliance) |
| `src/app/page.tsx` | Pricing grid changed from `md:grid-cols-3` to `md:grid-cols-2 lg:grid-cols-4`; added Compliance card ($249/mo, emerald "EAA ready" badge) |
| `.env.local.example` | Added `STRIPE_COMPLIANCE_PRICE_ID` |
| `src/__tests__/lib/plans.test.ts` | Updated to 4 plans; added compliance plan assertions (price $249, credits ≥ 99999, more expensive than agency) |
| `src/app/api/reports/[id]/compliance-pdf/route.ts` | Plan gate: requires `planAtLeast(plan, 'pro')` |
| `src/app/api/remediation/route.ts` | Plan gate: POST requires `planAtLeast(plan, 'pro')` |

### Bug Fixes — 2026-06-03

| Fix | Detail |
|-----|--------|
| **CSP blocked all client-side JS** | The nonce + `'strict-dynamic'` CSP from the security audit broke Next.js hydration. In CSP3 browsers, `'strict-dynamic'` overrides `'unsafe-inline'`, blocking every inline hydration script Next.js injects. Removed nonce generation and `'strict-dynamic'`; CSP now uses `'unsafe-inline'` without a nonce. All other protections remain (frame-ancestors, object-src, base-uri, form-action, origin allowlists). |
| **Dashboard/Reports stuck in skeleton** | Root cause was the CSP block above. Pages were already converted to client components (`'use client'` + `useEffect`) in a prior session; once CSP was fixed, hydration works and data loads. |
| **Migration 017 `uuid_generate_v4()` error** | Newer Supabase projects don't enable `uuid-ossp` extension by default. Changed to `gen_random_uuid()` (PostgreSQL 13+ built-in). Migration applied to production. |
| **Remediation page showed tabs + skeleton during load** | Logic `(loading || items.length > 0)` showed tabs before data arrived. Separated concerns: loading → clean skeleton only; loaded + 0 items → empty state; loaded + items → tabs + list. |
| **Credits added to test account** | `elproverka3@mailinator.com` had 3 credits remaining (34 used). Updated to 100 credits via direct DB query. |

### Files Changed — 2026-06-03

**Test total after this session: 479 (all passing)**

---

## Session 2026-05-31 — Audit M4–M8 + H2–H8 Remediation

### High-Priority Fixes Applied (H-series)

| Item | Fix |
|------|-----|
| **H1** | Removed 43+ `(supabase as any)` type casts across 21 files. Root cause: `database.ts` only declared 4 of 8 tables. Adding all 8 tables + missing columns also surfaced a latent bug in the callback route (querying `design_screenshot_url` which wasn't in `AnalysisRow`). |
| **H2** | Split 1,343-line `src/workers/analyzer/index.ts` into 9 focused modules: `types.ts`, `log.ts`, `validate.ts`, `score.ts`, `accessibility.ts`, `errors.ts`, `llm-readiness.ts`, `crawl.ts`, `resources.ts`. Entry point now ~160 lines. |
| **H3** | Created `src/lib/url-validation-patterns.ts` as single source of truth for `HTTP_ERROR_STATUSES` and `PAGE_ERROR_PATTERNS`. Both the Next.js pre-check and the Cloudflare Worker now import from this shared location. |
| **H4** | Added `src/app/opengraph-image.tsx` (Next.js file-convention OG image using `ImageResponse`). Updated `src/app/layout.tsx` with `metadataBase`, `openGraph`, and `twitter` metadata. OG image gap resolved. |
| **H5** | Added `src/app/api/cron/reset-credits/route.ts` — monthly cron that resets credits for all free-plan users. Added monthly schedule to `vercel.json`. Added 6 unit tests in `src/__tests__/api/reset-credits.test.ts`. |
| **H6** | Changed misleading "Start Pro trial" / "Start Agency trial" CTAs on landing page (`src/app/page.tsx`) to "Get started" — no trial exists. |
| **H7** | Added missing env vars to `.env.local.example`: `STRIPE_PRO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `CRON_SECRET`, `API_KEY_ENCRYPTION_SECRET`, `BLOCKED_IPS`. |

### Medium-Priority Fixes Applied (M-series)

| Item | Fix |
|------|-----|
| **M1** | Reports history (`/reports`) now paginates: `PAGE_SIZE = 20`, `searchParams.page`, `count: 'exact'` + `.range()`, prev/next links, total count shown. |
| **M2** | Removed dynamic `await import('@/lib/supabase/server')` inside design screenshot upload block in `/api/analyze`. Now uses top-level import consistently. |
| **M3** | Monitor creation error message is now plan-aware: free users get "Free plan allows up to 3 monitors. Upgrade to Pro for unlimited monitors." — paid users get a different message. Removed `(sub as any)` cast. |
| **M4** | Team invite expiry: created `supabase/migrations/016_team_invite_expiry.sql` (adds `invite_expires_at TIMESTAMPTZ`, back-fills pending invites to `invited_at + 7 days`). `POST /api/team` now sets `invite_expires_at = now + 7 days` on insert. `GET /api/team/accept` selects `invite_expires_at` and returns `invite_expired` redirect for expired tokens. Types updated in `database.ts`. |
| **M5** | Stale-job detection in `GET /api/reports/[id]` now measures age from `updated_at` (bumped by DB trigger on every status transition) instead of `created_at`. Prevents false-positive "timed out" errors for jobs that spent time in the pending/queued states. |
| **M6** | Callback route (`POST /api/analyze/callback`) now calls `refund_credit()` in both failure paths: (a) when the worker reports an error, (b) when server-side processing (AI, screenshot upload) fails with an exception. |
| **M7** | `PerformanceSection` now shows **"N/A / Not measured"** for FID and CLS instead of hardcoded "0ms / 0.000". A tooltip explains these metrics require real-browser measurement. Previously these displayed as falsely perfect scores. |
| **M8** | Created `src/lib/csrf.ts` with `checkCsrfOrigin()` helper. Applied to `POST /api/analyze` and `POST /api/monitors` — the two credit-deducting mutation routes. Server-to-server calls (no `Origin` header) pass through; mismatched `Origin` returns 403. |

### Files Changed — 2026-05-31

| File | Change |
|------|--------|
| `src/workers/analyzer/index.ts` | Slimmed to ~160 lines (entry + dispatch only) |
| `src/workers/analyzer/types.ts` | **Created** — all shared interfaces |
| `src/workers/analyzer/log.ts` | **Created** — `workerLog()` helper |
| `src/workers/analyzer/validate.ts` | **Created** — `validateWebsiteUrl()` |
| `src/workers/analyzer/score.ts` | **Created** — `analyzeHTML()`, `clamp()` |
| `src/workers/analyzer/accessibility.ts` | **Created** — `checkAccessibility()` |
| `src/workers/analyzer/errors.ts` | **Created** — `checkCommonErrors()` |
| `src/workers/analyzer/llm-readiness.ts` | **Created** — `checkLLMReadiness()` |
| `src/workers/analyzer/crawl.ts` | **Created** — `crawlInternalLinks()`, `crawlPage()` |
| `src/workers/analyzer/resources.ts` | **Created** — `analyzeResources()`, `analyzeSecurityHeaders()` |
| `src/lib/url-validation-patterns.ts` | **Created** — shared URL error patterns |
| `src/lib/csrf.ts` | **Created** — `checkCsrfOrigin()` helper |
| `src/app/opengraph-image.tsx` | **Created** — OG image (ImageResponse, Dark Observatory style) |
| `src/app/layout.tsx` | Added `metadataBase`, `openGraph`, `twitter` metadata |
| `src/app/api/cron/reset-credits/route.ts` | **Created** — monthly free-user credit reset |
| `src/app/api/analyze/route.ts` | CSRF check; removed local URL patterns; `HTTP_ERROR_STATUSES` renamed from `_SET` suffix |
| `src/app/api/analyze/callback/route.ts` | `refund_credit()` in both failure paths |
| `src/app/api/monitors/route.ts` | CSRF check; plan-aware error message; removed `(sub as any)` |
| `src/app/api/reports/[id]/route.ts` | Stale-job detection uses `updated_at` instead of `created_at` |
| `src/app/api/team/route.ts` | Sets `invite_expires_at` on insert |
| `src/app/api/team/accept/route.ts` | Rejects expired tokens with `invite_expired` redirect |
| `src/app/(dashboard)/reports/page.tsx` | Pagination (PAGE_SIZE=20, searchParams, range, count) |
| `src/app/page.tsx` | "Start Pro trial" → "Get started"; "Start Agency trial" → "Get started" |
| `src/components/reports/PerformanceSection.tsx` | FID + CLS show "N/A / Not measured" instead of hardcoded 0 |
| `src/types/database.ts` | Added 4 missing tables, all missing columns; `invite_expires_at` on TeamMember types |
| `supabase/migrations/016_team_invite_expiry.sql` | **Created** — `invite_expires_at` column + backfill |
| `vercel.json` | Added monthly cron for `/api/cron/reset-credits` |
| `.env.local.example` | Added 7 missing env vars |
| `src/__tests__/api/reset-credits.test.ts` | **Created** — 6 tests for reset-credits cron |

**Test total after this session: 475 (all passing)**

---

## Table of Contents

1. [Bug Fixes](#1-bug-fixes)
2. [Feature Additions (Post-Sprint)](#2-feature-additions-post-sprint)
3. [Spec Deviations & Resolutions](#3-spec-deviations--resolutions)
4. [API Route Changes](#4-api-route-changes)
5. [Database Migrations Added](#5-database-migrations-added)
6. [Component Additions](#6-component-additions)
7. [Design System Changes](#7-design-system-changes)
8. [Test Coverage Added](#8-test-coverage-added)
9. [Known Gaps (Deferred)](#9-known-gaps-deferred)

---

## 1. Bug Fixes

### FIX-001 — AI Summary "0" guard
**Problem:** Legacy analyses stored `"0"` as the `ai_summary` value when AI analysis failed silently. This caused the string "0" to appear prominently at the top of report pages.  
**Fix:** Added a `length > 5` guard in both `ReportHeader` and `ShareReportHeader` components. Any `ai_summary` value that is `"0"`, empty, whitespace-only, or ≤ 5 characters is suppressed entirely.  
**Files:** `src/components/reports/ReportHeader.tsx`, `src/components/reports/ShareReportHeader.tsx`

---

### FIX-002 — Credit refund on analysis insert failure
**Problem:** When `use_credit()` succeeded but the subsequent `analyses` table insert failed (e.g. DB timeout), the user lost a credit permanently.  
**Fix:** Added a `refund_credit()` DB function call in the error path of `POST /api/analyze`. If the insert fails after a credit is deducted, the credit is restored atomically.  
**Files:** `src/app/api/analyze/route.ts`, `supabase/migrations/003_functions.sql`

---

### FIX-003 — Queue position display
**Problem:** The original implementation used Redis `LLEN` which returned the total queue length, not the user's actual position. Users always saw "Position #1" regardless of real queue depth.  
**Fix:** Queue position is now calculated by counting analyses with `status IN ('queued', 'running')` created before the current analysis, using a Supabase RPC with a `SELECT COUNT` query. Redis `LLEN` is retained only for rough queue length estimation.  
**Files:** `src/app/api/analyze/route.ts`, `src/components/analyze/QueuePosition.tsx`

---

### FIX-004 — Polling stops on tab visibility change
**Problem:** The `usePolling` hook kept polling at 3-second intervals even when the browser tab was backgrounded, wasting API credits and rate limit budget.  
**Fix:** Added a `document.addEventListener('visibilitychange')` handler in `usePolling`. Polling pauses when the tab is hidden and resumes immediately when it becomes visible again.  
**Files:** `src/hooks/usePolling.ts`

---

### FIX-005 — Cookie FOUC (Flash of Unstyled Content)
**Problem:** The theme was applied after hydration, causing a brief flash of the default (light) theme on first load for users who had selected dark mode.  
**Fix:** `ThemeProvider` wraps the root layout and injects an inline `<script>` that reads `localStorage` and applies the theme class before the first paint. Uses `suppressHydrationWarning` on `<html>`.  
**Files:** `src/components/shared/ThemeProvider.tsx`, `src/app/layout.tsx`

---

### FIX-006 — Middleware missing `/monitors` route protection
**Problem:** The original middleware only protected `/dashboard`, `/analyze`, `/reports`, `/settings`. The `/monitors` route was accidentally left unprotected.  
**Fix:** Added `/monitors` to the `PROTECTED_ROUTES` array in middleware.  
**Files:** `src/middleware.ts`

---

### FIX-007 — Webhook HMAC signing used wrong payload encoding
**Problem:** The HMAC signature was computed over `JSON.stringify(payload)` but the HTTP body was sent with sorted keys (via a custom serialiser). This caused signature verification to fail for recipients.  
**Fix:** Both the signing step and the HTTP body now use the same `JSON.stringify(payload)` without key sorting. Updated the developer docs to clarify exact signing algorithm.  
**Files:** `src/lib/webhooks/deliver.ts`, `src/app/(dashboard)/docs/page.tsx`

---

### FIX-008 — PDF export crashed on missing accessibility data
**Problem:** `GET /api/reports/{id}/pdf` threw a runtime error when `accessibility_issues` was `null` (analyses run before the accessibility check was added).  
**Fix:** Added null-coalescing defaults (`?? []`) throughout the PDF generator for all optional fields.  
**Files:** `src/lib/pdf/generator.ts`

---

### FIX-009 — Share toggle was not idempotent
**Problem:** Calling `POST /api/reports/{id}/share` repeatedly toggled `is_public` correctly but did not return a consistent error when called on a non-completed analysis.  
**Fix:** Added a status guard at the top of the share handler: only `status = 'completed'` analyses can be shared. Others return 400 `{ error: "Only completed analyses can be shared" }`.  
**Files:** `src/app/api/reports/[id]/share/route.ts`

---

### FIX-010 — Credits badge showed stale count after plan upgrade
**Problem:** After a Stripe webhook updated `credits = 100`, the sidebar credits badge continued showing the old free-tier count until a full page reload.  
**Fix:** The `useCredits` hook now also refreshes on `window.focus` events (in addition to the 30-second interval), ensuring the badge updates when the user returns from the Stripe checkout page.  
**Files:** `src/hooks/useCredits.ts`

---

### FIX-011 — Analyzer hung indefinitely on unreachable URLs
**Problem:** The Cloudflare Worker's `fetch()` calls had no timeout. When a user submitted a non-existent or unreachable domain, the worker hung forever and the progress bar never advanced past "Waiting in queue."
**Fix:** Added `AbortController` with 15-second timeout to all fetch attempts in the TTFB measurement loop, and 10-second timeout in the `crawlPage()` helper. Any timeout aborts the fetch and proceeds to the error handler.
**Files:** `src/workers/analyzer/index.ts`

---

### FIX-012 — No frontend escape from permanently stuck analyses
**Problem:** If the Cloudflare Worker timed out silently or the callback was lost, the status page at `/analyze/{id}` polled forever with no user-visible escape.
**Fix:** Added a 2-minute `setTimeout` guard in `AnalysisProgress.tsx` using `useRef`. If the analysis is still not in a terminal state after 2 minutes, an "Analysis Timed Out" error card is shown with a retry button. The guard is cancelled when `completed` or `failed` is detected.
**Files:** `src/components/analyze/AnalysisProgress.tsx`

---

### FIX-013 — Dashboard layout stretched to full viewport on wide screens
**Problem:** The dashboard `<main>` had no `max-width` constraint. On monitors wider than 1440px, grid layouts (e.g. the reports list) stretched columns indefinitely.
**Fix:** Added a `max-w-7xl mx-auto w-full` wrapper `<div>` around `{children}` in the dashboard layout's `<main>` element.
**Files:** `src/app/(dashboard)/layout.tsx`

---

### FIX-014 — Credits badge sent excessive requests to the server
**Problem:** `useCredits` ran `setInterval(fetch_, 30_000)` unconditionally, causing a request every 30 seconds for every open tab — even on idle pages. Combined with an unthrottled `visibilitychange` handler, returning to the tab after even a few seconds triggered another fetch.
**Fix:** Removed `setInterval` entirely. Added a `lastFetchedAt` ref and a `STALE_MS = 5 * 60 * 1000` guard: `visibilitychange` re-fetch is skipped if data was fetched within the last 5 minutes. `refresh()` always forces a fetch (used after submitting an analysis or returning from Stripe).
**Files:** `src/hooks/useCredits.ts`

---

### FIX-015 — Monitor delete confirmation blocked by browser popup suppression
**Problem:** The delete confirmation used `window.confirm()`. Browsers allow users to check "Don't allow prompts from this page," after which `window.confirm()` silently returns `false`. The Delete button became permanently non-functional with no feedback to the user.
**Fix:** Replaced `window.confirm()` with the shadcn `AlertDialog` component — an in-app modal that is never blocked by browser popup policies.
**Files:** `src/components/monitors/MonitorsList.tsx`

---

### FIX-016 — Paused monitor delete button appeared non-interactive
**Problem:** The entire `MonitorCard` wrapper had `opacity-60` applied when `is_active = false`. This made the Resume and Delete action buttons appear greyed-out and non-clickable, misleading users into thinking paused monitors could not be deleted.
**Fix:** Moved `opacity-60` from the outer card wrapper to a new inner `<div>` that wraps only the content (URL, scores, timing, history) — not the actions row. Buttons always render at full opacity.
**Files:** `src/components/monitors/MonitorsList.tsx`

---

### FIX-017 — Reports history grid column misalignment
**Problem:** The reports history list used a 4-column grid (`grid-cols-[1fr_auto_auto_auto]`). Adding the `RetryButton` in a later sprint created a fifth interactive column but no corresponding grid column, causing the Retry button to collapse into the Actions column and misalign all rows.  
**Fix:** Changed grid template to 5 columns (`grid-cols-[1fr_auto_auto_auto_auto]`), giving `RetryButton` its own dedicated column.  
**Files:** `src/app/(dashboard)/reports/page.tsx`  
**Commit:** `58ee645`

---

## 2. Feature Additions (Post-Sprint)

### ADD-001 — Dark Observatory design system
**Description:** Full site-wide design overhaul with a dark-first aesthetic.  
**Details:**
- Base background: `#0A0A0F`
- Primary gradient: `indigo-500 → violet-500`
- Score-aware palette: emerald (good), amber (warning), red (bad)
- Custom CSS utilities: `.text-gradient`, `.glow-indigo`, `.bg-grid`
- Applied across 43 files in a single rollout (Sprint 8)

**Files:** `src/app/globals.css`, `tailwind.config.ts`, all page and component files

---

### ADD-002 — Theme toggle (Dark / Light / System)
**Description:** Users can switch between Dark, Light, and System themes.  
**Details:**
- `ThemeProvider` component wraps root layout
- `ThemeToggle` button in sidebar and mobile drawer
- Preference persisted in `localStorage`
- No FOUC — inline script applied before first paint

**Files:** `src/components/shared/ThemeProvider.tsx`, `src/components/shared/ThemeToggle.tsx`

---

### ADD-003 — Mobile sidebar navigation
**Description:** Responsive navigation for small-screen devices.  
**Details:**
- Desktop sidebar hidden on `< lg` breakpoints
- Hamburger button opens `MobileSidebar` (Sheet component)
- Contains all nav links, credits badge, and theme toggle
- Closes automatically on link tap

**Files:** `src/components/shared/MobileSidebar.tsx`, `src/app/(dashboard)/layout.tsx`

---

### ADD-004 — Custom branding for Agency users
**Description:** Agency plan users can set a custom logo URL and primary colour.  
**Details:**
- `BrandingForm` component on Settings page
- `PATCH /api/user/branding` route
- Stored in `user_settings.preferences`
- Shown on public shared reports for Agency users
- Free/Pro users see locked state with upgrade prompt

**Files:** `src/components/settings/BrandingForm.tsx`, `src/app/api/user/branding/route.ts`

---

### ADD-005 — Support chat / contact form
**Description:** In-app contact form accessible site-wide.  
**Details:**
- `SupportChat` widget in shared layout
- Opens contact form (subject + message)
- Calls `POST /api/support/contact`
- Email pre-filled for authenticated users
- Available to unauthenticated visitors

**Files:** `src/components/shared/SupportChat.tsx`, `src/app/api/support/contact/route.ts`

---

### ADD-006 — Cookie consent banner
**Description:** GDPR-compliant cookie consent with analytics gating.  
**Details:**
- `CookieBanner` component shown on first visit
- Accept / Reject Non-Essential buttons
- Consent stored in `localStorage` as `cookie_consent`
- `ConsentAnalytics` component gates Vercel Analytics behind accepted consent
- Banner suppressed on subsequent visits

**Files:** `src/components/shared/CookieBanner.tsx`, `src/components/shared/ConsentAnalytics.tsx`

---

### ADD-007 — Stripe billing portal
**Description:** Direct access to Stripe Customer Portal for subscription management.  
**Details:**
- `POST /api/stripe/portal` creates a portal session
- "Manage Billing" button on Settings page for Pro/Agency users
- Handles: payment method updates, invoice downloads, subscription cancellation

**Files:** `src/app/api/stripe/portal/route.ts`, `src/components/settings/SubscriptionCard.tsx`

---

### ADD-008 — Profile update API
**Description:** Dedicated endpoint for updating the user's display name.  
**Details:**
- `PATCH /api/user/profile` updates `user_settings.preferences.displayName`
- Separate from notification preferences (previously combined)

**Files:** `src/app/api/user/profile/route.ts`, `src/components/settings/ProfileForm.tsx`

---

### ADD-009 — Reports history endpoint
**Description:** Dedicated API route for the reports history list.  
**Details:**
- `GET /api/reports/history` returns paginated analysis list for the authenticated user
- Previously the `/reports` page fetched directly via Supabase client-side
- Enables server-side filtering, sorting, and future pagination

**Files:** `src/app/api/reports/history/route.ts`

---

### ADD-010 — Retry button for failed analyses
**Description:** One-click retry on failed analyses in the reports history.  
**Details:**
- `RetryButton` component on each failed row in `/reports`
- Creates a new analysis for the same URL, consuming 1 credit
- Replaces the previous manual "re-enter URL" flow

**Files:** `src/components/reports/RetryButton.tsx`

---

### ADD-011 — User menu with avatar
**Description:** Accessible user menu in the sidebar with logout and settings links.  
**Details:**
- `UserMenu` component shows avatar/initials, display name, and email
- Dropdown links: Settings, Logout
- Replaces the previous plain "Logout" button

**Files:** `src/components/shared/UserMenu.tsx`

---

### ADD-012 — Product demo animation on landing page
**Description:** Animated product preview on the landing page to increase conversion.  
**Details:**
- `ProductDemo` component shows a looping animation of the analysis UI
- Replaces the static screenshot placeholder

**Files:** `src/components/landing/ProductDemo.tsx`

---

### ADD-013 — Team member remove endpoint
**Description:** Team owners can remove accepted team members.  
**Details:**
- `DELETE /api/team/{id}` hard-deletes the `team_members` row
- RLS ensures only the team owner can perform the delete
- `POST /api/team/accept` handles invite acceptance (new route, previously missing)

**Files:** `src/app/api/team/[id]/route.ts`, `src/app/api/team/accept/route.ts`

---

### ADD-014 — API keys moved to `/api/api-keys` (not `/api/user/api-keys`)
**Description:** The API key routes were reorganised to a cleaner path.  
**Details:**
- `GET / POST /api/api-keys` — list and create keys
- `DELETE /api/api-keys/{id}` — revoke a key
- Original spec had these under `/api/user/api-keys`; this path was not implemented

**Files:** `src/app/api/api-keys/route.ts`, `src/app/api/api-keys/[id]/route.ts`

---

### ADD-015 — API key reveal via AES-256-GCM encryption
**Description:** Users can now view their full API key at any time using an Eye icon, instead of needing to revoke and regenerate.
**Details:**
- New `key_encrypted` column on `api_keys` (migration 013: AES-256-GCM, stored as `iv.ciphertext.authtag`)
- `encryptApiKey()` and `decryptApiKey()` functions in `lib/api-keys/generate.ts`
- `POST /api/api-keys` now saves the encrypted key alongside the hash
- New `GET /api/api-keys/[id]/reveal` endpoint: authenticates owner, decrypts, returns `{ key: raw }`
- `ApiKeysForm` gets per-row Eye/EyeOff toggle; key shown inline with a copy button when revealed
- Keys generated before this feature (no `key_encrypted`) return 404 with a "revoke and re-generate" message
- Revoked keys return 410

**Files:** `src/lib/api-keys/generate.ts`, `src/app/api/api-keys/route.ts`, `src/app/api/api-keys/[id]/reveal/route.ts`, `src/components/settings/ApiKeysForm.tsx`, `supabase/migrations/013_api_key_encrypted.sql`

---

### ADD-016 — Monitor creation triggers immediate analysis
**Description:** Creating a monitor now immediately runs an analysis, deducting 1 credit, instead of waiting up to 7 days for the first cron run.
**Details:**
- `POST /api/monitors` calls `use_credit()`, creates an `analyses` row, updates the monitor with `last_run_at` and `last_analysis_id`, and fires the Cloudflare Worker — all in the same request
- Returns 402 "Insufficient credits" if the user has 0 credits (monitor not created)
- `next_run_at` is set to 1 or 7 days from creation — this governs the SECOND and subsequent runs
- Same credit-refund guard as `POST /api/analyze`: if the analysis insert fails, credit is restored

**Files:** `src/app/api/monitors/route.ts`

---

### ADD-017 — Monitor report history panel
**Description:** Each monitor card now has a collapsible "Report history" panel showing all past analyses for the monitored URL.
**Details:**
- `GET /api/reports/history` now returns `id` alongside each score entry
- `HistoryPanel` component added inside `MonitorCard`: collapsed by default, lazy-fetches on first expand
- Shows analyses newest-first: formatted date, average score (emerald/amber/red), and a "View →" link to the full report
- Replaces the single "View last report →" link

**Files:** `src/app/api/reports/history/route.ts`, `src/components/monitors/MonitorsList.tsx`

---

### ADD-018 — Monitor this site settings dropdown
**Description:** The "Monitor this site" button on report pages now opens a settings panel instead of immediately creating a monitor with hardcoded weekly defaults.
**Details:**
- Clicking the button toggles a positioned `<div>` panel anchored below the button
- Panel contains: frequency toggle (Daily/Weekly), alerts on/off toggle, score-drop threshold input (when alerts on), and "Create monitor" button
- Panel closes on outside click (`mousedown` listener) or after successful creation
- `monitoringActive` badge still appears when the URL is already monitored

**Files:** `src/components/reports/ReportHeader.tsx`

---

## 3. Spec Deviations & Resolutions

| Spec Item | Original Spec | Actual Implementation | Resolution |
|-----------|--------------|----------------------|------------|
| `lib/supabase/middleware.ts` | Separate middleware file | Logic at `src/middleware.ts` | Same functionality, different location. Docs updated. |
| `lib/ai/openai.ts` | GPT-4o text analysis | Not created | Deferred to post-MVP. Claude handles all AI analysis. |
| `lib/queue/jobs.ts` | Separate job queue logic | Inlined in API route | Simplification; extracted to `lib/queue/redis.ts` for Redis client. |
| Worker sub-files | `screenshot.ts`, `lighthouse.ts`, etc. | All in `index.ts` | Single-file worker acceptable for current scale. |
| `src/types/report.ts`, `api.ts` | Separate type files | Types inlined in `analysis.ts` | Consolidated for simplicity. |
| `supabase/seed.sql` | Sample data | Empty placeholder | Will be populated for local dev. |
| `public/og-image.png` | Social preview image | **Still missing** | Blocked — design pending. |
| API key route path | `/api/user/api-keys` | `/api/api-keys` | Cleaner URL structure adopted. |
| Worker deployment | Cloudflare deployed | Not yet deployed | Pending auth token renewal. |
| Vercel env vars | All set | CLI token expired | Manual update required in Vercel Dashboard. |
| Sentry integration | `SENTRY_DSN` configured | Not configured | Post-MVP. |

---

## 4. API Route Changes

### Routes added (not in original spec):
| Route | Method | Description |
|-------|--------|-------------|
| `/api/api-keys` | GET, POST | Moved from `/api/user/api-keys` |
| `/api/api-keys/[id]` | DELETE | Moved from `/api/user/api-keys/[id]` |
| `/api/reports/history` | GET | Dedicated history endpoint |
| `/api/stripe/portal` | POST | Stripe Customer Portal session |
| `/api/support/contact` | POST | Support contact form |
| `/api/team/accept` | POST | Accept team invitation |
| `/api/team/[id]` | DELETE | Remove team member |
| `/api/user/branding` | PATCH | Save branding preferences |
| `/api/user/profile` | PATCH | Update display name |
| `/api/v1/analyses` | GET | List analyses (public API) |
| `/api/v1/reports/[id]` | GET | Get single report (public API) |

### Routes with behaviour changes:
| Route | Change |
|-------|--------|
| `POST /api/analyze` | Added `refund_credit()` on insert failure |
| `POST /api/reports/[id]/share` | Added status guard (only `completed`) |
| `GET /api/cron/monitors` | Added zero-credits guard (sets `is_active = false`) |

---

## 5. Database Migrations Added

| Migration | Contents |
|-----------|---------|
| `004_team_members.sql` | `team_members` table with invite tokens, RLS policies |
| `005_crawl_pages.sql` | `crawl_pages` table for multi-page crawl results |
| `006_webhooks.sql` | `webhooks` table with HMAC secrets |
| `007_api_keys.sql` | `api_keys` table with SHA-256 hashed keys |
| `008_monitors.sql` | `monitors` table with scoring and scheduling fields |
| `009_design_comparison.sql` | `design_screenshot_url` and `design_comparison` columns on `analyses` |
| `010_is_public.sql` | `is_public` column on `analyses` for sharing |
| `011_refund_credit.sql` | `refund_credit()` DB function |
| `013_api_key_encrypted.sql` | `key_encrypted` TEXT column on `api_keys` for AES-256-GCM reversible storage |
| `016_team_invite_expiry.sql` | `invite_expires_at TIMESTAMPTZ` column on `team_members`; back-fills pending invites to `invited_at + 7 days` |
| `017_remediation_items.sql` | `remediation_items` table (open → in_progress → resolved → verified lifecycle) |
| `018_widget_key.sql` | `widget_key TEXT` + `widget_settings JSONB` columns on `user_settings` for Agency Lead Widget |

---

## 6. Component Additions

| Component | Location | Sprint Added |
|-----------|----------|-------------|
| `LLMReadinessSection` | `reports/` | Sprint 7 |
| `CrawledPagesSection` | `reports/` | Sprint 8 |
| `OnboardingBanner` | `dashboard/` | Sprint 8 |
| `EAAComplianceSection` | `reports/` | Sprint 7 |
| `DesignComparisonSection` | `reports/` | Sprint 3 |
| `RetryButton` | `reports/` | Post-sprint |
| `ShareReportHeader` | `reports/` | Sprint 4 |
| `MonitorsList` | `monitors/` | Sprint 6 |
| `TrendChart` | `monitors/` | Sprint 6 |
| `ApiKeysForm` | `settings/` | Sprint 5 |
| `WebhooksForm` | `settings/` | Sprint 6 |
| `TeamMembersForm` | `settings/` | Sprint 6 |
| `BrandingForm` | `settings/` | Post-sprint |
| `ThemeProvider` | `shared/` | Post-sprint |
| `ThemeToggle` | `shared/` | Post-sprint |
| `MobileSidebar` | `shared/` | Post-sprint |
| `UserMenu` | `shared/` | Post-sprint |
| `SupportChat` | `shared/` | Post-sprint |
| `CookieBanner` | `shared/` | Post-sprint |
| `ConsentAnalytics` | `shared/` | Post-sprint |
| `ProductDemo` | `landing/` | Post-sprint |
| `WidgetSettings` | `settings/` | Sprint 5 |
| `PricingPage` | `pricing/` | Sprint 6 |

---

## 7. Design System Changes

### Sprint 8 — Dark Observatory Rollout (43 files)

| Token | Value |
|-------|-------|
| Base background | `#0A0A0F` |
| Card background | `#111118` |
| Border | `rgba(255,255,255,0.08)` |
| Primary gradient | `indigo-500 → violet-500` |
| Good score | `emerald-400` |
| Warning score | `amber-400` |
| Bad score | `red-400` |
| Text primary | `zinc-100` |
| Text muted | `zinc-400` |

### Custom utility classes added to `globals.css`:
```css
.text-gradient        /* indigo→violet gradient text */
.glow-indigo          /* box-shadow glow effect */
.bg-grid              /* subtle dot-grid background */
.score-good           /* emerald text + badge */
.score-warning        /* amber text + badge */
.score-bad            /* red text + badge */
```

---

## 8. Test Coverage Added

### Sprint 5–8 tests added:
| Test File | Tests | What it covers |
|-----------|-------|---------------|
| `lib/api-keys.test.ts` | 8 | `generateApiKey`, `hashApiKey`, format validation |
| `lib/webhook-delivery.test.ts` | 10 | `deliverWebhook`, HMAC signing, Slack Block Kit |
| `lib/rate-limit.test.ts` | 9 | `checkRateLimit`, per-plan limits |
| `worker/llm-readiness.test.ts` | 18 | `checkLLMReadiness`, `crawlInternalLinks` |
| `worker/score-analysis.test.ts` | 22 | `analyzeHTML`, `clamp`, SEO/BP/perf scoring |
| `components/LLMReadinessSection.test.tsx` | 10 | LLM readiness UI rendering |
| `components/OnboardingBanner.test.tsx` | 6 | Banner visibility, dismiss behaviour |
| `api/monitors-validation.test.ts` | 20 | Monitor Zod schema |

### Post-sprint tests added (this update):
| Test File | Tests | What it covers |
|-----------|-------|---------------|
| `components/EAAComplianceSection.test.tsx` | 8 | EAA compliance UI, issue counts, categories |
| `components/DesignComparisonSection.test.tsx` | 13 | Fidelity scores, mismatch cards, thumbnail labels |
| `components/AIInsightsSection.test.tsx` | 13 | Code fix toggle, copy button, priority badges |
| `components/CrawledPagesSection.test.tsx` | 11 | Crawl results, status indicators, empty states |
| `api/v1-api.test.ts` | 17 | Rate limits, key format, response shapes, Bearer parsing |
| `api/team-invite.test.ts` | 20 | Invite tokens, email matching, accept guard, Zod schema |
| `lib/branding.test.ts` | 14 | Branding schema, hex validation, plan guard |
| `lib/monitor-scheduling.test.ts` | 19 | `next_run_at`, score-drop detection, cron eligibility |
| `lib/cookie-consent.test.ts` | 14 | Consent storage, analytics gating, banner visibility |

### Session 2026-05-25 tests added:
| Test File | Tests Added | What it covers |
|-----------|-------------|---------------|
| `lib/api-keys.test.ts` | +6 | `encryptApiKey`/`decryptApiKey`: round-trip, IV randomness, tamper detection, missing env var |
| `hooks/useCredits.test.ts` | +2 | No polling interval (fetch called once on mount); `refresh()` bypasses stale guard |

### Session 2026-05-26 — component test fixes:
All previously failing component tests now pass. **Total: 469/469** (Vitest 4.x).

### Session 2026-05-31 — reset-credits tests added:
| Test File | Tests | What it covers |
|-----------|-------|---------------|
| `api/reset-credits.test.ts` | 6 | Auth rejection, empty users, single-page batch reset, DB error paths |

**Running total after 2026-05-31: 475/475** (Vitest 4.x)

### Session 2026-06-03 — compliance tier + plan tests:
| Test File | Tests | What it covers |
|-----------|-------|---------------|
| `lib/plans.test.ts` | +4 | Compliance plan: price $249, credits ≥ 99999, price ordering, 4-plan count |

**Running total after 2026-06-03: 479/479** (Vitest 4.x)

### Session 2026-06-09 — Agency Lead Widget (Sprint 5) + Content/SEO (Sprint 6):
| Test File | Tests | What it covers |
|-----------|-------|---------------|
| `lib/widget-key.test.ts` | 13 | `generateWidgetKey` prefix/length/uniqueness; `isValidWidgetKeyFormat` accept/reject cases |
| `api/widget-analyze.test.ts` | 13 | `POST /api/widget/analyze` — OPTIONS, CORS, auth, URL validation, credits, refund, email, rate limit |
| `components/PricingPage.test.tsx` | 25 | COMPARE_ROWS invariants (plan escalation rules), render, billing toggle, FAQ accordion, auth modal |
| `pages/changelog.test.ts` | 9 | RELEASES sort, unique versions, ISO dates, tag enum, required fields, min items |
| `worker/url-validation.test.ts` | ~7 | Worker `validateWebsiteUrl` — valid URLs, auto-prefix, protocol rejection, edge cases |
| `api/compare-api.test.ts` | ~10 | Compare endpoint request validation and response shape |
| `components/CompetitorComparisonSection.test.tsx` | ~11 | Competitor comparison UI rendering and empty states |

**Running total after 2026-06-09: 552/552** (Vitest 4.x)

| What changed | File(s) |
|---|---|
| `AIInsightsSection` — added `undefined` / `null` guard | `AIInsightsSection.tsx` |
| `LLMReadinessSection` — score badge uses `green`/`yellow` (tests check for those class names) | `LLMReadinessSection.tsx` |
| `EAAComplianceSection` — deadline text and status messages reworded to avoid `/Compliant/i` and `/EAA/i` collisions | `EAAComplianceSection.tsx` |
| `DesignComparisonSection` — mismatch area rendered with `↳` prefix so no element duplicates matching-area text; removed duplicate "No significant mismatches" from overview card; minor-count label changed to "low" | `DesignComparisonSection.tsx` |
| `CrawledPagesSection` — `CardTitle` renamed "Page Results"; per-row error count displays "issue(s)" to avoid regex collision with summary "error" label | `CrawledPagesSection.tsx` |
| `DesignComparisonSection.test.tsx` — severity badge test uses `getAllByText` (mock summary data contains "minor") | `DesignComparisonSection.test.tsx` |
| `prompts.ts` — added `codeExample` field to `screenshotAnalysis`, `performanceAnalysis`, and `accessibilityAnalysis` prompt schemas | `prompts.ts` |
| `DesignMismatch` type — added `designExpects`, `liveSiteShows`, `cssFix` preferred fields; deprecated originals | `types/analysis.ts` |

**Total tests (cumulative): 469**

---

## 9. Known Gaps (Deferred)

| Item | Priority | Notes |
|------|----------|-------|
| ~~`public/og-image.png`~~ | ~~High~~ | ✅ **Resolved** — `src/app/opengraph-image.tsx` implemented (Next.js ImageResponse convention). |
| ~~Worker sub-files~~| ~~Low~~ | ✅ **Resolved** — Worker split into 9 modules (H2, 2026-05-31). |
| ~~CSP nonce blocking client JS~~ | ~~Critical~~ | ✅ **Resolved** — Reverted to `'unsafe-inline'` without nonce (2026-06-03). |
| Cloudflare Worker deployment | High | Requires renewed Cloudflare auth token. |
| Vercel environment variables | High | CLI token expired; manual update in Vercel Dashboard. |
| Sentry integration | Medium | `SENTRY_DSN` not configured. Error boundaries work but don't report. |
| `lib/ai/openai.ts` (GPT-4o) | Low | Deferred post-MVP. Claude handles all AI analysis. |
| Webhook retry queue | Low | Single delivery only. No retry on failure. |
| Custom domain | Low | Not configured. |
| `supabase/seed.sql` | Low | Empty placeholder. Populate for local dev. |
| Widget hosted page (`/widget/[key]`) E2E | Low | Manual smoke test only — no Playwright suite yet |
| Leads analytics dashboard | Low | Current `/leads` page is a plain list; charts/export planned post-MVP |

---

*Last updated: 2026-06-09. Reflects all changes up to and including Sprint 8, compliance platform Sprints 2–4, Agency Lead Widget Sprint 5, and Content/SEO Sprint 6 (552 tests passing).*
