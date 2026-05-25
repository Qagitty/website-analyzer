# Website Analyzer — QA Specification

**Version:** 4.0  
**Last updated:** 2026-05-25  
**Coverage:** Sprints 1–8 + all post-sprint features  
**Test runner:** Vitest v4 + @testing-library/react + jsdom

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [URL Analysis](#2-url-analysis)
3. [Report Viewing](#3-report-viewing)
4. [Sharing](#4-sharing)
5. [Credits & Billing](#5-credits--billing)
6. [Monitors](#6-monitors)
7. [Reports History](#7-reports-history)
8. [Settings — Profile & Notifications](#8-settings--profile--notifications)
9. [Settings — Branding](#9-settings--branding)
10. [PDF Export](#10-pdf-export)
11. [API Keys](#11-api-keys)
12. [Webhooks](#12-webhooks)
13. [Team Members](#13-team-members)
14. [LLM Readiness](#14-llm-readiness)
15. [EAA Compliance](#15-eaa-compliance)
16. [Crawled Pages](#16-crawled-pages)
17. [Onboarding Banner](#17-onboarding-banner)
18. [Public V1 API](#18-public-v1-api)
19. [Theme Toggle](#19-theme-toggle)
20. [Support Contact](#20-support-contact)
21. [Cookie Consent](#21-cookie-consent)
22. [Mobile Navigation](#22-mobile-navigation)
23. [Worker — Score Analysis](#23-worker--score-analysis)
24. [Worker — LLM Readiness Checks](#24-worker--llm-readiness-checks)
25. [Security Headers & Middleware](#25-security-headers--middleware)
26. [End-to-End Smoke Tests](#26-end-to-end-smoke-tests)

---

## 1. Authentication

### TC-AUTH-001 — Sign up with email
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Navigate to `/signup` | Form renders with email + password fields |
| 2 | Submit empty form | Inline errors on both fields |
| 3 | Enter invalid email `notanemail` | "Invalid email" error shown |
| 4 | Enter password `short` (< 8 chars) | "Password must be at least 8 characters" |
| 5 | Enter valid email + 8+ char password | Account created, redirect to `/dashboard` |
| 6 | `user_settings` row in DB | `credits = 3`, `plan = 'free'` |
| 7 | Repeat same email | Error: "User already registered" |

### TC-AUTH-002 — Google OAuth
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "Continue with Google" on `/login` | Redirect to Google consent screen |
| 2 | Approve consent | Redirect to `/auth/callback` |
| 3 | Callback route runs | Session cookie set, redirect to `/dashboard` |
| 4 | Visit `/login` while logged in | Redirect to `/dashboard` |

### TC-AUTH-003 — Log in / Log out
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Submit `/login` with wrong password | "Invalid login credentials" |
| 2 | Submit with correct credentials | Redirect to `/dashboard` |
| 3 | Reload page | Session persists |
| 4 | Click logout (user menu) | Session cleared |
| 5 | Visit `/dashboard` after logout | Redirect to `/login` |

### TC-AUTH-004 — Route protection
| # | Route | Expected Result |
|---|-------|----------------|
| 1 | `/dashboard` (unauthenticated) | Redirect to `/login` |
| 2 | `/analyze` (unauthenticated) | Redirect to `/login` |
| 3 | `/reports` (unauthenticated) | Redirect to `/login` |
| 4 | `/settings` (unauthenticated) | Redirect to `/login` |
| 5 | `/monitors` (unauthenticated) | Redirect to `/login` |
| 6 | `/share/{id}` (unauthenticated) | Page renders (public) |
| 7 | `/` (unauthenticated) | Landing page renders |

---

## 2. URL Analysis

### TC-ANALYZE-001 — URL validation
| # | Input | Expected Result |
|---|-------|----------------|
| 1 | `https://example.com` | Valid — accepted |
| 2 | `http://example.com` | Valid — accepted |
| 3 | `https://sub.domain.com/path?q=1` | Valid — accepted |
| 4 | `example.com` | Error: "Invalid URL" |
| 5 | `ftp://example.com` | Error: protocol error |
| 6 | `javascript:alert(1)` | Error: rejected |
| 7 | `` (empty) | Error: required |
| 8 | `null` / missing field | 400 from API |

### TC-ANALYZE-002 — Credit deduction
| # | Step | Expected Result |
|---|------|----------------|
| 1 | User has 0 credits | Analyze button disabled; 402 if called directly |
| 2 | User has 1 credit; submit valid URL | Credit atomically decremented to 0 |
| 3 | DB `use_credit()` fails | 402 returned; no analysis created |
| 4 | Analysis insert fails after credit deducted | `refund_credit()` called; credit restored |

### TC-ANALYZE-003 — Analysis lifecycle
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Submit valid URL | 202 with `analysisId` + `status: 'queued'` |
| 2 | Navigate to `/analyze/{id}` | Progress bar visible, status badge shown |
| 3 | Status = `queued` | Queue position displayed (e.g. "Position #1") |
| 4 | Status = `running` | "Analysing your website…" message |
| 5 | Status = `completed` | Progress bar 100%, auto-redirect after 1.5s |
| 6 | Status = `failed` | Error message shown, polling stops |
| 7 | Analysis not completed/failed within 2 min | "Analysis Timed Out" card shown; polling stops; retry button visible |

### TC-ANALYZE-004 — Design screenshot upload
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "+ Compare with your design" | Upload zone expands |
| 2 | Drop valid PNG | Thumbnail preview shown |
| 3 | Drop JPEG over 10 MB | Error: "Image must be under 10 MB" |
| 4 | Drop PDF | Error: "Please upload a PNG, JPG, or WebP image" |
| 5 | Click × to remove | Preview cleared, drop zone restored |
| 6 | Submit with design attached | `design_screenshot_url` saved on analysis row |

---

## 3. Report Viewing

### TC-REPORT-001 — Access control
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Owner visits `/reports/{id}` | Full report rendered |
| 2 | Different user visits same URL | 404 (RLS enforced) |
| 3 | Unauthenticated user visits | Redirect to `/login` |
| 4 | Non-existent ID | 404 |

### TC-REPORT-002 — AI summary guard
| # | `ai_summary` value | Rendered? |
|---|-------------------|-----------|
| 1 | `"0"` | No |
| 2 | `""` | No |
| 3 | `"   "` | No |
| 4 | `"short"` (≤ 5 chars) | No |
| 5 | `"123456"` (6 chars) | Yes |
| 6 | Full sentence | Yes |

### TC-REPORT-003 — Performance section
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Score ≥ 90 | Score card text = green |
| 2 | Score 50–89 | Score card text = yellow |
| 3 | Score < 50 | Score card text = red |
| 4 | LCP < 2500 ms | "✓ Good" badge |
| 5 | LCP ≥ 2500 ms | "✗ Needs work" badge |
| 6 | CLS < 0.1 | "✓ Good" badge |
| 7 | Radar chart | Renders with all 4 metrics |

### TC-REPORT-004 — AI Insights code fix toggle
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Insight has `codeExample` | "▼ Show code fix" toggle visible |
| 2 | Insight has no `codeExample` | Toggle not rendered |
| 3 | Click "▼ Show code fix" | Code block expands (dark bg) |
| 4 | Click Copy in code block | Clipboard updated; button shows "✓ Copied" |
| 5 | After 2 seconds | Copy button reverts to "Copy" |
| 6 | Click "▲ Hide code" | Code block collapses |

### TC-REPORT-005 — Design comparison section
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Analysis without design upload | Design Comparison section hidden |
| 2 | Analysis with design upload | Section renders with fidelity score |
| 3 | Fidelity ≥ 80 | Green progress bar, "High fidelity" label |
| 4 | Fidelity 60–79 | Yellow progress bar, "Moderate fidelity" |
| 5 | Fidelity < 60 | Red progress bar, "Low fidelity" |
| 6 | No mismatches | "✓ No significant mismatches detected" |
| 7 | Mismatch present | Card shows "Design expects" + "Live site shows" + CSS fix |

---

## 4. Sharing

### TC-SHARE-001 — Toggle share
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "Share" on completed report | `is_public = true`; share URL in clipboard |
| 2 | Toast shown | "Link copied to clipboard!" |
| 3 | Button state | Turns blue, shows "Shared" |
| 4 | Green banner visible | Shows full public URL as link |
| 5 | Click "Shared" again | `is_public = false`; toast "Report is now private" |
| 6 | Button reverts | Shows "Share" (outline) |
| 7 | Green banner disappears | Not visible |
| 8 | Visit `/share/{id}` after revoke | 404 |

### TC-SHARE-002 — Public report page
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Visit `/share/{id}` (public report) | Full report rendered without auth |
| 2 | Header | "WebAnalyzer" logo + "Get your free report →" |
| 3 | No Share / Export PDF buttons | Not rendered |
| 4 | CTA footer | "Want a report like this?" with `/signup` link |
| 5 | Visit `/share/{nonexistent}` | 404 |
| 6 | Visit `/share/{private-id}` | 404 |

---

## 5. Credits & Billing

### TC-BILLING-001 — Credits display
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Sidebar credits badge | Shows correct count |
| 2 | After analysis submitted | Count decrements by 1 |
| 3 | Credits = 0 | Badge turns red/warning colour |
| 4 | Tab regains focus after 5+ min stale period | Count silently updated, no spinner |
| 5 | Tab regains focus within 5 min of last fetch | No re-fetch — stale guard prevents it |
| 6 | Credits = 0 (API path) | 402 if called directly |

### TC-BILLING-002 — Stripe checkout
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "Upgrade to Pro" | `POST /api/stripe/checkout` called |
| 2 | Redirect | Stripe-hosted checkout page |
| 3 | Successful payment webhook | `plan = 'pro'`, `credits = 100` |
| 4 | Agency plan payment | `plan = 'agency'`, `credits = 9999` |
| 5 | Failed payment | User returned, no plan change |

### TC-BILLING-003 — Stripe portal
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "Manage Billing" (Pro/Agency) | `POST /api/stripe/portal` called |
| 2 | Redirect | Stripe Customer Portal |
| 3 | Cancel subscription in portal | `cancel_at_period_end = true` |
| 4 | Free user | "Manage Billing" button not shown |

---

## 6. Monitors

### TC-MONITOR-001 — Create monitor
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Submit form with valid HTTPS URL | Monitor created, card appears in list |
| 2 | `next_run_at` | Set to now + 7 days (weekly default) — governs second run; first runs immediately |
| 3 | Set frequency = Daily | `next_run_at` = now + 24 h |
| 4 | Invalid URL | Validation error, no API call |
| 5 | threshold = 0 | Validation error |
| 6 | threshold = 51 | Validation error |
| 7 | threshold = 5.5 (float) | Validation error |
| 8 | Free user creates 4th monitor | 402: "Free plan allows up to 3 monitors" |
| 9 | Monitor created successfully | 1 credit immediately deducted |
| 10 | Monitor created successfully | Analysis dispatched to Worker; monitor shows `last_run_at` |
| 11 | User has 0 credits when creating monitor | 402 "Insufficient credits" — monitor not created |

### TC-MONITOR-002 — Monitor card display
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Active monitor | Green "Active" badge |
| 2 | Paused monitor | Gray "Paused" badge |
| 3 | No runs yet | "Never run yet" label |
| 4 | Click "Report history" chevron | Panel expands, history fetched from /api/reports/history |
| 5 | History panel: reports exist | Shows entries newest-first: date, avg score (colour-coded), "View →" link |
| 6 | History panel: no completed reports | "No completed reports yet." message |
| 7 | Monitor is paused | URL/scores/timing section dimmed; Resume and Delete buttons at full opacity |
| 8 | Multiple runs | Trend chart visible |

### TC-MONITOR-003 — Pause / Resume / Delete
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "Pause" | `PATCH /api/monitors/{id}` with `is_active: false` |
| 2 | Card badge | Switches to "Paused" |
| 3 | Cron runs | Paused monitor skipped |
| 4 | Click "Resume" | `is_active: true`, badge back to "Active" |
| 5 | Click "Delete" | AlertDialog confirmation opens |
| 6 | Confirm in dialog | `DELETE /api/monitors/{id}`, card removed |
| 7 | Cancel in dialog | Dialog dismissed, monitor unchanged |
| 8 | Toast on delete | "Monitor deleted" |

### TC-MONITOR-004 — Cron execution
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Call `GET /api/cron/monitors` without auth | 401 |
| 2 | Call with `Authorization: Bearer {CRON_SECRET}` | 200 |
| 3 | Due monitor with credits | Analysis dispatched, `next_run_at` advanced |
| 4 | Due monitor with 0 credits | Monitor set `is_active = false`, no analysis |
| 5 | Score drop ≥ threshold | Email sent (if `RESEND_API_KEY` configured) |
| 6 | `RESEND_API_KEY` missing | Cron completes, email silently skipped |

### TC-MONITOR-005 — Monitor this site dropdown (from report page)
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "Monitor this site" on a report | Settings dropdown panel opens (not immediate creation) |
| 2 | Frequency toggle | Daily / Weekly options, Weekly pre-selected |
| 3 | Alerts toggle | Toggles Bell on/off |
| 4 | Threshold input (alerts on) | Shown; accepts 1–50 |
| 5 | Threshold input (alerts off) | Hidden |
| 6 | Click "Create monitor" | Monitor created with chosen settings; dropdown closes |
| 7 | Click outside dropdown | Dropdown closes without creating |
| 8 | Monitor already exists for URL | "Monitoring active" badge shown instead of button |

---

## 7. Reports History

### TC-HISTORY-001 — List and actions
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Visit `/reports` | All analyses listed, newest first |
| 2 | Completed analysis row | Link to `/reports/{id}` |
| 3 | Failed analysis row | "Retry" button visible |
| 4 | Click Retry | New analysis created for same URL |
| 5 | No analyses | Empty state CTA shown |
| 6 | `GET /api/reports/history` | Returns paginated analysis list |

---

## 8. Settings — Profile & Notifications

### TC-SETTINGS-001 — Profile update
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Change display name, click Save | `PATCH /api/user/profile` called |
| 2 | Success | Toast "Profile updated" |
| 3 | API error | Error toast shown |

### TC-SETTINGS-002 — Notification toggles
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Toggle "Email on complete" off | `notifications.email_on_complete = false` in DB |
| 2 | Toggle "Email on fail" off | `notifications.email_on_fail = false` in DB |
| 3 | Save | Toast "Preferences saved" |

---

## 9. Settings — Branding

### TC-BRANDING-001 — Agency branding
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Agency user visits Settings | Branding section visible |
| 2 | Free/Pro user visits Settings | Branding section locked ("Upgrade to Agency") |
| 3 | Enter logo URL + colour, Save | `PATCH /api/user/branding` called |
| 4 | Visit `/share/{id}` for Agency user's report | Custom logo shown |

---

## 10. PDF Export

### TC-PDF-001 — Download
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "Export PDF" | GET `/api/reports/{id}/pdf` triggered |
| 2 | Response | `Content-Disposition: attachment; filename="report-{id}.pdf"` |
| 3 | PDF content | Contains URL, date, Lighthouse scores, AI insights |
| 4 | Non-existent ID | 404 |
| 5 | Different user's ID | 404 (RLS) |

---

## 11. API Keys

### TC-APIKEYS-001 — Key generation
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Agency user clicks "Generate API Key" | `POST /api/api-keys` |
| 2 | Key format | `wa_live_` + 32 hex chars |
| 3 | Key displayed | Shown in green post-generation banner |
| 4 | Copy button | Clipboard updated |
| 5 | Refresh page | Only prefix shown in row (full key hidden) |
| 5a | Click Eye icon on key row | GET `/api/api-keys/{id}/reveal` called; full key shown inline |
| 5b | Click EyeOff icon | Key hidden again (client-side) |
| 5c | Copy button (key revealed) | Clipboard updated with full key |
| 6 | DB | Key stored as SHA-256 hash + AES-256-GCM encrypted ciphertext |
| 7 | Free/Pro user | Locked state, "Upgrade to Agency" shown |

### TC-APIKEYS-002 — Key authentication
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Valid key in `Authorization: Bearer` | 202 with `analysisId` |
| 2 | Invalid key | 401 `{ "error": "Invalid API key" }` |
| 3 | Missing header | 401 |
| 4 | Agency plan: 300 req/hr | 300th request succeeds |
| 5 | Agency plan: 301st req/hr | 429 `{ "error": "Rate limit exceeded" }` |
| 6 | Pro plan: 61st req/hr | 429 |
| 7 | Successful request | `last_used_at` and `use_count` updated on key row |

### TC-APIKEYS-003 — Key revocation
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click "Revoke" | `DELETE /api/api-keys/{id}` |
| 2 | UI | Row removed immediately |
| 3 | API call with revoked key | 401 |

### TC-APIKEYS-004 — Key reveal
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Click Eye icon on active key | GET `/api/api-keys/{id}/reveal`; full key shown inline |
| 2 | Full key format | `wa_live_` + 32 hex chars |
| 3 | Click Copy next to revealed key | Clipboard updated |
| 4 | Click EyeOff | Key hidden, prefix shown again |
| 5 | Reveal a revoked key | 410 error; key not revealed |
| 6 | Key generated before reveal feature | 404 with "revoke and re-generate" message |
| 7 | Different user calls reveal endpoint | 404 (owner-only) |

---

## 12. Webhooks

### TC-WEBHOOKS-001 — Registration and validation
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Add valid `https://` webhook URL | Webhook created |
| 2 | Add `http://` URL | Validation error |
| 3 | Add 6th webhook | Error: "Maximum 5 webhooks" |
| 4 | Secret | Shown once in amber box after creation |
| 5 | Click Delete | `DELETE /api/webhooks/{id}`, row removed |

### TC-WEBHOOKS-002 — Payload delivery
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Analysis completes | Webhook called within 30s |
| 2 | Request headers | `X-WebsiteAnalyzer-Signature: sha256=<hmac>` present |
| 3 | HMAC verification | `HMAC-SHA256(secret, JSON.stringify(payload))` matches header |
| 4 | Payload structure | `{ event, analysisId, url, scores, completedAt }` |
| 5 | Slack URL (`hooks.slack.com`) | Payload sent in Block Kit format |
| 6 | Non-Slack URL | Standard JSON payload |

---

## 13. Team Members

### TC-TEAM-001 — Invite flow
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Enter email + role, click "Send Invite" | `POST /api/team` |
| 2 | DB | `team_members` row with `status = 'pending'` |
| 3 | Invitation email | Subject: "You've been invited to Website Analyzer" |
| 4 | Email body | Contains `/invite/{token}` link |
| 5 | Team list | Shows email, role badge, "Pending" status |

### TC-TEAM-002 — Accept and remove
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Visit `/invite/{token}` (authenticated) | `POST /api/team/accept` |
| 2 | DB | `status = 'active'`, `accepted_at` set |
| 3 | Invalid token | Error: "invitation invalid or expired" |
| 4 | Wrong email logged in | Error: "sent to a different email address" |
| 5 | Click Remove (owner) | `DELETE /api/team/{id}`, member removed |

---

## 14. LLM Readiness

### TC-LLM-001 — Score and checks
| # | Step | Expected Result |
|---|------|----------------|
| 1 | All 8 checks pass | Score = 100, all green ✓ |
| 2 | 0 checks pass | Score ≤ 13 (only `allowsAIBots` defaults true) |
| 3 | Score ≥ 80 | Green colour |
| 4 | Score 50–79 | Amber colour |
| 5 | Score < 50 | Red colour |
| 6 | `robots.txt` has `noindex` | `allowsAIBots = false` |
| 7 | JSON-LD `@context` in HTML | `hasStructuredData = true` |
| 8 | `itemscope` attribute | `hasStructuredData = true` |
| 9 | No `og:description` | `hasOpenGraph = false` |
| 10 | Failed check | "How to improve" hint visible |
| 11 | `llmReadiness` undefined | Section returns null / not rendered |

---

## 15. EAA Compliance

### TC-EAA-001 — Compliance display
| # | Step | Expected Result |
|---|------|----------------|
| 1 | No WCAG violations | "Compliant" (green) |
| 2 | Non-critical violations only | "Partially Compliant" (amber) |
| 3 | Critical violations present | "Non-Compliant" (red) |
| 4 | Three categories shown | WCAG 2.1 AA, Perceivable, Operable |
| 5 | Legal notice callout | EAA deadline (June 2025) shown |
| 6 | WCAG criterion tags | `wcag2aa`, `wcag143` etc. shown per issue |

---

## 16. Crawled Pages

### TC-CRAWL-001 — Crawl results display
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Single page analysed | Crawled Pages section hidden |
| 2 | Multiple pages crawled | Section visible with summary card |
| 3 | Summary card | Total pages, avg performance, error count |
| 4 | Status 200 | Green indicator |
| 5 | Status 4xx/5xx | Red indicator |
| 6 | Status 3xx | Amber indicator |
| 7 | Pages sorted | Errors first |
| 8 | External links | Not included in crawl results |
| 9 | Max crawled pages | ≤ 10 (or ≤ 4 in worker inline cap) |

---

## 17. Onboarding Banner

### TC-ONBOARD-001 — Display logic
| # | Step | Expected Result |
|---|------|----------------|
| 1 | New user, 0 analyses | Banner shown |
| 2 | User with 1+ analyses | Banner not shown |
| 3 | Click × to dismiss | Banner disappears, does not return on reload |
| 4 | "Analyze a site" link | Points to `/analyze` |
| 5 | "Review your report" link | Points to `/reports` |
| 6 | "Set up monitoring" link | Points to `/monitors` |

---

## 18. Public V1 API

### TC-V1API-001 — Analyze endpoint
| # | Step | Expected Result |
|---|------|----------------|
| 1 | `POST /api/v1/analyze` with valid key + URL | 202 `{ analysisId, status }` |
| 2 | Missing `Authorization` header | 401 |
| 3 | Invalid key | 401 |
| 4 | Invalid URL body | 400 |
| 5 | Rate limit exceeded | 429 |

### TC-V1API-002 — Analyses list and report fetch
| # | Step | Expected Result |
|---|------|----------------|
| 1 | `GET /api/v1/analyses` with valid key | Array of owner's analyses |
| 2 | `GET /api/v1/reports/{id}` (owner) | Full analysis object |
| 3 | `GET /api/v1/reports/{id}` (other user's key) | 404 |
| 4 | Invalid key on either endpoint | 401 |

---

## 19. Theme Toggle

### TC-THEME-001 — Dark / light mode
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Default theme | Dark Observatory style applied |
| 2 | Click theme toggle | Theme switches |
| 3 | Reload page | Selected theme persists (localStorage) |
| 4 | No FOUC | `ThemeProvider` in root layout prevents flash |

---

## 20. Support Contact

### TC-SUPPORT-001 — Contact form
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Open support widget | Contact form visible |
| 2 | Logged-in user | Email field pre-filled |
| 3 | Submit valid message | `POST /api/support/contact`, toast "Message sent!" |
| 4 | API error | Error toast shown |
| 5 | Unauthenticated user | Form accessible, email field empty |

---

## 21. Cookie Consent

### TC-COOKIE-001 — Banner and consent
| # | Step | Expected Result |
|---|------|----------------|
| 1 | First visit | Cookie banner shown |
| 2 | Click "Accept All" | `localStorage.cookie_consent = "accepted"`, banner hides |
| 3 | Click "Reject Non-Essential" | `localStorage.cookie_consent = "rejected"`, banner hides |
| 4 | Reload after consent | Banner not shown again |
| 5 | Accept → Vercel Analytics | Analytics fires |
| 6 | Reject → Vercel Analytics | Analytics does not fire |

---

## 22. Mobile Navigation

### TC-MOBILE-001 — Responsive navigation
| # | Step | Expected Result |
|---|------|----------------|
| 1 | Viewport < 1024px | Desktop sidebar hidden |
| 2 | Hamburger button | Visible in top-left |
| 3 | Tap hamburger | `MobileSidebar` opens (sheet from left) |
| 4 | Tap any nav link | Navigate + drawer closes |
| 5 | Credits badge in mobile sidebar | Visible |
| 6 | Theme toggle in mobile sidebar | Accessible |

---

## 23. Worker — Score Analysis

### TC-WORKER-SCORE-001 — SEO scoring
| # | Condition | Expected |
|---|-----------|---------|
| 1 | All 7 SEO checks pass | `seo = 100` |
| 2 | No title tag | Lower score than with title |
| 3 | HTTPS URL | `isHttps = true` contributes |
| 4 | HTTP URL | Lower SEO score |
| 5 | Missing `lang` attribute | Lower SEO score |
| 6 | `<h1>` present | Score higher than without |

### TC-WORKER-SCORE-002 — Best practices
| # | Condition | Expected |
|---|-----------|---------|
| 1 | `onclick=` in HTML | Lower BP score |
| 2 | `src="http://"` (mixed content) | Lower BP score |
| 3 | CSP header present | Higher BP score |
| 4 | HSTS header present | Higher BP score |

### TC-WORKER-SCORE-003 — Performance
| # | Condition | Expected |
|---|-----------|---------|
| 1 | bytes < 100 KB, TTFB < 800 ms | Performance > 80 |
| 2 | bytes > 500 KB | Lower performance than < 100 KB |
| 3 | TTFB > 1800 ms | Lower performance than < 800 ms |

### TC-WORKER-SCORE-004 — clamp
| # | Input | Expected |
|---|-------|---------|
| 1 | `-10` | `0` |
| 2 | `110` | `100` |
| 3 | `50` | `50` |

---

## 24. Worker — LLM Readiness Checks

### TC-WORKER-LLM-001 — Individual checks
| # | HTML Condition | Check | Expected |
|---|---------------|-------|---------|
| 1 | JSON-LD `@context` | `hasStructuredData` | `true` |
| 2 | `itemscope` attribute | `hasStructuredData` | `true` |
| 3 | No structured data | `hasStructuredData` | `false` |
| 4 | Meta description ≥ 50 chars | `hasMetaDescription` | `true` |
| 5 | No meta description | `hasMetaDescription` | `false` |
| 6 | Both `og:title` + `og:description` | `hasOpenGraph` | `true` |
| 7 | Only `og:title` | `hasOpenGraph` | `false` |
| 8 | `robots` noindex | `allowsAIBots` | `false` |
| 9 | No robots block | `allowsAIBots` | `true` |
| 10 | `<h1>` + `<h2>` | `hasCleanHeadings` | `true` |
| 11 | `rel="canonical"` | `hasCanonical` | `true` |
| 12 | HTML > 5000 chars | `hasSufficientContent` | `true` |

### TC-WORKER-LLM-002 — Crawler
| # | Condition | Expected |
|---|-----------|---------|
| 1 | Relative `/about` href | Converted to absolute URL |
| 2 | `#anchor` href | Filtered out |
| 3 | `/login` path | Filtered out |
| 4 | `/signup`, `/admin`, `/api` | Filtered out |
| 5 | External domain link | Filtered out |
| 6 | Duplicate links | Deduplicated |
| 7 | 6+ valid internal links | Max 4 returned |

---

## 25. Security Headers & Middleware

### TC-SECURITY-001 — Headers
| # | Header | Expected Value |
|---|--------|---------------|
| 1 | `X-Frame-Options` | `DENY` or `SAMEORIGIN` |
| 2 | `X-Content-Type-Options` | `nosniff` |
| 3 | `Referrer-Policy` | `strict-origin-when-cross-origin` |
| 4 | `Content-Security-Policy` | Present |

### TC-SECURITY-002 — Auth tokens
| # | Step | Expected |
|---|------|---------|
| 1 | API callback without `WORKER_CALLBACK_SECRET` | 401 |
| 2 | Cron endpoint without `CRON_SECRET` | 401 |
| 3 | API key SHA-256 hash | Plaintext never stored in DB |

---

## 26. End-to-End Smoke Tests

These are manual or Playwright-based full-flow tests run before each release.

| # | Flow | Steps | Pass Criteria |
|---|------|-------|--------------|
| E2E-01 | Happy path | Sign up → Analyze URL → Wait → View report → Export PDF | Report rendered, PDF downloaded |
| E2E-02 | Share flow | Login → Open report → Share → Copy link → Logout → Visit share URL | Public report visible |
| E2E-03 | Monitor flow | Login → Create monitor → Verify card → Pause → Resume → Delete | All state transitions correct |
| E2E-04 | Billing flow | Login (free) → Upgrade to Pro → Return to app | Credits updated to 100 |
| E2E-05 | API key flow | Login (agency) → Generate key → Copy → Call v1 API → Revoke | 202 then 401 after revoke |
| E2E-06 | Webhook flow | Add webhook → Trigger analysis → Verify POST received with signature | Payload + HMAC correct |
| E2E-07 | Team invite | Owner invites email → Invited user accepts → Owner sees Active member | Member joins |
| E2E-08 | Mobile | Open on 375px → Navigate via drawer → Analyze URL | All pages accessible |

---

## Test Environment Matrix

| Environment | URL | DB | AI | Stripe |
|-------------|-----|----|----|--------|
| Local dev | `localhost:3000` | Supabase local | Real Anthropic (test key) | `sk_test_` |
| Staging | `staging.websiteanalyzer.dev` | Supabase staging | Real Anthropic | `sk_test_` |
| Production | `websiteanalyzer.dev` | Supabase prod | Real Anthropic | `sk_live_` |

---

## Known Limitations (Not Blocking)

| Item | Detail |
|------|--------|
| Cloudflare Worker not deployed | Analysis engine returns mock scores in staging |
| Sentry not configured | Error reporting to Sentry skipped |
| `og-image.png` missing | Social media preview cards use fallback |
| GPT-4o text analysis | Deferred to post-MVP; Claude handles all AI |
| Webhook retries | Single delivery only; no retry queue |
