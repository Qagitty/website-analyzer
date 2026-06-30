# Supply Chain Risk Audit — website-analyzer

**Date:** 2026-06-29
**Audited dependencies:** 37 direct (22 production, 15 dev)
**Flagged as high-risk:** 12

---

## High-Risk Dependencies

| Dependency | Version | Repo | Risk Factors | Suggested Alternative |
|---|---|---|---|---|
| **tailwindcss-animate** | ^1.0.7 | jamiebuilds/tailwindcss-animate | Unmaintained (last commit Jul 2024, 11+ months); issues disabled; Tailwind v4 compat PR open since Nov 2024 with 2 approvals but never merged; single maintainer | **tailwindcss v4 built-ins** — TW v4 ships animation utilities natively; or inline `@keyframes` with the `animate-` utilities. No drop-in package needed. |
| **exceljs** | ^4.4.0 | exceljs/exceljs | Unmaintained (last release Oct 2023, 2.5 yr gap); 794 open issues; 10+ unaddressed security CVE reports (glob command injection, uuid, tmp CVE-2026-44705, minimatch, inflight, archiver); no security policy | **xlsx** (SheetJS community edition) or **node-xlsx** for simple exports; both are actively maintained. If heavy feature use, consider **fast-xlsx**. |
| **form-data** | 4.0.5 | form-data/form-data | **Active HIGH CVE** — GHSA-hmw2-7cc7-3qxx: CRLF injection via unescaped multipart field names (CVSS 7.5); installed version 4.0.5 is in vulnerable range ≥4.0.0 <4.0.6; transitive via `@anthropic-ai/sdk → @types/node-fetch → form-data` | Upgrade `@anthropic-ai/sdk` to a version that pulls `@types/node-fetch` ≥2.6.14 (which pins form-data ≥4.0.6), or override `form-data` to `^4.0.6` in `package.json#overrides`. |
| **ws** | 8.20.1 | websockets/ws | **Active HIGH CVE** — GHSA-96hv-2xvq-fx4p: memory exhaustion DoS from tiny fragments; installed 8.20.1 is in vulnerable range ≥8.0.0 <8.21.0; runtime paths: `@supabase/realtime-js` and `openai` (websocket mode) | Add `"ws": "^8.21.0"` to `package.json#overrides` to force the patched version across all consumers. |
| **@react-pdf/renderer** | ^4.5.1 | diegomura/react-pdf | Single maintainer (Diego Muracciole; no company affiliation; 1,771 followers); 418 open issues; high-risk feature surface (PDF binary format, font parsing, image processing — historically a source of parser vulnerabilities); no security policy | **puppeteer** (via Chromium's print-to-PDF), **jsPDF** (org-backed), or **pdfmake** (more community-driven). If staying with React-based, the project has no org-backed fork. |
| **docx** | ^9.7.1 | dolanmiu/docx | Single maintainer (Dolan, Bloomberg employee; 248 followers — relatively low profile); 155 open issues; generates OOXML (complex XML/ZIP format); no org backing | **officegen** (org-owned) or **PizZip + docxtemplater** if template-based generation is sufficient; both have broader contributor bases. |
| **next-themes** | ^0.4.6 | pacocoursey/next-themes | Single maintainer (paco; no company affiliation; 3,439 followers); 66 open issues; no security policy; last push Feb 2026 | **@mui/material** theme system or inline Next.js `cookies()`-based server-side theme; alternatively the `useTheme` hook from **shadcn/ui** which is the already-used component library and doesn't rely on this package. |
| **sonner** | ^1.7.1 | emilkowalski/sonner | Single maintainer (Emil Kowalski; no company affiliation; 5,476 followers); no security policy | **react-hot-toast** (comparable popularity, org-adjacent) or **@shadcn/ui** toast primitives built on `@radix-ui/react-toast` (already a direct dep). |
| **class-variance-authority** | ^0.7.0 | joe-bell/cva | Single maintainer (Joe Bell; no company affiliation; 1,013 followers); no security policy | **tailwind-variants** (higher stars, more contributors) or inline `clsx`+`tailwind-merge` composition. Note: shadcn/ui uses CVA internally, so removal requires refactoring generated components. |
| **clsx** | ^2.1.1 | lukeed/clsx | Single maintainer (Luke Edwards; 5,047 followers — prolific); last code push Jun 2024 (~13 months); no security policy | Not urgent — clsx is 239B with a minimal attack surface. If consolidating, `tailwind-merge`'s `cn()` helper already covers the same use case. |
| **tailwind-merge** | ^2.5.4 | dcastil/tailwind-merge | Single maintainer (Dany Castillo; 183 followers — relatively low profile); no org backing; ~5,647 stars | **tailwind-variants** provides merge + variant management; or absorb the `cn()` utility pattern using `clsx` alone if strict conflict resolution isn't needed. Note: has a security policy, so this is lower risk. |
| **recharts** | ^2.13.3 | recharts/recharts | Organization-backed but 460 open issues; no security policy | Low security risk (pure rendering). If issue backlog becomes a stability concern: **Victory** (FormidableLabs, actively maintained) or **Nivo** (Plouc, well-maintained). |

---

## Counts by Risk Factor

| Risk Factor | Count |
|---|---|
| Single maintainer / individual (non-org) | 8 |
| Unmaintained (stale release or commit cadence) | 2 |
| Active CVE (currently vulnerable) | 2 |
| High-risk feature surface (PDF/OOXML generation) | 2 |
| No security contact / policy | 10 |
| Low popularity relative to project peers | 1 |

---

## Executive Summary

The project has a **moderate-to-high** supply chain risk profile. Two dependencies carry **active HIGH-severity CVEs** that are exploitable in runtime paths today: `form-data` (CRLF injection, CVSS 7.5) and `ws` (memory exhaustion DoS). Both are transitive and can be patched immediately via `package.json#overrides` without waiting for upstream releases.

The most structurally concerning dependency is **exceljs**, which has not had a release in 2.5 years despite 794 open issues — including over 10 unaddressed security vulnerability reports in its transitive dependencies. Its continued presence creates an expanding attack surface with no remediation path.

**tailwindcss-animate** has been effectively abandoned: issues are disabled, a Tailwind v4 compatibility PR with two approvals has sat unmerged for 8 months, and the maintainer has shown no activity. Since the project uses Tailwind CSS, this package is the easiest to eliminate.

Eight production dependencies are maintained by single individuals with no organizational backing. This is above average for a Next.js project of this size and represents a meaningful concentration risk: any of these maintainers being phished, bribed, or stepping away leaves the project dependent on community forks or internal patches.

---

## Recommendations

1. **Immediate (active CVEs):** Pin `form-data ^4.0.6` and `ws ^8.21.0` in `package.json#overrides`. Both fixes are available now.

2. **Short-term (remove unmaintained deps):**
   - Drop **exceljs** — replace with `node-xlsx` or SheetJS CE for any spreadsheet export features.
   - Drop **tailwindcss-animate** — Tailwind v4 animation utilities are built-in; migrate the handful of `animate-*` class usages to native TW v4 syntax.

3. **Medium-term (reduce single-maintainer concentration):**
   - Replace **next-themes** with a server-side cookie-based theme toggle (one function, no dep).
   - Replace **sonner** with the already-bundled Radix `@radix-ui/react-toast` primitive (`sonner` is a convenience wrapper over the same pattern).
   - Evaluate **@react-pdf/renderer** — PDF generation is a high-value attack target; if no org-backed alternative fits, consider isolating this in a separate Vercel serverless function with a tight Content-Security-Policy and no access to user credentials.

4. **Ongoing:** Add `npm audit` to the CI `verify` script so active CVEs are caught at merge time, not in production. The current `verify` script runs `typecheck && lint && test` but skips audit.
