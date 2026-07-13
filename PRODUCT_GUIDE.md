# WebScore — Product Guide

> Everything you need to know about what WebScore does, who it's for, and how to use it.

---

## What is WebScore?

WebScore is a SaaS tool that automatically audits websites and delivers clear, actionable reports. You paste in a URL, and within a minute you get a complete health check covering performance, SEO, accessibility, best practices, and AI readiness — plus a prioritised list of exactly what to fix and how.

Think of it as a mechanic's diagnostic tool for websites. Instead of guessing why a site feels slow or ranks poorly, you run an audit and get the diagnosis in plain language with specific fixes attached.

---

## Who is it for?

| Role | How they use it |
|------|----------------|
| **Freelance developers** | Audit client sites before and after a build to prove value |
| **QA engineers** | Catch regressions, accessibility violations, and console errors automatically |
| **Digital agencies** | Audit dozens of client sites, generate white-label PDF reports, monitor for score drops |
| **Small business owners** | Understand why their site underperforms without needing a developer |
| **Compliance teams** | Track WCAG 2.1 AA conformance, generate audit trails and compliance PDFs |

---

## Core features

### Website Audit
Run a full health check on any public URL. The audit covers:

- **Performance** — Lighthouse scores (Performance, Best Practices, SEO), plus Core Web Vitals: LCP, INP, CLS, TTFB
- **Accessibility** — WCAG 2.1 violations detected automatically, explained in plain English with code examples
- **SEO** — Title tags, meta descriptions, heading structure, crawlability
- **Console errors** — JavaScript errors grouped by type, with root cause analysis
- **AI Readiness** — How well the site is structured for LLM-powered tools like ChatGPT, Perplexity, and AI search agents
- **AI Insights** — Claude AI analyses the results and writes prioritised recommendations with estimated impact

### Fix Roadmap (Action Plan)
Every report includes a prioritised action plan — not just a list of issues, but a step-by-step guide on what to fix first for the biggest improvement. Issues are grouped by effort vs. impact.

### Competitor Comparison
Compare your site against a competitor side by side. See exactly where you lead, where you lag, and what the gap means in practical terms.

### Multi-page Crawl
Instead of auditing only the homepage, WebScore can crawl up to 50 internal pages (depending on plan) and aggregate the results into one report.

### Scheduled Monitoring
Set up monitors on sites you care about. WebScore re-analyses them automatically on your chosen schedule (daily, weekly, or specific days/times in your timezone) and sends alerts if scores drop. Manage monitored pages with bulk enable/disable/remove actions. View detailed run history at `/monitors/[id]/runs/[runId]`.

### Remediation Board
Track accessibility and compliance issues through a Kanban-style workflow — open → in progress → resolved. Useful for teams who need an audit trail of what was fixed and when.

### Export options
Every report can be exported as:
- **PDF** — standard full report
- **Compliance PDF** — structured for WCAG audit submissions
- **DOCX** — editable Word document
- **XLSX** — spreadsheet of all findings
- **Markdown** — for documentation systems
- **JSON** — raw data for integrations

### Public sharing
Share any report via a public link — no login required for the recipient. Useful for sending results to a client or stakeholder.

### Developer API
Automate audits from your own tools, CI pipelines, or scripts. Use an API key to trigger analyses and retrieve reports programmatically.

### Webhooks
Receive a POST request to any URL when an analysis completes or a monitor detects a score drop. Supports Slack natively.

### Team collaboration
Invite team members to your account. Everyone shares the same credits and report history. Up to 10 members on the Agency plan.

### White-label reports
On Agency and Compliance plans, PDF reports carry your branding (logo, colours) — not WebScore's. Suitable for client-facing deliverables.

---

## Connected Sites (Sprint 14)

Connected Sites lets you link your verified customer websites to WebScore for ongoing passive monitoring. Unlike scheduled analysis (which re-runs a full audit), Connected Sites collects continuous telemetry from real visitors via a lightweight JS snippet.

### How it works
1. Create a Connected Site in `/sites` — a unique site key (`ws_site_…`) is generated and shown once
2. Install the JS snippet on your website:
   ```html
   <script
     src="https://webanalyzer.app/api/site-connect/v1/script"
     data-site-key="ws_site_..."
     defer crossorigin="anonymous">
   </script>
   ```
3. Verify ownership via DNS TXT record or `<meta>` tag
4. WebScore begins collecting telemetry from real user sessions

