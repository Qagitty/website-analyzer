# Website Analyzer — User Stories

Detailed feature specifications from the perspective of each user type.

**User types:**
- **Visitor** — unauthenticated user browsing the landing page
- **Free User** — signed-in user on the free plan (3 credits/month)
- **Pro User** — signed-in user on the Pro plan ($29/mo, 100 credits)
- **Agency User** — signed-in user on the Agency plan ($99/mo, unlimited credits)
- **Developer** — technical user integrating or extending the platform

---

## 1. Authentication

### US-AUTH-01: Sign up with email and password
**As a** visitor,  
**I want to** create an account using my email address and a password,  
**so that** I can start analysing websites and saving my reports.

**Acceptance Criteria:**
- The signup form is available at `/signup`
- Fields: email address, password (min 8 characters)
- Inline validation: invalid email format shows error immediately on blur
- Inline validation: password shorter than 8 characters shows "Password must be at least 8 characters"
- On successful submission, the account is created and the user is redirected to `/dashboard`
- If the email is already registered, the error "User already registered" is shown
- Supabase automatically creates a `user_settings` row (3 credits) and a `subscriptions` row (free plan) via the `handle_new_user()` trigger

---

### US-AUTH-02: Sign up / log in with Google OAuth
**As a** visitor,  
**I want to** sign in using my Google account with a single click,  
**so that** I don't have to manage another password.

**Acceptance Criteria:**
- "Continue with Google" button is present on both `/login` and `/signup`
- Clicking it redirects to Google's consent screen
- After approval, the browser is redirected to `/auth/callback` which exchanges the code for a Supabase session
- The user lands on `/dashboard`
- On the very first Google login, `user_settings` and `subscriptions` rows are created automatically (same as email signup)
- If the user was already logged in (`session exists`), visiting `/login` or `/signup` redirects directly to `/dashboard`

---

### US-AUTH-03: Log in with email and password
**As a** free user,  
**I want to** log in with my email and password,  
**so that** I can access my saved reports and credit balance.

**Acceptance Criteria:**
- Login form at `/login`
- Wrong password → inline error "Invalid login credentials"
- Successful login → redirect to `/dashboard`
- Session cookie is set and persists across page reloads
- Middleware protects all routes under `/dashboard`, `/analyze`, `/reports`, `/settings`, `/monitors` — unauthenticated access redirects to `/login`

---

### US-AUTH-04: Log out
**As a** logged-in user,  
**I want to** log out of my account,  
**so that** my session is cleared on shared devices.

**Acceptance Criteria:**
- Logout button is accessible from the user menu (avatar/name in sidebar or navbar)
- After logout, session cookie is cleared
- Visiting `/dashboard` redirects to `/login`
- No personal data remains accessible in the browser

---

## 2. Running an Analysis

### US-ANALYZE-01: Submit a URL for analysis
**As a** free user with remaining credits,  
**I want to** enter a website URL and start a quality analysis,  
**so that** I can get a detailed report with performance scores and AI recommendations.

**Acceptance Criteria:**
- URL input is available at `/analyze`
- Input accepts any valid `http://` or `https://` URL
- Invalid URL (no protocol, plain text, `ftp://`) shows inline validation error — no API call is made
- Submitting a valid URL:
  1. Deducts 1 credit atomically using the `use_credit()` DB function
  2. Creates an `analyses` row with `status = 'pending'`
  3. Adds job to the Redis queue
  4. Dispatches request to the Cloudflare Worker
  5. Redirects the user to `/analyze/{id}`
- If the user has 0 credits: error toast "No credits remaining. Please upgrade your plan." — no credit is deducted
- The Analyze button is disabled when credits = 0
- Current credit count is shown below the input ("X credits remaining")

---

### US-ANALYZE-02: Upload a design screenshot for comparison
**As a** pro user who has a Figma or design mockup,  
**I want to** upload my design screenshot when submitting a URL,  
**so that** I can see how closely my live site matches my intended design.

**Acceptance Criteria:**
- A collapsible "+ Compare with your design (optional)" section appears below the URL input
- Clicking it expands a drag-and-drop upload zone
- Accepted file types: PNG, JPG/JPEG, WebP
- Maximum file size: 10 MB
- Drag-and-drop: dragging an image over the zone highlights it; dropping loads a preview
- Click-to-upload: clicking the zone opens the native file picker
- After selecting a file:
  - Thumbnail preview of the image is shown
  - File name and an "×" remove button appear
  - Clicking "×" clears the preview and restores the empty drop zone
- Wrong file type → error "Please upload a PNG, JPG, or WebP image"
- File over 10 MB → error "Image must be under 10 MB"
- The design image is base64-encoded in the browser and sent with the POST body
- The backend stores the design image in Supabase Storage and saves `design_screenshot_url` on the `analyses` row
- If no design is uploaded, the analysis proceeds normally without a comparison section

---

### US-ANALYZE-03: Monitor analysis progress
**As a** user who has submitted a URL,  
**I want to** see real-time progress while my site is being analysed,  
**so that** I know the analysis is running and when it will finish.

**Acceptance Criteria:**
- The status page at `/analyze/{id}` polls `GET /api/reports/{id}` every 3 seconds
- Displayed information:
  - The URL being analysed
  - Current status badge: `pending` / `queued` / `running` / `completed` / `failed`
  - A progress bar that advances through status stages
  - Queue position when `status = 'queued'` (e.g. "Position #2 in queue")
  - Human-readable status message (e.g. "Analysing your website…")
- When status reaches `completed`:
  - Progress bar fills to 100%
  - After 1.5 seconds, the user is automatically redirected to `/reports/{id}`
- When status is `failed`:
  - Error message is shown
  - Polling stops
- No loading spinner or layout shift between poll cycles (polling is silent after first render)
- If the analysis has not reached `completed` or `failed` within 2 minutes, the status page shows an "Analysis Timed Out" error card with a "Try another URL" button — polling stops. This is a frontend safety guard against stuck analyses.

---

## 3. Viewing Reports

### US-REPORT-01: View a full analysis report
**As a** user,  
**I want to** view the detailed results of a completed analysis,  
**so that** I understand my website's strengths and what needs fixing.

**Acceptance Criteria:**
- Report is available at `/reports/{id}` for authenticated users who own the analysis
- Accessing another user's report returns 404 (enforced by RLS)
- The report page contains all of the following sections (when data is available):
  - **Header**: URL, "Analysed X ago" timestamp, analysis duration, Completed badge, Share/Copy buttons
  - **AI Summary**: short paragraph from Claude (shown only when `length > 5` — legacy "0" values are suppressed)
  - **Screenshot**: full-page PNG of the analysed site
  - **Performance Section**: Lighthouse score cards, radar chart, Core Web Vitals
  - **EAA Compliance Section**: EU Accessibility Act compliance level and category breakdown
  - **Accessibility Section**: WCAG violations list or "No violations found" empty state
  - **LLM Readiness Section**: AI-bot readiness score with 8 individual checks
  - **Crawled Pages Section**: multi-page crawl results (hidden when only 1 page analysed)
  - **Console Errors Section**: grouped errors or "No errors" empty state
  - **AI Insights Section**: insights with priority badges, quick wins, expandable code fixes
  - **Design Comparison Section**: only shown when a design was uploaded

---

### US-REPORT-02: Understand performance metrics
**As a** developer,  
**I want to** see Lighthouse scores and Core Web Vitals in a clear visual format,  
**so that** I can quickly identify which performance areas need the most attention.

**Acceptance Criteria:**
- Four score cards displayed: Performance, Accessibility, Best Practices, SEO
- Score colour coding: ≥ 90 = green, 50–89 = yellow, < 50 = red
- Radar chart shows all four scores simultaneously for a visual overview
- Core Web Vitals panel:
  - **LCP** (Largest Contentful Paint): Good if < 2500 ms — shows "✓ Good" or "✗ Needs work"
  - **FID** (First Input Delay): Shows **"N/A / Not measured"** — FID requires real user interaction which is impossible in automated headless analysis; tooltip explains this
  - **CLS** (Cumulative Layout Shift): Shows **"N/A / Not measured"** — CLS requires observing layout shifts in a rendering browser; tooltip explains this
  - **TTFB** (Time to First Byte): Good if < 800 ms — shows "✓ Good" or "✗ Needs work"
- Measurement confidence badge (when `performanceVariance` is available): High / Medium / Low based on TTFB variance across multiple samples

---

### US-REPORT-03: View and act on AI insights with code fixes
**As a** developer,  
**I want to** see AI-generated recommendations for each issue, with ready-to-use code snippets,  
**so that** I can fix problems without having to research the solution myself.

