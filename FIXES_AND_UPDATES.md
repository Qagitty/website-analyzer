# Website Analyzer — Fixes & Updates Log

**Document created:** 2026-05-14  
**Covers:** All changes made across Sprints 1–8 and post-sprint additions relative to the original spec.

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

**Total tests (cumulative): ~285 (pre-update) + ~129 (post-sprint) + ~8 (2026-05-25 session) = ~422 tests**

---

## 9. Known Gaps (Deferred)

| Item | Priority | Notes |
|------|----------|-------|
| `public/og-image.png` | High | Needed for social media previews. Design not finalised. |
| Cloudflare Worker deployment | High | Requires renewed Cloudflare auth token. |
| Vercel environment variables | High | CLI token expired; manual update in Vercel Dashboard. |
| Sentry integration | Medium | `SENTRY_DSN` not configured. Error boundaries work but don't report. |
| `lib/ai/openai.ts` (GPT-4o) | Low | Deferred post-MVP. Claude handles all AI analysis. |
| Webhook retry queue | Low | Single delivery only. No retry on failure. |
| Custom domain | Low | Not configured. |
| `supabase/seed.sql` | Low | Empty placeholder. Populate for local dev. |
| Worker sub-files | Low | All logic in `index.ts`. Refactor when complexity warrants. |

---

*This document was generated on 2026-05-14 and reflects all changes up to and including Sprint 8 plus post-sprint additions.*