### What is collected
- **Web Vitals** — LCP, CLS, INP, FCP, TTFB from real user sessions (p50/p75/p90 aggregates)
- **Route discovery** — which URL paths are visited and how often
- **Indexing checks** — noindex tags, canonical mismatches, missing meta descriptions per route

### Dashboard tabs (at `/sites/[id]`)
| Tab | Content |
|-----|---------|
| Overview | Verification status, last heartbeat, site key info |
| Installation | Framework-specific code snippets, verification instructions |
| Web Vitals | p50/p75/p90 per metric with good/needs-improvement/poor colour coding |
| Routes | Deduplicated observed routes with search and pagination |
| Indexing | Per-route indexability warnings: noindex, canonical issues, missing metadata |
| Settings | Origin URL, key rotation with 24-hour grace period |

### Verification methods
- **DNS TXT record** — add `webanalyzer-verify=<token>` to your domain's DNS
- **Meta tag** — add `<meta name="webanalyzer-verify" content="<token>">` to your `<head>`

---

## Fix Requests (Sprints 10 + 15)

Fix Requests provide a structured workflow to communicate identified issues to developers or clients, track their resolution, and verify fixes.

### What is a Fix Request?
A Fix Request is a structured task created from any WebScore finding (accessibility issue, performance problem, SEO gap, console error, etc.) that can be sent to a developer or external party through multiple channels, tracked through a 17-status lifecycle, and verified once resolved.

### Request types
| Type | When to use |
|------|------------|
| `audit` | Share an audit report with someone |
| `fix` | Ask a developer to fix a specific issue |
| `estimate` | Request a time/cost estimate for a fix |
| `review` | Request a review of implemented changes |
| `verification` | Verify that a previously reported issue is fixed |
| `consultation` | Schedule a discussion about findings |

### Source adapters (10 adapters)
Fix Requests can be created from any WebScore module: performance finding, accessibility issue, SEO issue, console error, LLM readiness gap, security header issue, best practices issue, monitor regression, design comparison mismatch, error monitoring issue.

### Delivery channels
| Channel | Description |
|---------|------------|
| **Email** | HTML email with issue details, severity badge, and action link |
| **WhatsApp link** | Pre-filled WhatsApp message link with summary |
| **Telegram** | Pre-filled Telegram share link |
| **Internal assignment** | Assign to a team member (Agency+ only) |
| **Webhook** | HMAC-signed JSON payload to any endpoint (Agency+ only) |
| **External link** | Scoped, expiring, revocable public link — recipient sees the issue without creating an account |

### State machine
Fix Requests move through 17 statuses: `draft` → `ready` → `sending` → `sent` → `acknowledged` → `in_progress` → `in_review` → `verification_requested` → `verifying` → `verified` → `closed` (plus branching states for `on_hold`, `blocked`, `rejected`, `cancelled`, `reopened`, `expired`).

### Security design
- External recipients receive scoped tokens only — no direct Supabase access
- `isPrivate: true` evidence items are never exposed externally
- `internal_notes` field is stripped from all non-owner API responses
- Phone numbers and emails are consumed at delivery time and not logged
- External link tokens: 64 random hex chars, expiring, revocable, RLS-gated

### Plan entitlements
| Feature | Free | Pro | Agency | Compliance |
|---------|------|-----|--------|------------|
| Fix Requests | — | Yes | Yes | Yes |
| Email delivery | — | Yes | Yes | Yes |
| External links | — | Yes | Yes | Yes |
| Verification workflow | — | Yes | Yes | Yes |
| Webhook delivery | — | — | Yes | Yes |
| Team assignment | — | — | Yes | Yes |

---

## Runtime Error Monitoring (Sprint 16)

Runtime Error Monitoring captures real browser errors from your customer websites, groups them into actionable issues, and integrates directly with the Fix Request workflow.

### How it works
1. Create an Error Project in `/errors` — an ingestion key (`ws_err_…`) is shown once
2. Install the SDK snippet:
   ```html
   <script
     src="https://webanalyzer.app/api/error-monitoring/sdk"
     data-project-key="ws_err_..."
     data-environment="production"
     defer crossorigin="anonymous">
   </script>
   ```
3. Errors from real user sessions are captured, fingerprinted, and grouped into issues
4. Manage issues from the `/errors/[id]` dashboard; create Fix Requests from any issue

### What is captured
- Uncaught JavaScript exceptions (`window.onerror`)
- Unhandled Promise rejections (`unhandledrejection`)
- Navigation breadcrumbs (URL history leading up to the error)
- Custom events via `WebScoreErrors.captureException(error)`

