import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// POST /api/csp-report
// Receives Content Security Policy violation reports sent automatically by
// browsers when the CSP report-uri directive fires.  Violations are forwarded
// to Sentry as breadcrumbs so they appear alongside error traces.
export async function POST(req: NextRequest) {
  try {
    // Browsers send CSP reports as application/csp-report (JSON-encoded), not
    // application/json, so we read the raw text and parse manually.
    const text = await req.text().catch(() => '');
    if (!text) return new NextResponse(null, { status: 204 });
    const body = JSON.parse(text);

    const report = body['csp-report'] ?? body;

    const details = {
      documentUri: report['document-uri'],
      violatedDirective: report['violated-directive'],
      blockedUri: report['blocked-uri'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      userAgent: req.headers.get('user-agent'),
    };

    // Always log to console (visible in Vercel function logs)
    console.warn('[csp-violation]', details);

    // Forward to Sentry when configured — violations show up as breadcrumbs
    // on the Issues page so you can correlate them with real errors.
    Sentry.addBreadcrumb({
      category: 'csp',
      message: `CSP violation: ${report['violated-directive'] ?? 'unknown'}`,
      data: details,
      level: 'warning',
    });

    // Capture as a standalone event so it's searchable even without a linked error
    Sentry.captureMessage(
      `CSP violation — ${report['violated-directive'] ?? 'unknown directive'}`,
      { level: 'warning', extra: details }
    );
  } catch {
    // Swallow — never let CSP report errors surface to the browser
  }

  return new NextResponse(null, { status: 204 });
}
