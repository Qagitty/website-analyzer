# WebAnalyzer — Product Guide

> Everything you need to know about what WebAnalyzer does, who it's for, and how to use it.

---

## What is WebAnalyzer?

WebAnalyzer is a SaaS tool that automatically audits websites and delivers clear, actionable reports. You paste in a URL, and within a minute you get a complete health check covering performance, SEO, accessibility, best practices, and AI readiness — plus a prioritised list of exactly what to fix and how.

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

- **Performance** — Lighthouse scores (Performance, Best Practices, SEO), plus Core Web Vitals: LCP, FID, CLS, TTFB
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
Instead of auditing only the homepage, WebAnalyzer can crawl up to 50 internal pages (depending on plan) and aggregate the results into one report.

### Scheduled Monitoring
Set up monitors on sites you care about. WebAnalyzer re-analyses them automatically on your chosen schedule (daily, weekly, or specific days/times in your timezone) and sends alerts if scores drop.

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
On Agency and Compliance plans, PDF reports carry your branding (logo, colours) — not WebAnalyzer's. Suitable for client-facing deliverables.

---

## Plans and pricing

| | Free | Pro | Agency | Compliance |
|--|------|-----|--------|------------|
| **Price** | $0/mo | $29/mo | $99/mo | $249/mo |
| **Audits/month** | 3 | 100 | Unlimited | Unlimited |
| **Monitored sites** | — | 5 | 50 | 100 |
| **Multi-page crawl** | — | 10 pages | 50 pages | 50 pages |
| **Competitor comparisons** | — | 1 | 3 | 3 |
| **PDF export** | — | ✓ | ✓ | ✓ |
| **Compliance PDF** | — | — | — | ✓ |
| **White-label PDF** | — | — | ✓ | ✓ |
| **API access** | — | — | 1,000 req/day | 1,000 req/day |
| **Webhooks** | — | — | ✓ | ✓ |
| **Team members** | — | — | 10 | 10 |
| **Remediation board** | — | ✓ | ✓ | ✓ |
| **Email alerts** | — | ✓ | ✓ | ✓ |
| **Public sharing** | — | ✓ | ✓ | ✓ |

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

From the monitor's details page you can:
- See the full **run history** (every scheduled and manual run)
- View the **score trend chart** over time
- See any **incidents** (detected score regressions)
- Click **Run now** to trigger an immediate re-analysis
- Pause or resume the monitor at any time

### 6. Track remediation (Pro and above)
- Go to **Compliance → Remediation**
- Issues from your audits appear as cards
- Move them through stages: Open → In Progress → Resolved
- The history table shows what was fixed and when — useful for compliance audits

### 7. Use the API (Agency and above)
- Go to **Settings → Developers** and create an API key
- Use it to trigger audits and retrieve reports from your own code:

```bash
# Start an audit
curl -X POST https://website-analyzer-eta.vercel.app/api/v1/analyze \
  -H "Authorization: Bearer wa_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yoursite.com"}'

# List your analyses
curl https://website-analyzer-eta.vercel.app/api/v1/analyses \
  -H "Authorization: Bearer wa_live_YOUR_KEY"

# Get a specific report
curl https://website-analyzer-eta.vercel.app/api/v1/reports/ANALYSIS_ID \
  -H "Authorization: Bearer wa_live_YOUR_KEY"
```

### 8. Set up webhooks (Agency and above)
- Go to **Settings → Developers → Webhooks**
- Enter any HTTPS URL (paste a Slack webhook URL to get notifications in a channel)
- WebAnalyzer will POST a signed payload when each analysis completes

---

## Understanding your scores

All scores are on a **0–100 scale**:

| Score | Meaning |
|-------|---------|
| 80–100 | Good — no urgent action needed |
| 50–79 | Needs improvement — visible impact on users |
| 0–49 | Poor — significant issues affecting performance, ranking, or accessibility |

**AI Readiness** is scored separately and reflects how well the site is structured for AI-powered tools — clear headings, structured data, readable content, consistent navigation.

---

## Credits explained

Each audit costs **1 credit**. Credits reset on the 1st of every month.

- Free: 3 credits/month
- Pro: 100 credits/month
- Agency / Compliance: effectively unlimited (99,999/month fair use)

If an audit fails due to a server error (not a problem with your site), the credit is automatically refunded.

Monitors use 1 credit per scheduled run. If you run out of credits mid-month, the monitor pauses automatically and resumes when credits reset.

---

## Privacy and security

- **Your data is yours** — reports are private by default and only visible to you and your team
- **Shared reports** are accessible via an unguessable link — you can revoke sharing at any time
- **API keys** are encrypted with AES-256-GCM and only shown once at creation
- **Webhook payloads** are signed with HMAC-SHA256 so you can verify they came from WebAnalyzer
- **SSRF protection** — the analyser blocks private IP ranges and cloud metadata endpoints so it can only analyse real public websites
- Reports are stored securely in Supabase with Row-Level Security — no one can access another user's data

---

## Frequently asked questions

**Does it work on password-protected or localhost sites?**
No — the analyser can only reach publicly accessible URLs on the internet.

**How long does an audit take?**
Typically 30–90 seconds. Complex pages with many resources may take up to 2 minutes.

**Can I analyse multiple pages at once?**
Yes — on Pro and above you can enable multi-page crawl. The analyser follows internal links and aggregates findings across up to 10 (Pro) or 50 (Agency/Compliance) pages.

**What happens if I run out of credits?**
You can't start new audits until credits reset on the 1st of the month, or until you upgrade. Active monitors pause automatically and resume when credits are available.

**Is the AI analysis done by a real AI?**
Yes — AI Insights are generated by Claude (Anthropic's AI). It receives the raw audit data and writes plain-language recommendations and impact estimates.

**Can I white-label reports for clients?**
Yes — on Agency and Compliance plans. Upload your logo and set your brand colours in Settings → Branding. All exported PDFs will use your branding.

**How do alerts work for monitors?**
When a scheduled monitor run detects that a score has dropped by more than your threshold (default: 10 points), you receive an email listing which metrics dropped, by how much, and a link to the full report. You can also receive alerts via webhook or Slack.

---

## Getting help

- **In-app support** — go to any page and use the support chat
- **Email** — contact form available at `/support`
- **API docs** — available at `/docs` inside the app