### Privacy — never captured
- Passwords, form field values, or input keystrokes
- Authorization headers, cookies, or session tokens
- Request or response bodies
- DOM text or element `innerText`
- Sensitive query parameters — automatically scrubbed: `token`, `password`, `auth`, `jwt`, `key`, `secret`, `session`, `credentials`, `api_key`, and more

### Issue grouping and regression detection
Events are grouped by a deterministic fingerprint (exception type + normalized message + top stack frame). Numbers, UUIDs, and hex strings in messages are normalized so similar errors group together even with different IDs. When a resolved issue receives a new event it is automatically re-opened and flagged as a regression.

### Plan limits

| | Pro | Agency | Compliance |
|--|-----|--------|------------|
| Error projects | 1 | 5 | 20 |
| Events per period | 5,000 | 50,000 | 500,000 |
| Retention window | 7 days | 30 days | 90 days |

Free plan users cannot create Error Projects.

### Fix Request integration
From any error issue detail page, click "Create Fix Request" to open a pre-filled Fix Request draft with the error title, stack trace, affected routes, and environment pre-populated.

---

## Monitor UI updates (Sprint 13)

In addition to the core scheduling features, the Monitor dashboard now supports:

- **Bulk page actions** — select multiple pages via checkbox and enable, disable, or remove them in one action (batch API: `POST /api/monitors/[id]/pages/batch`)
- **Per-row toggle** — enable/disable individual pages with an eye-icon toggle
- **Settings tab** — configure monitor frequency, alert threshold, and notification preferences from a dedicated tab on the monitor detail page
- **Run detail page** — navigate to `/monitors/[id]/runs/[runId]` to see timing cards, the list of pages analyzed in that run, and score changes per page

---

## Plans and pricing

| | Free | Pro | Agency | Compliance |
|--|------|-----|--------|------------|
| **Price** | $0/mo | $29/mo | $99/mo | $249/mo |
| **Audits/month** | 3 | 100 | Unlimited | Unlimited |
| **Monitored sites** | — | 5 | 50 | 100 |
| **Multi-page crawl** | — | 10 pages | 50 pages | 50 pages |
| **Competitor comparisons** | — | 1 | 3 | 3 |
| **PDF export** | — | Yes | Yes | Yes |
| **Compliance PDF** | — | — | — | Yes |
| **White-label PDF** | — | — | Yes | Yes |
| **API access** | — | — | 1,000 req/day | 1,000 req/day |
| **Webhooks** | — | — | Yes | Yes |
| **Team members** | — | — | 10 | 10 |
| **Remediation board** | — | Yes | Yes | Yes |
| **Email alerts** | — | Yes | Yes | Yes |
| **Fix Requests** | — | Yes | Yes | Yes |
| **Fix Request webhooks** | — | — | Yes | Yes |
| **Fix Request team assign** | — | — | Yes | Yes |
| **Error Monitoring projects** | — | 1 | 5 | 20 |
| **Error events/period** | — | 5K / 7 days | 50K / 30 days | 500K / 90 days |
| **Connected Sites** | 1 | 5 | 50 | 100 |
| **Public sharing** | — | Yes | Yes | Yes |

No credit card required for Free. Upgrade or cancel at any time.

---

## How to use it — step by step

### 1. Create an account
Go to the site and click **Sign up**. You can register with email/password or Google. Free accounts start with 3 audits.

### 2. Run your first audit
- Click **Analyze** in the sidebar
- Paste in any public URL (e.g. `https://yoursite.com`)
- Click **Analyze** — the audit takes 30–90 seconds
- You'll be redirected to a live status page showing progress

### 3. Read your report
The report is divided into sections:

- **Overview** — overall scores at a glance
- **Performance** — Lighthouse scores and Core Web Vitals with charts
- **Accessibility** — WCAG violations, explained in plain English
- **SEO** — on-page SEO issues
- **Best Practices** — security headers, HTTPS, console errors
- **AI Readiness** — how well structured the site is for AI tools
- **AI Insights** — Claude's analysis and prioritised recommendations
- **Action Plan** — what to fix first, sorted by impact
- **Screenshots** — full-page visual of the site as analysed

### 4. Export or share
- Click **Export** to download as PDF, DOCX, XLSX, Markdown, or JSON
- Click **Share** to get a public link you can send to anyone

### 5. Set up a monitor (Pro and above)
- Go to **Monitors** in the sidebar
- Click **New Monitor**, enter the URL
- Choose a schedule: every day, every weekday, every week, every 12h
- Choose your timezone and the time of day to run
- Enable alerts — you'll get an email if the score drops by more than your threshold
- Click **Create monitor** — the first analysis runs immediately