**Acceptance Criteria:**
- AI Insights section shows:
  - A summary card (indigo background) with an overview paragraph
  - A "⚡ Quick Wins" card listing easy, high-impact improvements
  - Individual insight cards for each identified issue
- Each insight card shows:
  - Category icon (⚡ performance, ♿ accessibility, 🎨 UX, 🔍 SEO, 🔒 security)
  - Issue title
  - Priority badge: `critical` (red), `high` (red), `medium` (gray), `low` (outline)
  - Description of the problem
  - Recommendation box with the specific fix
  - Expected impact
- When `codeExample` is present on an insight:
  - "▼ Show code fix" toggle appears below the recommendation
  - Clicking it expands a dark-themed code block (zinc-950 background)
  - A "Copy" button in the top-right of the code block copies the snippet to clipboard
  - After copying, the button shows "✓ Copied" for 2 seconds
  - "▲ Hide code" collapses the block
- When `codeExample` is null/absent: the toggle is not rendered at all
- The summary guard: if `ai_summary` is `"0"`, empty, or ≤ 5 characters, it is not rendered (avoids legacy DB junk)

---

### US-REPORT-04: View design comparison results
**As a** designer or developer who uploaded a design screenshot,  
**I want to** see how my live site compares to my design,  
**so that** I can identify and fix visual discrepancies.

**Acceptance Criteria:**
- Design Comparison section appears at the bottom of the report only when `design_screenshot_url` exists
- The section shows:
  - **Fidelity score** (0–100) with a colour-coded progress bar:
    - ≥ 80 = green ("High fidelity")
    - 60–79 = yellow ("Moderate fidelity")
    - < 60 = red ("Low fidelity")
  - **Summary paragraph** from Claude
  - **Side-by-side thumbnails**: design image (left, labelled "Your Design") and live screenshot (right, labelled "Live Site")
  - **Matching Areas** card (green): list of visual areas that match well between design and live site
  - **Issues Found**: list of mismatch cards, each showing:
    - Area name (e.g. "Hero section")
    - Severity badge: `critical`, `major`, or `minor`
    - "Design expects" panel (blue): what Claude sees in the design screenshot
    - "Live site shows" panel (orange): what Claude sees in the live screenshot
    - CSS fix suggestion in a code-styled block
- If no mismatches are found: "✓ No significant mismatches detected" message is shown
- If the analysis was run without a design upload: the entire Design Comparison section is not rendered

---

## 4. Sharing Reports

### US-SHARE-01: Share a report publicly
**As a** pro user,  
**I want to** generate a public link to a completed report,  
**so that** I can share it with clients or teammates who don't have an account.

**Acceptance Criteria:**
- A "Share" button (with a link icon) is visible in the report header for all completed analyses
- Clicking "Share":
  1. Calls `POST /api/reports/{id}/share`
  2. Sets `is_public = true` on the `analyses` row
  3. Returns `{ isPublic: true, shareUrl: "https://app.com/share/{id}" }`
  4. Copies the share URL to the clipboard automatically
  5. Shows toast: "Link copied to clipboard! Anyone with the link can view this report."
  6. The button turns blue and shows "Shared" with a chain-link icon
  7. A green banner appears below the header: "This report is public." with the full URL as a clickable link
  8. A "Copy link" button appears next to the share button

---

### US-SHARE-02: View a public report without logging in
**As a** client or teammate receiving a share link,  
**I want to** view the full analysis report without creating an account,  
**so that** I can understand the site's issues without any friction.

**Acceptance Criteria:**
- The public report URL has the format `/share/{id}`
- No authentication is required — the page is accessible in incognito / private browsing
- The page renders identically to the private report page, with all sections
- The header shows:
  - "WebAnalyzer" logo (links to landing page)
  - "Get your free report →" link (links to `/signup`)
- There is no "Share" / "Export PDF" button (those require login)
- A CTA footer is shown at the bottom: "Want a report like this for your site? Start for free →" (links to `/signup`)
- If `is_public = false` or the analysis ID doesn't exist → 404 page
- The page is fully server-side rendered for fast load and correct social media previews

---

### US-SHARE-03: Revoke a shared report
**As a** user who shared a report,  
**I want to** make the report private again,  
**so that** the public link no longer works.

**Acceptance Criteria:**
- When a report is currently public, the share button shows "Shared" (blue)
- Clicking "Shared" again:
  1. Calls `POST /api/reports/{id}/share`
  2. Sets `is_public = false`
  3. Shows toast: "Report is now private"
  4. Button reverts to "Share" (outline style)
  5. Green public URL banner disappears
  6. "Copy link" button disappears
- After revoking: visiting the old `/share/{id}` URL returns 404
- The toggle is optimistic — UI updates immediately, reverts on error

---

## 5. Credits & Subscriptions

### US-CREDITS-01: Track remaining credits
**As a** free user,  
**I want to** always see how many credits I have remaining,  
**so that** I know when I'm about to run out and need to upgrade.

**Acceptance Criteria:**
- Credits balance is displayed in the sidebar (bottom-left, "Credits left" badge)
- The badge refreshes on initial load and when the tab regains focus, but only if data is older than 5 minutes (stale guard). No interval polling.
- The badge does **not** flash, disappear, or show a loading spinner during background polls — only the very first load triggers a loading state
- After submitting an analysis, the count decrements by 1 immediately (or on next poll)
- When credits = 0:
  - The badge turns red or shows a warning colour
  - The Analyze button is disabled
  - Submitting via API returns 402 "Insufficient credits"

---

### US-CREDITS-02: Upgrade to Pro plan
**As a** free user who has used all 3 credits,  
**I want to** upgrade to the Pro plan,  
**so that** I can continue analysing websites.

**Acceptance Criteria:**
- Upgrade options are visible on the Settings page (`/settings`) and in the empty-credits state
- Clicking "Upgrade to Pro" / "Get Pro":
  1. Calls `POST /api/stripe/checkout` with `plan: 'pro'`
  2. Redirects to a Stripe-hosted checkout page
  3. On successful payment, Stripe sends a `customer.subscription.created` webhook
  4. The webhook handler updates `subscriptions.plan = 'pro'` and sets `user_settings.credits = 100`
  5. On return to the app, the credits badge shows 100
- Agency plan ($99/mo, unlimited): same flow, `credits` set to a very large number (e.g. 9999)
- Failed payment → Stripe handles the error; user is returned to the app with no plan change

---

### US-CREDITS-04: Monthly credit refresh (free plan)
**As a** free user whose 3 monthly credits have run out,  
**I want** my credits to automatically reset on the 1st of every month,  
**so that** I can continue using the service without upgrading.

**Acceptance Criteria:**
- A Vercel Cron job fires on `0 0 1 * *` (midnight UTC on the 1st of each month)
- The cron endpoint `GET /api/cron/reset-credits` is authenticated via `Authorization: Bearer {CRON_SECRET}`
- All users whose subscription plan is `'free'` have their `user_settings.credits` reset to `3`
- Pro and Agency users are unaffected — their credits are managed by Stripe webhooks
- The batch processes in pages of 500 users to prevent query timeouts
- The endpoint returns `{ reset: N, creditsPerUser: 3 }` on success

---

### US-CREDITS-03: Manage billing via Stripe portal
**As a** Pro or Agency user,  
**I want to** access the Stripe billing portal,  
**so that** I can update my payment method, view invoices, or cancel my subscription.

**Acceptance Criteria:**
- Settings page shows a "Manage Billing" button for paid subscribers
- Clicking it calls `POST /api/stripe/portal` and redirects to the Stripe Customer Portal
- From the portal the user can: update payment details, download invoices, cancel subscription
- On cancellation, `cancel_at_period_end = true`; plan remains active until the period end date
- On return from the portal, the settings page reflects the current subscription state

---

## 6. Scheduled Monitoring

### US-MONITOR-01: Create a scheduled monitor
**As a** pro user managing a client's website,  
**I want to** set up automated daily or weekly re-analyses,  
**so that** I get notified if the site's quality scores drop without me having to manually check.

**Acceptance Criteria:**
- Monitors page is at `/monitors`, linked from the sidebar
- "New Monitor" form contains:
  - URL input (same validation as the analysis form)
  - Frequency selector: **Daily** | **Weekly** (default: Weekly)
  - "Notify me if scores drop" toggle (default: on)
  - Score drop threshold input: integer 1–50 (default: 10 points)
  - "Create monitor" submit button
- On successful creation:
  - Monitor card appears in the list
  - 1 credit is immediately deducted and an analysis is dispatched to the Cloudflare Worker. The monitor card shows `last_run_at` right away.
  - `next_run_at` is set to now + 24 h (daily) or now + 7 days (weekly) — this governs the SECOND and subsequent runs; the first runs immediately at creation time.
  - Toast: "Monitor created"
