import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#1a1a2e' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, color: '#6366f1' },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 32 },
  h2: { fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 8, color: '#1e1b4b' },
  h3: { fontSize: 13, fontWeight: 'bold', marginTop: 16, marginBottom: 6, color: '#312e81' },
  body: { fontSize: 11, lineHeight: 1.6, marginBottom: 8, color: '#374151' },
  bullet: { fontSize: 11, lineHeight: 1.6, marginBottom: 4, marginLeft: 16, color: '#374151' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 6 },
  tableHeader: { fontWeight: 'bold', fontSize: 10, color: '#374151' },
  tableCell: { flex: 1, fontSize: 10, color: '#6b7280' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#9ca3af', textAlign: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 16 },
  codeBlock: { fontFamily: 'Courier', backgroundColor: '#f8fafc', padding: 8, fontSize: 9, marginBottom: 8 },
});

function ProductGuidePDF() {
  return React.createElement(
    Document,
    { title: 'WebScore Product Guide', author: 'WebScore' },

    // Cover page
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        View,
        { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
        React.createElement(Text, { style: { ...styles.title, fontSize: 36, textAlign: 'center' } }, 'WebScore'),
        React.createElement(Text, { style: { ...styles.subtitle, textAlign: 'center', fontSize: 18 } }, 'Product Guide'),
        React.createElement(
          Text,
          { style: { ...styles.body, textAlign: 'center', marginTop: 16 } },
          'Automated Website Quality Analysis, Error Monitoring & Fix Workflow'
        ),
        React.createElement(
          Text,
          { style: { ...styles.body, textAlign: 'center', color: '#9ca3af', marginTop: 32 } },
          'Version 1.16.0 — July 2026'
        )
      ),
      React.createElement(Text, { style: styles.footer }, 'WebScore Product Guide — Confidential')
    ),

    // Overview page
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h2 }, 'What is WebScore?'),
      React.createElement(
        Text,
        { style: styles.body },
        'WebScore is an automated website quality analysis platform that helps developers, QA engineers, and digital agencies identify and fix performance, accessibility, SEO, and runtime error issues on their websites.'
      ),
      React.createElement(Text, { style: styles.h3 }, 'Core Capabilities'),
      ...[
        'Website Analysis — automated audits covering performance (Lighthouse), accessibility (WCAG), SEO, and console errors',
        'AI Insights — Claude-powered analysis of screenshots and technical findings with actionable recommendations',
        'Scheduled Monitoring — recurring checks with alerts when scores drop, bulk page management, run detail view',
        'Runtime Error Monitoring — capture real browser errors from customer sites, group them into issues, detect regressions',
        'Connected Sites — link verified websites for continuous telemetry: web vitals, route discovery, indexing checks',
        'Fix Requests — structured workflow to send findings to developers with 17-status tracking, 6 delivery channels',
        'Compliance — Regional Accessibility Risk Assessment across WCAG 2.1/2.2, EN 301 549, Section 508',
        'API & Webhooks — REST API with API keys, webhook delivery, Slack integration',
      ].map((item) =>
        React.createElement(Text, { style: styles.bullet, key: item }, `• ${item}`)
      ),
      React.createElement(Text, { style: { ...styles.divider } }),
      React.createElement(Text, { style: styles.h2 }, 'Plans'),
      React.createElement(
        View,
        { style: { marginVertical: 12 } },
        React.createElement(
          View,
          { style: { ...styles.tableRow, backgroundColor: '#f8fafc' } },
          React.createElement(Text, { style: { ...styles.tableCell, ...styles.tableHeader } }, 'Feature'),
          React.createElement(Text, { style: { ...styles.tableCell, ...styles.tableHeader } }, 'Free'),
          React.createElement(Text, { style: { ...styles.tableCell, ...styles.tableHeader } }, 'Pro'),
          React.createElement(Text, { style: { ...styles.tableCell, ...styles.tableHeader } }, 'Agency'),
          React.createElement(Text, { style: { ...styles.tableCell, ...styles.tableHeader } }, 'Compliance')
        ),
        ...[
          ['Monthly analyses', '3', '100', 'Unlimited', 'Unlimited'],
          ['Error Monitoring projects', '—', '1', '5', '20'],
          ['Error events/period', '—', '5,000 / 7 days', '50,000 / 30 days', '500,000 / 90 days'],
          ['Connected Sites', '1', '5', '50', '100'],
          ['Monitors', '—', '5', '50', '100'],
          ['Fix Requests', '—', 'Yes', 'Yes', 'Yes'],
          ['Fix Request webhooks', '—', '—', 'Yes', 'Yes'],
          ['API access', '—', '—', '1,000 req/day', '1,000 req/day'],
          ['Webhooks', '—', '—', 'Yes', 'Yes'],
          ['Team members', '—', '—', '10', '10'],
          ['Price', '$0/mo', '$29/mo', '$99/mo', '$249/mo'],
        ].map((row) =>
          React.createElement(
            View,
            { style: styles.tableRow, key: row[0] },
            row.map((cell, i) =>
              React.createElement(Text, { style: styles.tableCell, key: i }, cell)
            )
          )
        )
      ),
      React.createElement(Text, { style: styles.footer }, 'WebScore Product Guide — webanalyzer.app')
    ),

    // Error Monitoring page
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h2 }, 'Runtime Error Monitoring'),
      React.createElement(
        Text,
        { style: styles.body },
        'WebScore Error Monitoring captures real browser errors from your customer websites, groups them into actionable issues, and integrates with the Fix Request workflow.'
      ),
      React.createElement(Text, { style: styles.h3 }, 'Quick Start'),
      React.createElement(Text, { style: styles.body }, '1. Create an Error Project at /errors → New Project'),
      React.createElement(Text, { style: styles.body }, '2. Copy your ingestion key (ws_err_…)'),
      React.createElement(Text, { style: styles.body }, '3. Install the SDK snippet:'),
      React.createElement(
        Text,
        { style: styles.codeBlock },
        '<script\n  src="https://webanalyzer.app/api/error-monitoring/sdk"\n  data-project-key="ws_err_..."\n  data-environment="production"\n  defer crossorigin="anonymous">\n</script>'
      ),
      React.createElement(Text, { style: styles.h3 }, 'What is captured'),
      ...[
        'Uncaught JavaScript exceptions',
        'Unhandled Promise rejections',
        'Navigation breadcrumbs (URL history before the error)',
        'Custom events via WebScoreErrors.captureException()',
      ].map((item) =>
        React.createElement(Text, { style: styles.bullet, key: item }, `• ${item}`)
      ),
      React.createElement(Text, { style: styles.h3 }, 'Privacy — never captured'),
      ...[
        'Passwords, form field values, input keystrokes',
        'Authorization headers, cookies, session tokens',
        'Request/response bodies',
        'DOM text or element inner text',
        'Sensitive query parameters (auto-scrubbed: token, password, auth, jwt, key, secret, etc.)',
      ].map((item) =>
        React.createElement(Text, { style: styles.bullet, key: item }, `• ${item}`)
      ),
      React.createElement(Text, { style: styles.h3 }, 'Issue Lifecycle'),
      React.createElement(
        Text,
        { style: styles.body },
        'Events are grouped by deterministic fingerprint (exception type + normalized message + top stack frame). Issues track: first seen, last seen, event count, affected routes, and environment. When a resolved issue receives a new event it is automatically re-opened as a regression.'
      ),
      React.createElement(Text, { style: styles.h3 }, 'Fix Request Integration'),
      React.createElement(
        Text,
        { style: styles.body },
        'From any error issue detail page, click "Create Fix Request" to open a pre-filled Fix Request draft with the error title, stack trace, affected routes, and environment pre-populated. Deliver to the responsible developer via email, external link, or webhook.'
      ),
      React.createElement(Text, { style: styles.footer }, 'WebScore Product Guide — webanalyzer.app')
    ),

    // Connected Sites page
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h2 }, 'Connected Sites'),
      React.createElement(
        Text,
        { style: styles.body },
        'Connected Sites links your verified websites to WebScore for continuous passive monitoring via a lightweight JS snippet. Unlike scheduled analysis, Connected Sites collects real-user telemetry without re-running full audits.'
      ),
      React.createElement(Text, { style: styles.h3 }, 'Dashboard Tabs'),
      ...[
        'Overview — verification status, last heartbeat, site key info',
        'Installation — framework-specific JS snippets and DNS/meta-tag verification',
        'Web Vitals — p50/p75/p90 for LCP, CLS, INP, FCP, TTFB with good/needs-improvement/poor thresholds',
        'Routes — deduplicated observed URL paths with search and pagination',
        'Indexing — per-route indexability warnings (noindex, canonical, missing meta)',
        'Settings — origin URL, key rotation with 24-hour grace period',
      ].map((item) =>
        React.createElement(Text, { style: styles.bullet, key: item }, `• ${item}`)
      ),
      React.createElement(Text, { style: styles.h2 }, 'Fix Requests'),
      React.createElement(
        Text,
        { style: styles.body },
        'Fix Requests are structured tasks created from any WebScore finding that can be delivered to developers through 6 channels, tracked through a 17-status lifecycle, and verified once resolved.'
      ),
      React.createElement(Text, { style: styles.h3 }, 'Delivery Channels'),
      ...[
        'Email — HTML email with issue details and severity badge',
        'WhatsApp — pre-filled message link',
        'Telegram — pre-filled share link',
        'Internal assignment — assign to a team member (Agency+)',
        'Webhook — HMAC-signed JSON payload (Agency+)',
        'External link — scoped, expiring, revocable public link (no account required for recipient)',
      ].map((item) =>
        React.createElement(Text, { style: styles.bullet, key: item }, `• ${item}`)
      ),
      React.createElement(Text, { style: styles.footer }, 'WebScore Product Guide — webanalyzer.app')
    )
  );
}

export async function GET(_req: NextRequest) {
  try {
    const buffer = await renderToBuffer(React.createElement(ProductGuidePDF));
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="webscore-product-guide.pdf"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