From the monitor's detail page you can:
- See the full **run history** (every scheduled and manual run)
- View the **score trend chart** over time
- Click **Run now** to trigger an immediate re-analysis
- Use **bulk actions** to enable, disable, or remove multiple pages at once
- Access the **Settings tab** to adjust frequency, alerts, and thresholds
- Click **Details** on any run to see `/monitors/[id]/runs/[runId]` with per-page score changes

### 6. Link a Connected Site (all plans)
- Go to **Sites** in the sidebar
- Click **New Site**, enter your website's origin URL
- Copy the one-time site key (`ws_site_…`)
- Add the JS snippet to your website
- Verify ownership via DNS TXT record or meta tag
- View real user web vitals, route discovery, and indexing health from the site dashboard

### 7. Set up Error Monitoring (Pro and above)
- Go to **Errors** in the sidebar
- Click **New Project**, enter a name, origin, and environment
- Copy the one-time ingestion key (`ws_err_…`)
- Install the SDK snippet on your website
- Issues appear as real users encounter errors
- Resolve issues, and WebScore will reopen them if they regress

### 8. Send a Fix Request (Pro and above)
- From any report finding, click **Create Fix Request**
- Choose the request type (fix, audit, estimate, review, etc.)
- Fill in the details — severity, description, due date
- Choose a delivery channel — email, WhatsApp, Telegram, webhook, or external link
- Track progress in **Fix Requests** in the sidebar
- Mark as verified once the fix is confirmed

### 9. Track remediation (Pro and above)
- Go to **Compliance → Remediation**
- Issues from your audits appear as cards
- Move them through stages: Open → In Progress → Resolved
- The history table shows what was fixed and when — useful for compliance audits

### 10. Use the API (Agency and above)
- Go to **Settings → Developers** and create an API key (`wa_live_…`)
- Use it to trigger audits and retrieve reports from your own code:

```bash
# Start an audit
curl -X POST https://webanalyzer.app/api/v1/analyze \
  -H "Authorization: Bearer wa_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yoursite.com"}'

# List your analyses
curl https://webanalyzer.app/api/v1/analyses \
  -H "Authorization: Bearer wa_live_YOUR_KEY"

# Get a specific report
curl https://webanalyzer.app/api/v1/reports/ANALYSIS_ID \
  -H "Authorization: Bearer wa_live_YOUR_KEY"
```

### 11. Set up webhooks (Agency and above)
- Go to **Settings → Developers → Webhooks**
- Enter any HTTPS URL (paste a Slack webhook URL to get notifications in a channel)
- WebScore will POST a signed payload when each analysis completes

---

---

## Accessibility End-to-End Workflow (Sprint 17)

> **Language policy:** WebScore provides *regional accessibility risk assessment* — not legal compliance certification. All outputs use "Technical conformance evidence", "Potential compliance gaps", and "Risk-reduction workflow" framing. Statements are always marked "DRAFT — Review before publication". The platform never claims to provide legal advice or government-issued certification.

### Accessibility Profiles

An **Accessibility Profile** connects a site to a structured assessment context. It stores the target jurisdictions, applicable standards, organization context, and page scope — so every assessment for that site uses consistent settings.

**Creating a profile (9-step wizard at `/accessibility/new`):**
1. Site URL
2. Target jurisdictions (select supported regions — planned regions shown but disabled)
3. Organization type and sector (public/private; service categories such as Government, Education, Healthcare, Transport)
4. Standards selection (WCAG 2.1/2.2 A/AA/AAA, EN 301 549, Section 508)
5. Page scope (homepage only / important pages / all pages / custom list)
6. Critical user journeys (Registration, Login, Checkout, Payment — each with an ordered list of pages)
7. Schedule (weekly / monthly / manual only)
8. Contacts for statement and alerts
9. Review and confirm

**Plan limits:**

| Feature | Free | Pro | Agency | Compliance |
|---------|------|-----|--------|------------|
| Enabled | — | Yes | Yes | Yes |
| Profiles | 0 | 1 | 5 | 20 |
| Jurisdictions per profile | 0 | 2 | 5 | 10 |
| Pages per assessment | 0 | 20 | 100 | 500 |
| Assessments per month | 0 | 2 | 10 | 50 |
| Manual checks | — | Yes | Yes | Yes |
| Critical journeys | — | Yes | Yes | Yes |
| Statement builder | — | — | Yes | Yes |
| Evidence attachments | — | — | Yes | Yes |
| Scheduled assessments | — | — | Yes | Yes |
| Regional PDF | — | — | Yes | Yes |
| Extended audit trail | — | — | — | Yes |
| Retention days | 0 | 30 | 90 | 365 |