- Free plan limit: maximum 3 monitors. Creating a 4th returns 402 "Free plan allows up to 3 monitors. Upgrade for more."
- Pro/Agency: unlimited monitors

---

### US-MONITOR-02: View monitor status and history
**As a** pro user,  
**I want to** see the current state of each monitor, including the latest scores and when the next run will happen,  
**so that** I can quickly assess the health of monitored sites.

**Acceptance Criteria:**
- Each monitor card shows:
  - The monitored URL
  - Status badge: **Active** (green) or **Paused** (gray)
  - Frequency: "Daily" or "Weekly"
  - Last run: "Last run X ago" (or "Never run yet")
  - Next run: "Next run: May 14" (formatted date)
  - Latest Lighthouse scores (Performance, Accessibility, SEO) with colour coding, if available
  - Collapsible "Report history" panel — lazy-loads on first expand; shows all completed analyses for the URL, newest first, with date, average score (colour-coded), and a "View →" link to each report
  - Pause / Resume button
  - Delete button
- When a monitor is paused, the URL/scores/timing content is dimmed (opacity-60) but the Resume and Delete buttons remain at full opacity to make it clear they are still interactive.
- Score trend chart is visible when a monitor has multiple historical runs

---

### US-MONITOR-03: Pause and resume a monitor
**As a** user,  
**I want to** pause a monitor temporarily without deleting it,  
**so that** I can stop automated runs (e.g. during a site rebuild) and resume later.

**Acceptance Criteria:**
- Each active monitor card has a "Pause" button
- Clicking "Pause" calls `PATCH /api/monitors/{id}` with `{ is_active: false }`
- The card's badge changes from "Active" to "Paused"
- The Vercel Cron handler skips monitors with `is_active = false`
- A paused monitor card shows a "Resume" button
- Clicking "Resume" sets `is_active = true` — the badge returns to "Active"
- The next run is not reset when resuming (it retains the existing `next_run_at`)

---

### US-MONITOR-04: Receive a score-drop email alert
**As a** pro user who has enabled notifications,  
**I want to** receive an email when a monitored site's score drops significantly,  
**so that** I can investigate and fix regressions before they affect users.

**Acceptance Criteria:**
- The Vercel Cron runs every hour (`0 * * * *`) and processes all monitors where `next_run_at <= now` and `is_active = true`
- For each due monitor:
  1. A new analysis is dispatched to the Cloudflare Worker (same flow as manual analysis)
  2. When the callback arrives, the monitor's `last_scores`, `last_analysis_id`, and `last_run_at` are updated
  3. `next_run_at` is advanced by 24 h or 7 days depending on frequency
- Score drop check: if `notify_on_score_drop = true` and any of Performance, Accessibility, or SEO dropped by ≥ `score_drop_threshold` points compared to `last_scores`:
  - An email is sent via Resend to the monitor owner's email address
  - Subject: "⚠️ Score drop detected on {url}"
  - Body: HTML table showing previous vs current scores and a link to the new report
- If `RESEND_API_KEY` is not set in environment: email sending is silently skipped; the cron run still completes successfully without error
- If the user has 0 credits: the monitor is automatically set to `is_active = false` with a note; no credit is consumed; no analysis is run
- The cron endpoint requires `Authorization: Bearer {CRON_SECRET}` — missing or wrong token returns 401

---

### US-MONITOR-05: Delete a monitor
**As a** user,  
**I want to** permanently delete a monitor I no longer need,  
**so that** it stops consuming my monitor quota and my list stays clean.

**Acceptance Criteria:**
- Each monitor card has a "Delete" button
- Clicking "Delete" opens an in-app confirmation dialog (AlertDialog). Confirming calls `DELETE /api/monitors/{id}`; cancelling dismisses without action.
- The monitor is removed from the DB (hard delete — RLS ensures only the owner can delete it)
- The card is removed from the UI immediately
- Toast: "Monitor deleted"
- The user's monitor count decreases, allowing creation of a new monitor if they were at the free plan limit

---

## 7. Reports History

### US-HISTORY-01: Browse past analyses
**As a** user,  
**I want to** see a list of all my past website analyses,  
**so that** I can revisit old reports and track improvements over time.

**Acceptance Criteria:**
- Reports history page at `/reports`
- All analyses for the logged-in user are listed, sorted by date (newest first)
- Each row shows: URL, status badge, date/time, and a link to view the report
- Clicking a completed analysis navigates to `/reports/{id}`
- Failed analyses show a "Retry" button (via `RetryButton` component) that creates a new analysis for the same URL consuming 1 credit
- Empty state: "No analyses yet. Analyse your first website →" CTA
- `GET /api/reports/history` is the dedicated endpoint used to fetch the paginated list

---

## 8. Settings

### US-SETTINGS-01: Manage account preferences
**As a** user,  
**I want to** update my profile name and notification preferences,  
**so that** the platform reflects my personal details and I only receive the emails I want.

**Acceptance Criteria:**
- Settings page at `/settings`
- Profile section: display name input, Save button — calls `PATCH /api/user/profile`
- Notification section: toggles for "Email on complete" and "Email on fail"
- Saving updates `user_settings.preferences` (display name) or `user_settings.notifications` in the DB
- Toast on success: "Profile updated"
- Toast on failure: error message from the API

---

### US-SETTINGS-02: Manage billing and subscription
**As a** pro user,  
**I want to** manage my subscription from within the app,  
**so that** I can update payment details, cancel, or change my plan.

**Acceptance Criteria:**
- Settings page shows the current plan badge (Free / Pro / Agency)
- For free users: "Upgrade to Pro" and "Upgrade to Agency" cards are shown with feature lists
- For Pro/Agency users: "Manage Billing" button is shown
- Clicking "Manage Billing" calls `POST /api/stripe/portal` and redirects to the Stripe Customer Portal (opens in new tab)
- From the portal, users can: update payment method, download invoices, cancel subscription
- On cancellation, `cancel_at_period_end` is set to `true`; the plan remains active until period end

---

### US-SETTINGS-03: Custom branding
**As an** Agency user,  
**I want to** configure custom branding (logo and primary colour),  
**so that** reports I share with clients reflect my agency's identity.

**Acceptance Criteria:**
- Branding section is visible on `/settings` for Agency plan users
- Form fields: Logo URL input, Primary colour picker (hex input)
- Saving calls `PATCH /api/user/branding`
- Branding settings are stored in `user_settings.preferences`
- On public shared reports (`/share/{id}`), the custom logo replaces the default WebAnalyzer logo when the owning user has branding configured
- Free/Pro users see a locked state with an "Upgrade to Agency" prompt

---

## 9. PDF Export

### US-PDF-01: Export a report as PDF
**As a** developer or agency user,  
**I want to** download a PDF version of a completed report,  
**so that** I can share it with clients offline or attach it to a project document.

**Acceptance Criteria:**
- "Export PDF" button is visible on the report detail page
- Clicking it navigates to `GET /api/reports/{id}/pdf`
- The browser triggers a file download with the filename `report-{id}.pdf`
- The PDF contains: URL, analysis date, Lighthouse scores, accessibility issues summary, console errors summary, AI insights text
- The PDF is formatted with clear headings, within-margin text, no overlapping lines, and readable font sizes
- Non-existent report ID → 404

---

## 10. Landing Page & Onboarding

### US-LANDING-01: Understand the product before signing up
**As a** visitor,  
**I want to** understand what Website Analyzer does and whether it's worth signing up,  
**so that** I can make an informed decision.

**Acceptance Criteria:**
- Landing page at `/` is fully public (no auth required)
- Page sections:
  - Hero: headline, sub-headline, "Get Started for Free" CTA, product demo animation
  - Features: performance, accessibility, AI insights, design comparison, scheduled monitoring, PDF export
  - Pricing: Free (3 analyses/mo), Pro ($29/mo, 100 analyses), Agency ($99/mo, unlimited)
  - Footer: links to login, signup, privacy policy
- "Get Started for Free" and all upgrade CTAs link to `/signup`
- "Log in" link in the header navigates to `/login`
- Logged-in users who visit `/` are not redirected (they can still view the landing page)
- `ProductDemo` component shows a live animated preview of the analysis UI

---

## 11. Error Handling

### US-ERROR-01: Graceful degradation on analysis failure
**As a** user whose analysis failed,  
**I want to** see a clear error message and be able to retry easily,  
**so that** I'm not left confused and can get my report without re-entering the URL.

