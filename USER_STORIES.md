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
  - LCP (Largest Contentful Paint): Good if < 2500 ms
  - FID (First Input Delay): Good if < 100 ms
  - CLS (Cumulative Layout Shift): Good if < 0.1
  - TTFB (Time to First Byte): Good if < 800 ms
  - Each metric shows a "✓ Good" or "✗ Needs work" badge

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
- If the credit was consumed before the failure, a `refund_credit()` DB call is made — the user's balance is restored
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
- Clicking the invite link navigates to `/invite/{token}` which calls `POST /api/team/accept`
- If the user is not logged in, they are prompted to log in or sign up first
- After authentication, the invite is accepted: `status = 'active'`, `member_id` set, `accepted_at` set
- The user can now see the team owner's analyses in their reports list
- If the token is invalid or already used: error page "This invitation is invalid or has expired"
- If the invited email doesn't match the logged-in account email: error "This invitation was sent to a different email address"

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

*Last updated: 2026-05-25 | Covers Sprints 1–8 + post-sprint additions*