### Baseline Assessments

Starting an assessment (`POST /api/accessibility/profiles/[id]/assess`) queues each in-scope page as a job. The system then:

1. Fetches and analyses each page via the existing analysis engine
2. Normalises axe-core findings into deduplicated, fingerprinted records
3. Calculates page coverage %, journey coverage %, and manual coverage %
4. Computes a risk level using the 7-dimension weighted risk model

**Assessment states:** `draft → queued → running → partially_completed → completed → failed`

**Assessment types:** baseline, scheduled, manual, verification

**Coverage and risk:**
- Risk levels: Low / Moderate / High / Critical / Insufficient evidence
- Risk level always scoped to tested pages only — no claims about untested pages
- Zero completed pages → "Insufficient test coverage" (not a risk score)

### Findings

When analysis results arrive, accessibility violations are normalised into finding records with:
- `rule_id` — axe rule identifier
- `wcag_criteria` — mapped WCAG success criteria
- `wcag_level` — A, AA, or AAA
- `pour_principle` — Perceivable, Operable, Understandable, Robust
- `impact` — critical, serious, moderate, minor
- `selector` and `html_excerpt` — where the issue occurs
- `fingerprint` — SHA-256 hash of rule + page + selector (stable across assessments; used for deduplication and regression detection)
- `regional_relevance` — which of the profile's jurisdictions this finding affects

**Finding lifecycle:**

`open → in_progress → resolved → verification_required → verified`

Additional terminal states: `accepted_risk` (requires reason), `not_applicable` (requires reason). Invalid transitions are rejected server-side (422).

**Remediation:** any finding can generate a Fix Request for developer tracking.

### Manual Checks

Automated tools cannot detect all accessibility issues. The 22-item manual check catalog covers:
keyboard navigation, focus order and visibility, screen reader labels, image alt text quality, captions and audio descriptions, heading structure, form error identification, colour contrast (complex cases), motion and animation controls, timeout warnings, session management, PDF accessibility, and more.

Each check has a status: `not_started / pass / fail / not_applicable / needs_expert_review`

**Design constraint:** no bulk auto-pass is possible — each check must be reviewed individually. Evidence notes can be attached per check (Agency+ plans).

### Accessibility Statement Generator

The statement generator (`POST /api/accessibility/profiles/[id]/statements`) produces a jurisdiction-appropriate draft covering:
- Organisation and site details
- Referenced standards (WCAG 2.1/2.2, EN 301 549, Section 508, or combination)
- Known technical issues with planned resolution dates
- Manual review limitations and scope note
- Contact information for accessibility feedback
- Review date

**Every statement output:**
- Is marked "DRAFT — Review before publication" in a persistent banner
- Does not claim legal compliance, certification, or immunity from enforcement
- Does not claim 100% conformance
- Is versioned (each save creates a new version; history preserved)

### Scheduled Assessments and Regression Detection

When a profile has a weekly or monthly schedule:
- The queue scheduler creates an assessment automatically on the due date
- Duplicate assessments for the same profile+window are not created (idempotency enforced)
- Paused profiles are skipped

**Regression detection:** when a finding with a `verified` status appears with the same fingerprint in a subsequent assessment, it is reopened with a "regressed" label and an activity log entry is created.

**Alerts triggered:**
- New critical finding detected
- Coverage percentage drops compared to prior assessment
- Accessibility Statement review date approaching

---



All scores are on a **0–100 scale**:

| Score | Meaning |
|-------|---------|
| 80–100 | Good — no urgent action needed |
| 50–79 | Needs improvement — visible impact on users |
| 0–49 | Poor — significant issues affecting performance, ranking, or accessibility |

**AI Readiness** is scored separately and reflects how well the site is structured for AI-powered tools — clear headings, structured data, readable content, consistent navigation.

**Error Monitoring** issues are classified by level: `fatal`, `error`, `warning`.

---

## Credits explained

Each audit costs **1 credit**. Credits reset on the 1st of every month.

- Free: 3 credits/month
- Pro: 100 credits/month
- Agency / Compliance: effectively unlimited (99,999/month fair use)

Error Monitoring events and Connected Sites telemetry do not consume credits.