**Acceptance Criteria:**
- If the Cloudflare Worker returns an error, the analysis `status` is set to `failed` with an `error_message`
- The status page `/analyze/{id}` shows the error message and stops polling
- **Credit refund — worker error:** If the worker reports failure (worker-side crash, timeout, fetch error), `refund_credit()` is called in the callback route immediately after marking the analysis failed — the user's balance is restored
- **Credit refund — server-side error:** If the callback processing itself fails (AI call exception, DB error), the credit is also refunded — the user is never penalised for server-side failures
- The reports history page shows a "Retry" button (via `RetryButton` component) on failed analyses
- Clicking "Retry" creates a new analysis for the same URL (consuming 1 new credit)

---

### US-ERROR-02: Error boundaries prevent full-page crashes
**As a** user,  
**I want to** see a friendly error card if a specific section of the report fails to render,  
**so that** I can still view the rest of the report.

**Acceptance Criteria:**
- Each major section of the report page is wrapped in an `ErrorBoundary` component
- If one section throws a render error (e.g. malformed AI JSON), the error boundary renders a fallback card: "This section encountered an error" instead of crashing the whole page
- Other sections continue to render normally
- The error is reported to Sentry (when configured)

---

## 12. API Keys

### US-APIKEY-01: Generate an API key
**As a** developer on an Agency plan,  
**I want to** generate a personal API key,  
**so that** I can integrate Website Analyzer programmatically into my CI/CD pipeline or custom tools.

**Acceptance Criteria:**
- API Keys section is visible on `/settings` for all users (but key generation is restricted to Agency plan)
- Clicking "Generate API Key" calls `POST /api/api-keys`
- The returned key has the format `wa_live_` followed by 32 random hex characters
- After generation, the full key is shown in a green post-generation banner. The key can also be revealed at any time via the Eye icon (👁) on the key row, which calls `GET /api/api-keys/{id}/reveal` and displays the decrypted key inline with a copy button.
- A "Copy" button copies the key to clipboard; it turns amber-colored after copying
- The key is stored in the DB as both a SHA-256 hash (for authentication) and AES-256-GCM encrypted ciphertext (for reveal). The plaintext is never stored in plain text.
- After generating, the page shows the key prefix (first 12 characters + `…`) and the creation date
- Free/Pro users see a locked state with an "Upgrade to Agency" prompt

---

### US-APIKEY-02: Use an API key to trigger analysis
**As a** developer,  
**I want to** call `POST /api/v1/analyze` with my API key in the `Authorization` header,  
**so that** I can trigger analyses from automated scripts.

**Acceptance Criteria:**
- API endpoint: `POST /api/v1/analyze` with `Authorization: Bearer wa_live_...`
- Request body: `{ "url": "https://example.com" }`
- The key is hashed and looked up in the `api_keys` table
- If valid: analysis is created and `{ analysisId, status }` returned with HTTP 202
- If invalid key: HTTP 401 `{ "error": "Invalid API key" }`
- Rate limiting enforced per plan:
  - Free: 10 requests/hour
  - Pro: 60 requests/hour
  - Agency: 300 requests/hour
- Exceeding rate limit: HTTP 429 `{ "error": "Rate limit exceeded" }`
- Each API key usage increments `last_used_at` and `use_count` on the `api_keys` row

---

### US-APIKEY-03: List past analyses via API
**As a** developer,  
**I want to** call `GET /api/v1/analyses` to retrieve my analysis history,  
**so that** I can integrate report data into my own dashboards.

**Acceptance Criteria:**
- Endpoint: `GET /api/v1/analyses` with `Authorization: Bearer wa_live_...`
- Returns a JSON array of analyses belonging to the authenticated API key owner
- Each item includes: `id`, `url`, `status`, `created_at`, `lighthouse_scores`
- Same rate limiting as `POST /api/v1/analyze`
- Invalid key → 401

---

### US-APIKEY-04: Retrieve a single report via API
**As a** developer,  
**I want to** call `GET /api/v1/reports/{id}` to fetch a specific report,  
**so that** I can access full report data programmatically.

**Acceptance Criteria:**
- Endpoint: `GET /api/v1/reports/{id}` with `Authorization: Bearer wa_live_...`
- Returns the full analysis object including all sections
- Only the owner of the analysis (matched by API key's user) can retrieve it — others get 404
- Invalid key → 401

---

### US-APIKEY-05: Revoke an API key
**As a** developer,  
**I want to** revoke an existing API key,  
**so that** I can invalidate it if it was accidentally exposed.

**Acceptance Criteria:**
- Each API key row has a "Revoke" button (red text)
- Clicking "Revoke" calls `DELETE /api/api-keys/{id}`
- The key row is removed from the list immediately
- Any subsequent API call using the revoked key returns HTTP 401
- Action is irreversible — a new key must be generated if needed

---

### US-APIKEY-06: Reveal an API key
**As a** developer who has already generated a key,  
**I want to** view the full key again at any time,  
**so that** I don't need to revoke and regenerate the key if I forget to copy it.

**Acceptance Criteria:**
- Each active key row has an Eye icon button
- Clicking it calls `GET /api/api-keys/{id}/reveal` — server decrypts and returns the key
- The full key appears inline in the row in monospace font, replacing the `prefix...` display
- A copy button appears next to the revealed key
- Clicking the EyeOff icon hides the key again (client-side — no server call)
- Revoked keys cannot be revealed (endpoint returns 410)
- Keys generated before the reveal feature was added (no `key_encrypted`) return a 404 with a message to revoke and re-generate

---

## 13. Webhooks

### US-WEBHOOK-01: Register a webhook endpoint
**As a** pro/agency user,  
**I want to** register a webhook URL that receives a POST request every time an analysis completes,  
**so that** I can build automated workflows (e.g. post results to Slack, trigger CI).

**Acceptance Criteria:**
- Webhooks section is on `/settings`
- "Add Webhook" form: URL input + "Add" button
- URL must be a valid `https://` URL
- On save, a `webhooks` row is created with a randomly-generated `secret` (used for HMAC signature)
- The webhook list shows: URL, status (Active/Paused), event types, creation date, "Delete" button
- Webhook secret is shown once after creation in an amber reveal box (same pattern as API keys)
- Maximum 5 webhooks per account (across all plans)

---

### US-WEBHOOK-02: Receive a signed webhook payload
**As a** developer receiving webhooks,  
**I want to** verify that webhook payloads come from Website Analyzer,  
**so that** my endpoint rejects forged requests.

**Acceptance Criteria:**
- Every webhook POST includes the header `X-WebsiteAnalyzer-Signature: sha256=<hmac_hex>`
- HMAC is computed as `HMAC-SHA256(secret, JSON.stringify(payload))`
- Payload structure: `{ event: "analysis.completed", analysisId, url, scores: { performance, accessibility, seo }, completedAt }`
- For Slack webhook URLs (containing `hooks.slack.com`): payload is sent in Slack Block Kit format instead
- Delivery is attempted once; failed deliveries are not retried in the current implementation
- Webhook URL is called within 30 seconds of analysis completion

---

### US-WEBHOOK-03: Delete a webhook
**As a** user,  
**I want to** delete a webhook I no longer need,  
**so that** it stops receiving events and my list stays tidy.

**Acceptance Criteria:**
- Clicking "Delete" on a webhook row calls `DELETE /api/webhooks/{id}`
- The row is removed immediately from the UI
- No further events are delivered to the deleted endpoint

---

## 14. Team Members

### US-TEAM-01: Invite a team member
**As a** pro/agency user who manages multiple websites for clients or a team,  
**I want to** invite other users to access my account's reports,  
**so that** my team can collaborate without sharing login credentials.

**Acceptance Criteria:**
- Team Members section is on `/settings`
- "Invite Member" form: email input + role selector (Member / Admin) + "Send Invite" button — calls `POST /api/team`
- On submit, a `team_members` row is created with `status = 'pending'` and a unique `invite_token`
- An invitation email is sent via Resend to the provided email address
- Email subject: "You've been invited to Website Analyzer"
- Email body contains a link: `/invite/{token}`
- The team members list shows: email, role badge, status badge (Pending/Active/Rejected), invited date

---

### US-TEAM-02: Accept a team invitation
**As a** user who received an invitation email,  
**I want to** accept the invitation,  
**so that** I can access the team's reports.

**Acceptance Criteria:**
- Clicking the invite link navigates to `/api/team/accept?token=…`
- If the user is not logged in, they are redirected to `/login` with a redirect-back parameter containing the token
- After authentication, the invite is accepted: `status = 'active'`, `member_id` set, `accepted_at` set
- The user is redirected to `/dashboard?invited=1`
- The user can now see the team owner's analyses in their reports list
- **Invite expiry:** If the invite token is older than 7 days (`invite_expires_at` has passed), the user is redirected to `/login?error=invite_expired` — distinct from an invalid token (`invite_expired` vs `invalid_invite`)
- If the token is invalid or already used: redirect to `/login?error=invalid_invite`
- If the invited email doesn't match the logged-in account email: error "This invitation was sent to a different email address"

---

### US-TEAM-04: Invite expiry management
**As a** team owner,  
**I want** invite links to expire automatically after 7 days,  
**so that** stale invite links cannot be misused.

**Acceptance Criteria:**
- Every new invite row has `invite_expires_at = now + 7 days` set at creation time
- Invitees who click the link within 7 days can accept normally
- Invitees who click after 7 days see an "Invite expired" error and must request a new invite from the owner
- Existing pending invites (before this feature was added) are back-filled to `invited_at + 7 days` via migration 016
- Accepted and rejected rows have `invite_expires_at = null` (irrelevant after resolution)

---

### US-TEAM-03: Remove a team member
**As a** team owner,  
**I want to** remove a team member,  
**so that** they can no longer access my account's reports.

**Acceptance Criteria:**
- Each team member row has a "Remove" button (owner only)
- Clicking "Remove" calls `DELETE /api/team/{id}`
- The member row is removed from the UI immediately
- The removed user can no longer see the owner's analyses

---

## 15. LLM Readiness

### US-LLM-01: View LLM Readiness score in a report
**As a** developer building AI-powered features or wanting to make my site AI-crawlable,  
**I want to** see how ready my site is to be indexed and understood by AI bots,  
**so that** I can optimise for LLM-based search engines and AI assistants.

**Acceptance Criteria:**
- LLM Readiness section appears in every completed report
- An overall score (0–100) is shown with colour coding: ≥ 80 green, ≥ 50 amber, < 50 red
- 8 individual checks are shown, each as a pass/fail row:
  1. `robots.txt` allows AI bots (Googlebot, GPTBot, ClaudeBot, PerplexityBot)
  2. Clean HTML structure (semantic elements: `<main>`, `<article>`, `<section>`, `<h1>–<h6>`)
  3. Meta description present (non-empty `<meta name="description">`)
  4. Open Graph tags present (`og:title`, `og:description`, `og:url`)
  5. Structured data (JSON-LD `<script type="application/ld+json">`)
  6. No excessive JavaScript dependency (page renders meaningful text server-side)
  7. Canonical URL set (`<link rel="canonical">`)
  8. `sitemap.xml` referenced in `robots.txt` or present at `/sitemap.xml`
- Each check shows a pass ✓ (green) or fail ✗ (red/amber) indicator with a brief label
- Failed checks show a "How to improve" expandable hint
- Score is calculated as `(passed checks / 8) * 100`

---

## 16. Crawled Pages

### US-CRAWL-01: View multi-page crawl results
**As a** developer running an analysis on a website,  
**I want to** see a summary of all internal pages the crawler discovered,  
**so that** I can understand the site's structure and identify pages with issues.

**Acceptance Criteria:**
- Crawled Pages section appears in reports when the crawler followed internal links
- The section shows a summary card: total pages discovered, average performance score, pages with errors
- A table lists each discovered page:
  - URL (relative path shown, full URL on hover)
  - HTTP status code (200 = green, 3xx = amber, 4xx/5xx = red)
  - Performance score (0–100) with colour coding, if available
  - Any errors found on that page
- Pages are sorted by HTTP status (errors first)
- If only one page was analysed (no crawl): the section is hidden
- Crawler follows `<a href>` links with the same origin domain only — external links are excluded
- Maximum 10 pages crawled per analysis to keep analysis time bounded

---

## 17. Onboarding

### US-ONBOARD-01: See onboarding guidance on first login
**As a** new user who just signed up,  
**I want to** see clear guidance on what to do next,  
**so that** I can get value from the product immediately without having to explore on my own.

**Acceptance Criteria:**
- After first login (account with 0 completed analyses), an onboarding banner is shown at the top of the dashboard
- Banner contents:
  - Welcome message: "Welcome to WebAnalyzer!"
  - Step 1: Analyse your first website (links to `/analyze`)
  - Step 2: Review your report (links to `/reports`)
  - Step 3: Set up monitoring (links to `/monitors`)
- Each step shows a tick ✓ when completed (persisted in `user_settings.preferences`)
- The banner can be dismissed manually ("Got it" or "×" button)
- Once dismissed or once all 3 steps are completed, the banner does not appear again
- Returning users (with completed analyses) never see the banner

---

## 18. EAA Compliance

### US-EAA-01: View European Accessibility Act compliance status
**As a** developer or product owner building a product for the EU market,  
**I want to** see whether my site meets EAA (European Accessibility Act) requirements,  
**so that** I can understand our legal compliance obligations and prioritise fixes.

**Acceptance Criteria:**
- EAA Compliance section appears in every completed report (shown above the full Accessibility section)
- Section shows an overall compliance level: **Compliant** (green), **Partially Compliant** (amber), or **Non-Compliant** (red)
- Three compliance categories are evaluated:
  1. **WCAG 2.1 Level AA** — mapped from axe-core violations
  2. **Perceivable** — no critical contrast or alt-text failures
  3. **Operable** — no keyboard-trap or focus-order violations
- Each category shows: status badge + count of issues in that category
- A legal notice callout explains the EAA deadline (June 2025) and its implications for EU-market products
- WCAG criterion tags (e.g. `wcag2aa`, `wcag143`) are shown next to each issue
- Section links to the full Accessibility Section below for detailed violation info

---

## 23. Compliance PDF Report

### US-COMPLIANCE-PDF-01: Download a compliance-framed audit PDF
**As a** Pro/Agency/Compliance user who needs to demonstrate accessibility compliance,  
**I want to** download a formally structured compliance PDF from any completed report,  
**so that** I can share it with legal teams, auditors, or management without them needing app access.

**Acceptance Criteria:**
- A **"Compliance PDF"** button (indigo, with download icon) appears in the report header next to the existing "PDF" button
- Clicking it calls `GET /api/reports/{id}/compliance-pdf`
- Free plan users receive 402 "Compliance PDF reports require the Pro plan or higher"
- Pro+ users receive a PDF download named `compliance-report-{hostname}.pdf`
- The PDF contains:
  1. **Cover page** — dark branded, site URL, audit date, WCAG standard, overall compliance status badge (Compliant / Partially Compliant / Non-Compliant)
  2. **Executive Summary** — plain-English status description, 3 stat cards (total / critical / moderate issues), WCAG category breakdown table, AI summary if available
  3. **Legal Context** — EAA requirements, fine amounts, who is affected, audit methodology, standards referenced (WCAG 2.1, EN 301 549, Directive 2019/882)
  4. **Issues Found** — all violations sorted critical → serious → moderate → minor, each with WCAG criteria tags
  5. **Remediation & Sign-Off** — priority list (IMMEDIATE / HIGH), 5-step action plan with 30-day deadline, physical sign-off table (name / role / date / signature)
- If no issues found: Issues page shows "✓ No Accessibility Issues Detected"
- Agency users with custom branding: Agency name shown as "Prepared by" on cover

---

## 24. Remediation Tracking

### US-REMEDIATION-01: Track an accessibility issue for fixing
**As a** Pro/Agency/Compliance user reviewing an accessibility report,  
**I want to** mark specific issues as "tracked" so I can manage their resolution,  
**so that** I don't lose track of what needs to be fixed across multiple reports.

**Acceptance Criteria:**
- Each issue card in the Accessibility section has a **Track** button (bookmark icon)
- Clicking Track: issue is saved to `remediation_items` table; button turns indigo "Tracked ✓"
- Clicking "Tracked ✓": issue is removed from tracking; button reverts to "Track"
- Free users attempting to track receive 402 "requires Pro plan or higher"
- Tracking state persists across page reloads (loaded via `GET /api/remediation` on mount)
- Tracked count shown in the Accessibility section header ("3 tracked")
- Duplicate tracking prevented server-side (409 if same user + analysis + issue)

---

### US-REMEDIATION-02: Manage tracked issues on the remediation board
**As a** user with tracked issues,  
**I want to** see all my tracked issues in one place and move them through a resolution workflow,  
**so that** I can manage remediation progress systematically.

**Acceptance Criteria:**
- Remediation board at `/compliance/remediation`, linked from the Compliance page header
- Tabs: **All | Open | In Progress | Resolved | Verified** with live counts
- Each issue card shows: impact badge, WCAG rule ID, plain-English description, WCAG criteria tags, site hostname, age
- **Status advance button** ("→ In Progress", "→ Resolved", "→ Verified") advances status one step
- Verified is the terminal state — no further advance button shown
- **Notes expander**: free-text notes field, Save button, "View original report →" link
- **Delete button** (trash icon): removes issue from tracker immediately; toast confirms
- Empty state: "No issues tracked yet" with link to Reports

---

### US-REMEDIATION-03: Filter by status
**As a** user with many tracked issues,  
**I want to** filter the board by status (Open, In Progress, Resolved, Verified),  
**so that** I can focus on what needs attention right now.

**Acceptance Criteria:**
- Clicking a tab filters the list to that status
- Tab badge counts update as items are advanced or deleted
- All tab shows all items regardless of status

---

## 25. Compliance Plan (Tier 4)

### US-COMPLIANCE-PLAN-01: Choose the Compliance plan
**As a** business that sells to EU customers and needs to demonstrate ongoing EAA compliance,  
**I want to** subscribe to the Compliance plan,  
**so that** I get the full compliance toolkit including audit history, remediation tracking, and signed-off compliance reports.

**Acceptance Criteria:**
- Landing page pricing section shows 4 plans: Free / Pro ($29) / Agency ($99) / **Compliance ($249)**
- Compliance card has emerald "EAA ready" badge and lists: unlimited analyses, EAA/WCAG 2.1 AA dashboard, compliance PDF with sign-off, remediation board, audit history, dedicated compliance support
- Clicking "Get started" on the Compliance card initiates Stripe checkout
- Settings → Subscription shows Compliance plan with emerald badge
- Compliance users see all features from lower tiers
- Settings upgrade section shows relevant higher tiers only (Free → shows 3 options, Pro → 2, Agency → 1, Compliance → none)

---

### US-COMPLIANCE-PLAN-02: Feature gating for compliance features
**As a** Free plan user,  
**I want to** see clear upgrade prompts when I try to use compliance-only features,  
**so that** I understand what I need to upgrade to access them.

**Acceptance Criteria:**
- Compliance PDF: Free users get 402 with message "requires the Pro plan or higher"
- Remediation Tracking (POST): Free users get 402 with message "requires the Pro plan or higher"
- Pro+ users can access both features
- The plan hierarchy for access checks: free (0) < pro (1) < agency (2) < compliance (3)

---

## 19. Theme

### US-THEME-01: Toggle dark and light mode
**As a** user,  
**I want to** switch between dark and light mode,  
**so that** I can use the app comfortably in different lighting conditions.

**Acceptance Criteria:**
- A theme toggle button (`ThemeToggle` component) is accessible in the sidebar or navbar
- Clicking it cycles through: System → Light → Dark (or Dark → Light)
- The selected theme is persisted in `localStorage` and survives page reloads
- The Dark Observatory design system (`#0A0A0F` background, indigo-500→violet-500 primary) is the default dark theme
- The toggle does not cause a flash of unstyled content (FOUC) — `ThemeProvider` wraps the app root

---

## 20. Support

### US-SUPPORT-01: Contact support
**As a** user encountering a problem,  
**I want to** send a support message from within the app,  
**so that** I can get help without leaving to an external email client.

**Acceptance Criteria:**
- Support chat widget (`SupportChat` component) is accessible site-wide
- Clicking it opens a contact form with: subject, message body, and Send button
- On submit, calls `POST /api/support/contact`
- The endpoint sends the message to the support team email (via Resend or equivalent)
- On success: toast "Message sent! We'll get back to you shortly."
- On error: toast with the error message
- The form is accessible to both authenticated users (email pre-filled) and unauthenticated visitors

---

## 21. Cookie Consent

### US-COOKIE-01: Manage cookie preferences
**As a** visitor or user,  
**I want to** choose which cookies to accept,  
**so that** I can control my privacy in accordance with GDPR.

**Acceptance Criteria:**
- A `CookieBanner` appears on first visit for unauthenticated users and for users who have not yet made a choice
- Banner offers: "Accept All" and "Reject Non-Essential" buttons
- Accepting sets a `cookie_consent` key in `localStorage` with value `"accepted"`
- Rejecting sets it to `"rejected"`
- Once a choice is made, the banner does not appear again on subsequent visits
- `ConsentAnalytics` component gates Vercel Analytics behind the user's consent choice — analytics only run if consent = `"accepted"`
- Clicking "Manage Preferences" (optional) opens a granular cookie settings modal

---

## 22. Mobile Navigation

### US-MOBILE-01: Navigate the app on mobile
**As a** user on a small-screen device,  
**I want to** access all navigation items without a cluttered layout,  
**so that** I can use the app comfortably on my phone.

**Acceptance Criteria:**
- On screens narrower than `lg` breakpoint (< 1024px), the desktop sidebar is hidden
- A hamburger menu button appears in the top-left of the dashboard layout
- Tapping it opens a `MobileSidebar` (sheet/drawer sliding from the left)
- The mobile sidebar contains all the same links as the desktop sidebar: Dashboard, Analyze, Reports, Monitors, Settings
- Tapping any link navigates to the page and closes the drawer automatically
- The `ThemeToggle` and credits badge are also accessible within the mobile sidebar

---

---

## 26. Agency Lead Widget

### US-WIDGET-01: Configure the embeddable lead capture widget
**As an** Agency plan user,  
**I want to** configure and embed a lead capture widget on my clients' websites,  
**so that** visitors can request a website analysis report directly from my agency's site.

**Acceptance Criteria:**
- Widget Settings section is visible on `/settings` for Agency+ plan users only
- Free/Pro users see a locked preview with an "Upgrade to Agency" CTA
- Agency users see:
  - Their widget key (`wk_live_` + 32 hex chars) displayed in a read-only field
  - Appearance controls: button text input, button colour picker (hex), position selector (bottom-right / bottom-left / top-right / top-left), "Show email field" checkbox
  - A **Save** button that calls `PATCH /api/widget/key` with the new settings
  - A **Regenerate key** button that generates a fresh `wk_live_…` key
  - Three embed code panels (JS snippet, hosted page URL, iframe) computed live from the current settings
  - Copy-to-clipboard button on each code panel

---

### US-WIDGET-02: Embed the widget on an external website
**As an** agency customer whose site has the widget installed,  
**I want to** see a "Get a free analysis" button on the site,  
**so that** I can request a report without navigating away to the analyzer app.

**Acceptance Criteria:**
- The JS snippet (copy from Widget Settings) is a `<script>` tag pointing to the hosted widget JS
- On load the script appends a floating button to the page at the configured position
- Clicking the button opens a lightweight modal with: URL input (pre-filled with `window.location.href`), optional email field (shown when `showEmail = true`), and a "Analyze" submit button
- Submitting calls `POST /api/widget/analyze` with `{ widgetKey, url, email? }`
- A success state is shown ("Your report is on its way!")
- Widget appearance (button colour, label) matches the Agency user's saved settings

---

### US-WIDGET-03: Submit a URL via the public widget endpoint
**As a** visitor triggering a widget analysis,  
**I want to** submit a URL for analysis via the widget,  
**so that** a report is generated on my behalf.

**Acceptance Criteria:**
- `POST /api/widget/analyze` is a public endpoint — no user session required
- Request body: `{ widgetKey: "wk_live_…", url: "https://…", email?: "…" }`
- The widget key is looked up in `user_settings` (plaintext, not hashed) using the service-role client (bypasses RLS)
- If the key is not found → 404
- If the Agency user has 0 credits → 402
- If the URL is invalid → 400
- A bare domain (e.g. `example.com`) is automatically prefixed with `https://`
- On success → 202 with `{ analysisId, reportUrl }` where `reportUrl` points to the public share URL
- Rate limiting: 10 submissions per hour per widget key (via Upstash Redis)
- CORS headers included on all responses (widget is embedded cross-origin)

---

### US-WIDGET-04: View captured leads on the Leads dashboard
**As an** Agency user whose widget has received submissions,  
**I want to** see a list of all captured leads,  
**so that** I can follow up with prospects who requested analyses.

**Acceptance Criteria:**
- Leads dashboard is available at `/leads`, linked from the sidebar (visible only to Agency+ users)
- Unauthenticated access or non-Agency access redirects appropriately
- The leads table shows: submission date/time, email (if provided), URL submitted, analysis status (pending / completed / failed), link to the report
- Leads are sorted newest first
- Empty state: "No leads yet. Share your widget embed code to start capturing leads."
- `GET /api/leads` powers the list (authenticated, Agency+ only)

---

## 27. Pricing Page

### US-PRICING-01: View standalone pricing page
**As a** visitor evaluating the product,  
**I want to** see a dedicated pricing page with all plan details,  
**so that** I can compare plans and choose the right one before signing up.

**Acceptance Criteria:**
- Pricing page is available at `/pricing` (no auth required)
- Page navigation matches the marketing site nav: Features, Pricing (active), Changelog, API Docs, Sign in, Get started free
- Four plan cards are shown: **Free**, **Pro** ($29/mo), **Agency** ($99/mo), **Compliance** ($249/mo)
- Each card shows: plan name, price, billing period, headline feature list, and a CTA button
- Compliance plan card has an emerald "EAA ready" badge

---

### US-PRICING-02: Toggle between monthly and annual billing
**As a** visitor on the pricing page,  
**I want to** switch between monthly and annual billing to see the discounted annual prices,  
**so that** I can decide whether annual billing is worth it for my budget.

**Acceptance Criteria:**
- A "Monthly / Annual" toggle is shown above the plan cards; Monthly is selected by default
- Switching to Annual updates all paid plan prices to reflect 20% off:
  - Pro: $29 → $23/mo (billed annually)
  - Agency: $99 → $79/mo (billed annually)
  - Compliance: $249 → $199/mo (billed annually)
- Prices update without a page reload (client-side state)
- The monthly equivalent is shown when annual is selected

---

### US-PRICING-03: View full feature comparison table
**As a** visitor who wants to understand exactly what each plan includes,  
**I want to** see a detailed side-by-side comparison of all features across all plans,  
**so that** I can identify which plan has the features I need.

**Acceptance Criteria:**
- "Full feature comparison" table is shown below the plan cards
- Rows are grouped by category (Core, Analysis, Reporting, Team & API, Compliance)
- Each cell shows: ✓ (included), ✗ (not included), or a string value (e.g. "100 credits/mo")
- Plan escalation invariants are maintained: a feature available on Pro is also available on Agency; available on Agency → available on Compliance
- At least 21 rows covering all differentiating features

---

### US-PRICING-04: Read FAQ and open auth modal from pricing
**As a** visitor with questions about the plans,  
**I want to** find answers to common questions and start sign-up without leaving the page,  
**so that** there's no friction between decision and account creation.

**Acceptance Criteria:**
- "Frequently asked questions" section shown below the comparison table
- FAQ items are expandable accordion items (click to expand, click again to collapse)
- At least 4 FAQ items covering: what counts as one audit, annual billing, team members, cancellation
- CTA buttons throughout the page ("Get started free", plan-specific "Get started") open an `AuthModal` with the signup tab pre-selected
- The page has `<script type="application/ld+json">` with Schema.org `SoftwareApplication` + 4 `Offer` objects for SEO
- OG image is generated at `/pricing/opengraph-image` (Next.js `ImageResponse`) showing all 4 plan prices

---

## 28. Changelog Page

### US-CHANGELOG-01: View product release history
**As a** user or visitor,  
**I want to** see a timeline of all features, improvements, and fixes that have been shipped,  
**so that** I can understand what's new and how the product has evolved.

**Acceptance Criteria:**
- Changelog page is available at `/changelog` (no auth required)
- Page layout: top nav (matching marketing site), hero with "What's new" heading, vertical timeline, footer
- Each release entry shows: tag badge (Feature / Improvement / Fix / Security) with matching icon and colour, date (YYYY-MM-DD), version number, title, summary paragraph, bullet list of shipped items
- Timeline line connects all entries visually (left-aligned vertical line with dots)
- Releases are sorted newest-first (enforced by `src/data/changelog.ts`)
- Tags are colour-coded: Feature = indigo, Improvement = violet, Fix = amber, Security = red
- OG image is generated at `/changelog/opengraph-image` showing the 3 most recent release titles
- Sitemap includes `/changelog` with `lastModified` set to the date of the most recent release

---

### US-CHANGELOG-02: Data integrity — release data as a single source of truth
**As a** developer maintaining the changelog,  
**I want to** manage all release data in a single file,  
**so that** the page, sitemap, and any future integrations always show consistent data.

**Acceptance Criteria:**
- All release data lives in `src/data/changelog.ts` as the `RELEASES` array (pure TypeScript, no server-only imports)
- `src/app/changelog/page.tsx` imports from `@/data/changelog` and re-exports `RELEASES`
- `src/app/sitemap.ts` imports `RELEASES[0].date` for the changelog `lastModified` — no manual date needed
- Each release must have: `version` (string), `date` (ISO YYYY-MM-DD), `tag` (Feature | Improvement | Fix | Security), `title`, `summary`, `items[]` (min 2 items)
- All versions are unique — no duplicate version numbers
- Dates are strictly sorted newest-first

---

---

## 29. Connected Sites

### US-SITES-01: Link a website for continuous monitoring
**As a** developer using Connected Sites,  
**I want to** link my website so WebScore can monitor it continuously,  
**so that** I get ongoing telemetry from real users without running manual audits.

**Acceptance Criteria:**
- Create form at `/sites/new` accepts an origin URL and optional display name
- On creation, the `ws_site_…` ingestion key is shown exactly once (copy button provided)
- Site appears in the list at `/sites` with verification status and last heartbeat timestamp
- Verification can be completed via DNS TXT record or meta tag

### US-SITES-02: View real web vitals from actual users
**As a** developer using Connected Sites,  
**I want to** see real web vitals (LCP, CLS, INP) from my actual users,  
**so that** I can understand real-world performance beyond lab scores.

**Acceptance Criteria:**
- Web Vitals tab at `/sites/[id]` shows p50, p75, p90 aggregates for LCP, CLS, INP, FCP, TTFB
- Each metric shows colour-coded status: good (green), needs improvement (amber), poor (red)
- Thresholds match Core Web Vitals specification (LCP good: <2.5s, CLS good: <0.1, INP good: <200ms)

### US-SITES-03: Discover which routes are crawled and indexed
**As a** developer using Connected Sites,  
**I want to** see which routes are being crawled and indexed,  
**so that** I can identify pages with noindex issues, canonical mismatches, or missing metadata.

**Acceptance Criteria:**
- Routes tab shows deduplicated observed URL paths with search and pagination
- Indexing tab shows per-route indexability assessment with specific warnings
- Warnings include: noindex detected, canonical mismatch, missing meta description, missing title

---

## 30. Fix Requests

### US-FIXREQ-01: Send a structured fix request from a finding
**As a** developer using Fix Requests,  
**I want to** send a structured fix request to my client from any WebScore finding,  
**so that** the client receives clear, actionable information rather than a raw score.

**Acceptance Criteria:**
- "Create Fix Request" button available from any report finding, accessibility issue, or error issue
- Create form at `/fix-requests/new` with: request type, title, description, severity, due date, source reference
- Six request types available: audit, fix, estimate, review, verification, consultation

### US-FIXREQ-02: Deliver via professional email
**As a** developer using Fix Requests,  
**I want to** my client to receive a professional email with the issue details and severity,  
**so that** the communication looks polished and the client knows what action is needed.

**Acceptance Criteria:**
- Email channel available in the Send dialog
- Email contains: issue title, severity badge, description, recommended action, expiry date
- HTML email is XSS-escaped (no injected markup from user content)
- Pro+ plan required — Free users see upgrade banner on `/fix-requests`

### US-FIXREQ-03: Track whether the fix was implemented and verified
**As a** developer using Fix Requests,  
**I want to** track whether the fix was implemented and verified,  
**so that** I have a clear audit trail of what was fixed and when.

**Acceptance Criteria:**
- Fix Request detail at `/fix-requests/[id]` shows current status with state-machine-driven action buttons
- Activity tab shows full timeline of all status changes and events
- Status transitions validated server-side against `FIX_REQUEST_TRANSITIONS` map
- Verification flow: `verification_requested` → `verifying` → `verified` or back to `in_progress`

### US-FIXREQ-04: Share a secure external link for recipients without accounts
**As a** developer using Fix Requests,  
**I want to** share a secure external link so the developer can see the issue without creating an account,  
**so that** there's no friction for the recipient and no unnecessary access to my account.

**Acceptance Criteria:**
- "Generate link" button in the Delivery tab creates a scoped external token
- Public page at `/fix-request/[token]` renders the issue without requiring auth
- Link has an expiry date and can be revoked (Revoke button removes access immediately)
- `isPrivate: true` evidence items are not exposed on the public page
- Expired or revoked token returns HTTP 410

---

## 31. Runtime Error Monitoring

### US-ERRORS-01: Install a lightweight JS snippet that captures real browser errors
**As a** developer using Runtime Error Monitoring,  
**I want to** install a lightweight JS snippet that captures real browser errors from my site,  
**so that** I can see what JavaScript errors real users are encountering.

**Acceptance Criteria:**
- Error Project created at `/errors/new` with name, origin, and environment fields
- Ingestion key (`ws_err_…`) shown exactly once on creation with copy button
- SDK snippet (`<script>` tag with `data-project-key`) available on the Installation tab
- SDK is served from `GET /api/error-monitoring/sdk` as a self-contained IIFE (no external dependencies)
- SDK file size is suitable for production use (no bundling of large frameworks)

### US-ERRORS-02: See errors grouped into actionable issues
**As a** developer using Runtime Error Monitoring,  
**I want to** errors grouped into actionable issues, not individual events,  
**so that** I can focus on fixing the root cause rather than sifting through thousands of raw events.

**Acceptance Criteria:**
- Issue list at `/errors/[id]` shows grouped issues with event count, first seen, last seen, status badge
- Issues are grouped by deterministic fingerprint (exception type + normalized message + top stack frame)
- Issue detail at `/errors/[id]/issues/[issueId]` shows stack frames, breadcrumbs, affected routes, level badge
- Status actions available: resolve, ignore, assign (assign requires Agency+ plan)

### US-ERRORS-03: Be notified when a resolved issue regresses
**As a** developer using Runtime Error Monitoring,  
**I want to** be notified when a resolved issue regresses,  
**so that** fixes that broke again don't go unnoticed.

**Acceptance Criteria:**
- When a resolved issue receives a new event, the issue status changes to a "regression" state
- Issue detail shows "regression" badge and the date of regression
- Alert policy can send email notification on regression (configurable per project)

### US-ERRORS-04: Confident that sensitive data is never captured
**As a** developer using Runtime Error Monitoring,  
**I want to** have confidence that sensitive data (passwords, tokens, form values) are never captured,  
**so that** I can install the SDK on production without violating user privacy.

**Acceptance Criteria:**
- SDK does not capture: form field values, input keystrokes, DOM text, request/response bodies
- URL scrubbing removes sensitive query parameters before capture: `token`, `password`, `auth`, `jwt`, `key`, `secret`, `session`, `credentials`, `api_key`, and equivalents
- Privacy behaviour is documented in the Installation tab
- No sensitive parameters appear in captured event URLs in the issue detail view

### US-ERRORS-05: Create a fix request directly from an error issue
**As a** developer using Runtime Error Monitoring,  
**I want to** create a fix request directly from an error issue,  
**so that** I can send the issue to the responsible developer without duplicating information.

**Acceptance Criteria:**
- "Create Fix Request" button on the issue detail page
- Fix Request draft pre-populated with: error title, severity, stack trace excerpt, affected routes, environment
- Delivered via any available Fix Request channel (email, external link, etc.)
- Fix Request appears in `/fix-requests` list linked back to the error issue

---

---

## US-32: Accessibility End-to-End Workflow

> **Language constraint for all acceptance criteria:** NEVER assert "guaranteed legal compliance", "immunity from lawsuits", "certification by a government authority", or "100% compliant". ALWAYS use "Regional accessibility risk assessment", "Accessibility readiness", "Technical conformance evidence", "Potential compliance gaps", "Risk-reduction workflow".

### US-ACC-01: Create an accessibility profile
**As a** developer,  
**I want to** create an accessibility profile for my site,  
**so that** I can track regional accessibility risk assessment for that site over time.

**Acceptance Criteria:**
- `/accessibility/new` presents a 9-step wizard (site URL, jurisdictions, org type, standards, pages, journeys, schedule, contacts, confirm)
- Free plan users see a plan gate with an upgrade prompt
- Supported jurisdictions are selectable; planned jurisdictions are displayed but disabled with an explanatory tooltip
- On completion, profile is saved and user is redirected to `/accessibility/[id]`
- Profile detail shows 8 tabs: Overview, Assessments, Findings, Manual Checks, Journeys, Statement, Reports, Settings

---

### US-ACC-02: Select target jurisdictions and standards
**As a** compliance manager,  
**I want to** select target jurisdictions and applicable standards,  
**so that** assessments reflect the requirements relevant to my site and organization.

**Acceptance Criteria:**
- Available jurisdictions include: EU EAA, EU Public Sector Directive, UK PSBAR, US Section 508, US ADA Title II
- Each jurisdiction shows its enforcement standard (e.g. EN 301 549, WCAG 2.1 AA) as a default recommendation
- User can override the default standard selection
- Standards stored per profile; used in all assessment reports and statement drafts for that profile

---

### US-ACC-03: Run a baseline assessment
**As a** QA engineer,  
**I want to** run a baseline assessment on my accessibility profile,  
**so that** I have technical conformance evidence for the tested scope.

**Acceptance Criteria:**
- "Start Assessment" button on profile page triggers `POST /api/accessibility/profiles/[id]/assess`
- Response 202 Accepted; assessment record created immediately
- In-scope pages queued as jobs; each page processed by the analysis engine
- Assessment status transitions: `draft → queued → running → completed`
- Attempting to start a second assessment while one is running returns 409 Conflict
- On completion, page coverage %, journey coverage %, and manual coverage % are displayed
- Risk level shown with scope note (e.g. "Based on 14 of 20 tested pages")

---

### US-ACC-04: View normalised findings grouped by rule and page
**As a** developer,  
**I want to** see normalised findings grouped by rule and page,  
**so that** I can prioritise remediation based on what has the most impact.

**Acceptance Criteria:**
- Findings tab on assessment detail lists all findings from `GET /api/accessibility/assessments/[id]/findings`
- Filterable by `status`, `impact`, `wcag_level`
- Each finding shows: rule ID, plain-English description, WCAG criteria, POUR principle, impact level, affected selector, html_excerpt (tags stripped, max 500 chars)
- Regional relevance badge shows which jurisdictions are affected
- Findings with same fingerprint from prior assessments are linked (not duplicated)

---

### US-ACC-05: Complete manual accessibility checks
**As a** reviewer,  
**I want to** complete manual accessibility checks and record evidence,  
**so that** my assessment covers what automated tools cannot detect.

**Acceptance Criteria:**
- Manual Checks tab shows all 22 catalog items loaded from the database (not hardcoded)
- Each item shows: check title, category, WCAG criteria, current status, guidance note
- Reviewer can set status to: `pass`, `fail`, `not_applicable`, `needs_expert_review`
- Evidence notes can be attached (Agency+ plans)
- No endpoint exists for bulk setting all checks to `pass` (by design)
- Manual coverage % updates as checks are completed

---

### US-ACC-06: Mark a finding resolved and trigger verification
**As a** developer,  
**I want to** mark a finding as resolved and trigger a verification step,  
**so that** the fix is confirmed before the finding is closed.

**Acceptance Criteria:**
- Finding status can be advanced: `open → in_progress → resolved → verification_required → verified`
- Each transition validated server-side; invalid transitions return 422 with `{ "error": "invalid_transition" }`
- `accepted_risk` and `not_applicable` require a `reason` field (400 if absent)
- Status history recorded in activity log with timestamp and actor

---

### US-ACC-07: Generate a draft Accessibility Statement
**As a** compliance manager,  
**I want to** generate a draft Accessibility Statement,  
**so that** I have a starting point for publication that reflects my site's actual test results.

**Acceptance Criteria:**
- "Generate Statement" available for Agency+ plans
- `POST /api/accessibility/profiles/[id]/statements` creates a statement draft
- Statement editor at `/accessibility/statements/[id]` shows a persistent DRAFT banner ("DRAFT — Review before publication")
- Statement content is jurisdiction-appropriate (EU EAA, UK PSBAR, US Section 508)
- Statement never contains the words "guaranteed", "immune", "certified by government", or "100% compliant"
- Each save creates a new version; prior versions accessible via version history
- Statement does not constitute legal advice; a disclaimer to this effect is always present

---

### US-ACC-08: Schedule monthly accessibility assessments
**As a** team lead,  
**I want to** schedule monthly accessibility assessments,  
**so that** regressions are detected automatically without manual intervention.

**Acceptance Criteria:**
- Profile can have a weekly or monthly schedule (Agency+ plans)
- On the due date, the queue scheduler creates an assessment automatically
- Duplicate assessments for the same profile+window are not created
- Paused profiles are skipped
- If a finding that was previously `verified` appears again, it is reopened with a "regressed" label
- Email alert sent when: new critical finding detected, coverage drops, statement review date approaching

---

### US-ACC-09: Create a Fix Request from an accessibility finding
**As a** developer,  
**I want to** create a Fix Request from an accessibility finding,  
**so that** the remediation is tracked in the Fix Request workflow and can be sent to the responsible developer.

**Acceptance Criteria:**
- "Create Fix Request" available on any finding in `open` or `in_progress` status
- Fix Request draft pre-populated from the finding: title from rule description, severity from impact, WCAG criteria, affected URL
- Fix Request appears in `/fix-requests` linked back to the accessibility finding
- Delivered via any available Fix Request channel (email, external link, webhook, etc.)

---

*Last updated: 2026-07-12 | Covers Sprints 1–17 (2,453 tests passing)*
