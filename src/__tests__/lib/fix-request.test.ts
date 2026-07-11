/**
 * Fix Request domain — unit tests.
 *
 * Covers:
 *  - Type exports and constants
 *  - State machine transitions
 *  - Source adapters (normalization, privacy invariants)
 *  - Message generator (no secret leakage, HTML escaping)
 *  - Channel adapter helpers (link generation, webhook structure)
 *  - Plan entitlements
 */

import { describe, it, expect } from 'vitest';
import {
  FIX_REQUEST_TRANSITIONS,
  canTransition,
  CHANNEL_EVIDENCE_LEVEL,
  FIX_REQUEST_BOUNDS,
  fixRequestError,
} from '@/types/fix-request';
import type { FixRequestStatus } from '@/types/fix-request';
import {
  validateTransition,
  allowedTransitions,
  isTerminalStatus,
  isActiveStatus,
  isDeliveredStatus,
} from '@/lib/fix-request/state-machine';
import {
  fromAnalysisFinding,
  fromAccessibilityFinding,
  fromErrorIssue,
  fromMonitorRegression,
  fromSecurityFinding,
  fromSeoFinding,
  fromDesignMismatch,
  fromLlmReadinessFinding,
  fromRemediationItem,
  createManualDraft,
  buildDraftFromSource,
} from '@/lib/fix-request/source-adapters';
import {
  buildEmailMessage,
  buildWhatsAppLink,
  buildTelegramShareLink,
  buildWebhookPayload,
  buildSlackPayload,
  buildAssignmentNotificationText,
} from '@/lib/fix-request/message-generator';
import { hasFeature } from '@/lib/billing/limits';

// ── State machine ─────────────────────────────────────────────────────────────

describe('fix request state machine', () => {
  it('draft can transition to ready or cancelled', () => {
    expect(canTransition('draft', 'ready')).toBe(true);
    expect(canTransition('draft', 'cancelled')).toBe(true);
    expect(canTransition('draft', 'sent')).toBe(false);
  });

  it('closed is a terminal state', () => {
    expect(isTerminalStatus('closed')).toBe(true);
    expect(FIX_REQUEST_TRANSITIONS.closed).toHaveLength(0);
  });

  it('cancelled is a terminal state', () => {
    expect(isTerminalStatus('cancelled')).toBe(true);
  });

  it('draft is not a terminal state', () => {
    expect(isTerminalStatus('draft')).toBe(false);
  });

  it('validateTransition returns ok:true for valid transition', () => {
    const result = validateTransition('draft', 'ready');
    expect(result.ok).toBe(true);
  });

  it('validateTransition returns ok:false for invalid transition', () => {
    const result = validateTransition('draft', 'verified');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('FIX_REQUEST_INVALID_STATUS_TRANSITION');
    }
  });

  it('validateTransition rejects same-status transitions', () => {
    const result = validateTransition('draft', 'draft');
    expect(result.ok).toBe(false);
  });

  it('allowedTransitions returns correct set', () => {
    const allowed = allowedTransitions('draft');
    expect(allowed).toContain('ready');
    expect(allowed).toContain('cancelled');
    expect(allowed).not.toContain('sent');
  });

  it('isActiveStatus is false for closed/cancelled', () => {
    expect(isActiveStatus('closed')).toBe(false);
    expect(isActiveStatus('cancelled')).toBe(false);
    expect(isActiveStatus('draft')).toBe(true);
    expect(isActiveStatus('in_progress')).toBe(true);
  });

  it('isDeliveredStatus covers sent and later states', () => {
    expect(isDeliveredStatus('sent')).toBe(true);
    expect(isDeliveredStatus('acknowledged')).toBe(true);
    expect(isDeliveredStatus('draft')).toBe(false);
    expect(isDeliveredStatus('ready')).toBe(false);
  });

  it('all statuses in FIX_REQUEST_TRANSITIONS have defined entries', () => {
    const statuses: FixRequestStatus[] = [
      'draft', 'ready', 'sending', 'sent', 'delivered', 'delivery_failed',
      'acknowledged', 'in_review', 'accepted', 'declined', 'in_progress',
      'waiting_for_information', 'fix_submitted', 'verification_required',
      'verified', 'closed', 'cancelled',
    ];
    for (const s of statuses) {
      expect(FIX_REQUEST_TRANSITIONS[s], `Missing entry for status: ${s}`).toBeDefined();
    }
  });

  it('sending can only go to sent or delivery_failed', () => {
    const allowed = allowedTransitions('sending');
    expect(allowed).toContain('sent');
    expect(allowed).toContain('delivery_failed');
    expect(allowed).not.toContain('draft');
    expect(allowed).not.toContain('closed');
  });
});

// ── CHANNEL_EVIDENCE_LEVEL ────────────────────────────────────────────────────

describe('channel evidence levels', () => {
  it('whatsapp_link and telegram_share are lower-confidence than email', () => {
    expect(CHANNEL_EVIDENCE_LEVEL['whatsapp_link']).toBe('opened_external_app');
    expect(CHANNEL_EVIDENCE_LEVEL['telegram_share']).toBe('opened_external_app');
    expect(CHANNEL_EVIDENCE_LEVEL['email']).toBe('accepted_by_provider');
  });

  it('internal_assignment has recipient_acknowledged evidence', () => {
    expect(CHANNEL_EVIDENCE_LEVEL['internal_assignment']).toBe('recipient_acknowledged');
  });
});

// ── Source adapters ───────────────────────────────────────────────────────────

describe('source adapters', () => {
  const analysisInput = {
    id: 'af1', category: 'performance', priority: 'high' as const,
    title: 'Large JS bundle', description: 'Bundle is 3MB', url: 'https://example.com',
    recommendation: 'Split code', analysisId: 'a1',
  };

  it('fromAnalysisFinding returns correct shape', () => {
    const draft = fromAnalysisFinding(analysisInput);
    expect(draft.sourceType).toBe('analysis_finding');
    expect(draft.sourceId).toBe('af1');
    expect(draft.analysisId).toBe('a1');
    expect(draft.severity).toBe('high');
    expect(draft.affectedUrls).toContain('https://example.com');
  });

  it('fromAccessibilityFinding maps severity correctly', () => {
    const draft = fromAccessibilityFinding({
      id: 'acc1', ruleId: 'color-contrast', title: 'Low contrast',
      description: 'Text has insufficient contrast', severity: 'serious',
      wcagCriteria: ['wcag143'], wcagLevel: 'AA', pageUrl: 'https://example.com/page',
      analysisId: 'a1',
    });
    expect(draft.severity).toBe('high'); // serious → high
    expect(draft.category).toBe('accessibility');
    expect(draft.sourceType).toBe('accessibility_finding');
  });

  it('fromAccessibilityFinding never includes private html excerpts as non-private', () => {
    const draft = fromAccessibilityFinding({
      id: 'acc2', ruleId: 'color-contrast', title: 'Low contrast',
      description: 'Test', severity: 'moderate',
      wcagCriteria: [], pageUrl: 'https://example.com',
      sanitizedHtmlExcerpt: '<button class="btn">Click me</button>',
      analysisId: 'a1',
    });
    const excerpt = draft.evidence.find((e) => e.label === 'HTML excerpt (sanitized)');
    expect(excerpt).toBeDefined();
    expect(excerpt?.isPrivate).toBe(false); // sanitized = safe for external
  });

  it('fromRemediationItem does NOT copy notes to public evidence', () => {
    const draft = fromRemediationItem({
      id: 'r1', issueId: 'color-contrast', issueDescription: 'Contrast issue',
      impact: 'moderate', url: 'https://example.com', analysisId: 'a1',
      notes: 'Internal note: ticket #123 assigned to Bob',
    });
    // notes must NOT appear in evidence
    for (const ev of draft.evidence) {
      expect(ev.value).not.toContain('Internal note');
      expect(ev.value).not.toContain('ticket #123');
      expect(ev.value).not.toContain('Bob');
    }
  });

  it('fromErrorIssue severity is high for type=error', () => {
    const draft = fromErrorIssue({
      id: 'e1', message: 'ReferenceError: x is not defined',
      type: 'error', source: 'app.js', line: 42,
      url: 'https://example.com', analysisId: 'a1',
    });
    expect(draft.severity).toBe('high');
  });

  it('fromMonitorRegression uses audit requestType', () => {
    const draft = fromMonitorRegression({
      id: 'mr1', monitorId: 'm1', url: 'https://example.com',
      metricName: 'performance', previousValue: 90, currentValue: 60,
      dropPercent: 33, detectedAt: '2026-07-11T10:00:00Z',
    });
    expect(draft.requestType).toBe('audit');
    expect(draft.severity).toBe('high'); // >= 20% drop
  });

  it('createManualDraft returns empty draft with correct defaults', () => {
    const draft = createManualDraft();
    expect(draft.sourceType).toBe('manual');
    expect(draft.title).toBe('');
    expect(draft.evidence).toHaveLength(0);
  });

  it('createManualDraft accepts overrides', () => {
    const draft = createManualDraft({ title: 'My custom request', severity: 'critical' });
    expect(draft.title).toBe('My custom request');
    expect(draft.severity).toBe('critical');
  });

  it('buildDraftFromSource dispatches to correct adapter', () => {
    const draft = buildDraftFromSource({ type: 'security_finding', data: {
      id: 'sf1', headerName: 'Content-Security-Policy', severity: 'high',
      description: 'CSP header is missing', recommendation: 'Add CSP header',
      url: 'https://example.com', analysisId: 'a1',
    }});
    expect(draft.category).toBe('security');
    expect(draft.sourceType).toBe('security_finding');
  });

  it('all adapter outputs have required fields', () => {
    const drafts = [
      buildDraftFromSource({ type: 'analysis_finding', data: analysisInput }),
      buildDraftFromSource({ type: 'manual' }),
    ];
    for (const d of drafts) {
      expect(d.requestType).toBeTruthy();
      expect(d.sourceType).toBeTruthy();
      expect(Array.isArray(d.evidence)).toBe(true);
      expect(Array.isArray(d.affectedUrls)).toBe(true);
      expect(Array.isArray(d.reproductionSteps)).toBe(true);
      expect(Array.isArray(d.verificationSteps)).toBe(true);
      expect(d.recipientSelection).toBeDefined();
      expect(Array.isArray(d.deliveryChannels)).toBe(true);
    }
  });
});

// ── Message generator ─────────────────────────────────────────────────────────

describe('message generator', () => {
  const ctx = {
    requestType: 'fix',
    title: 'Missing CSP header',
    summary: 'The Content-Security-Policy header is absent.',
    severity: 'high' as const,
    category: 'security',
    affectedUrls: ['https://example.com'],
    coverMessage: 'Please fix this ASAP',
    senderName: 'Alice',
    shareLink: 'https://app.example.com/fix-request/abc123',
  };

  it('buildEmailMessage includes severity and title', () => {
    const msg = buildEmailMessage(ctx);
    expect(msg.subject).toContain('HIGH');
    expect(msg.subject).toContain('Missing CSP header');
    expect(msg.html).toContain('Missing CSP header');
    expect(msg.text).toContain('Missing CSP header');
  });

  it('buildEmailMessage escapes HTML in user-controlled fields', () => {
    const xssCtx = { ...ctx, title: '<script>alert(1)</script>', summary: '<img src=x onerror=alert(1)>' };
    const msg = buildEmailMessage(xssCtx);
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).not.toContain('<img src=x');
    expect(msg.html).toContain('&lt;script&gt;');
  });

  it('buildEmailMessage does not include raw phone numbers or recipient emails', () => {
    const msg = buildEmailMessage(ctx);
    // No email or phone should appear in the rendered message body
    expect(msg.html).not.toMatch(/\+\d{10,}/);
    expect(msg.html).not.toMatch(/\S+@\S+\.\S+/);
    expect(msg.text).not.toMatch(/\+\d{10,}/);
  });

  it('buildWhatsAppLink encodes message text', () => {
    const link = buildWhatsAppLink('+491234567890', ctx);
    expect(link).toContain('wa.me/491234567890');
    expect(link).toContain('?text=');
    // Phone digit-only, no + in URL
    expect(link).not.toContain('+49');
  });

  it('buildTelegramShareLink returns t.me share URL', () => {
    const link = buildTelegramShareLink(ctx);
    expect(link).toContain('t.me/share/url');
    expect(link).toContain('text=');
  });

  it('buildWebhookPayload has required fields and no secrets', () => {
    const payload = buildWebhookPayload('fr-id-1', 'fix_request.created', ctx, 'sent');
    expect(payload.event).toBe('fix_request.created');
    expect(payload.fixRequestId).toBe('fr-id-1');
    expect(payload.title).toBe('Missing CSP header');
    expect(payload.severity).toBe('high');
    expect(payload.timestamp).toBeTruthy();
    // No internal notes, no secrets
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('internal_note');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('secret');
  });

  it('buildSlackPayload includes blocks array', () => {
    const payload = buildSlackPayload(ctx);
    expect(Array.isArray(payload.blocks)).toBe(true);
    expect(payload.blocks.length).toBeGreaterThan(0);
  });

  it('buildAssignmentNotificationText contains request type and title', () => {
    const text = buildAssignmentNotificationText(ctx);
    expect(text).toContain('fix request');
    expect(text).toContain('Missing CSP header');
  });

  it('cover message is included in email HTML', () => {
    const msg = buildEmailMessage(ctx);
    expect(msg.html).toContain('Please fix this ASAP');
    expect(msg.text).toContain('Please fix this ASAP');
  });

  it('summary is truncated at 1000 chars in email', () => {
    const longSummary = 'x'.repeat(1100);
    const msg = buildEmailMessage({ ...ctx, summary: longSummary });
    // Truncated at 1000 + ellipsis
    expect(msg.html).toContain('x'.repeat(100));
    const summaryOccurrence = msg.html.indexOf('…');
    expect(summaryOccurrence).toBeGreaterThan(-1);
  });
});

// ── FIX_REQUEST_BOUNDS ────────────────────────────────────────────────────────

describe('fix request bounds', () => {
  it('title max is 200', () => {
    expect(FIX_REQUEST_BOUNDS.title.max).toBe(200);
  });
  it('evidence max is 20', () => {
    expect(FIX_REQUEST_BOUNDS.evidence.max).toBe(20);
  });
  it('message max is 5000', () => {
    expect(FIX_REQUEST_BOUNDS.message.max).toBe(5_000);
  });
});

// ── Error codes ───────────────────────────────────────────────────────────────

describe('fixRequestError helper', () => {
  it('returns code and message', () => {
    const result = fixRequestError('FIX_REQUEST_NOT_FOUND', 'Not found');
    expect(result.code).toBe('FIX_REQUEST_NOT_FOUND');
    expect(result.error).toBe('Not found');
  });
});

// ── Plan entitlements ─────────────────────────────────────────────────────────

describe('fix request plan entitlements', () => {
  it('free plan does not have fixRequests', () => {
    expect(hasFeature('free', 'fixRequests')).toBe(false);
  });
  it('pro plan has fixRequests', () => {
    expect(hasFeature('pro', 'fixRequests')).toBe(true);
  });
  it('agency plan has fixRequestWebhookDelivery', () => {
    expect(hasFeature('agency', 'fixRequestWebhookDelivery')).toBe(true);
  });
  it('pro plan does not have fixRequestWebhookDelivery', () => {
    expect(hasFeature('pro', 'fixRequestWebhookDelivery')).toBe(false);
  });
  it('agency plan has fixRequestTeamAssignment', () => {
    expect(hasFeature('agency', 'fixRequestTeamAssignment')).toBe(true);
  });
  it('pro plan does not have fixRequestTeamAssignment', () => {
    expect(hasFeature('pro', 'fixRequestTeamAssignment')).toBe(false);
  });
  it('compliance plan has all fix request features', () => {
    const features = [
      'fixRequests', 'fixRequestEmailDelivery', 'fixRequestExternalLinks',
      'fixRequestWebhookDelivery', 'fixRequestTeamAssignment', 'fixRequestVerification',
    ] as const;
    for (const f of features) {
      expect(hasFeature('compliance', f), `compliance plan missing ${f}`).toBe(true);
    }
  });
});

// ── Privacy invariants ────────────────────────────────────────────────────────

describe('privacy invariants', () => {
  it('no source adapter copies private_notes to public evidence', () => {
    const draft = fromRemediationItem({
      id: 'r1', issueId: 'rule-1', issueDescription: 'Issue',
      impact: 'critical', url: 'https://example.com', analysisId: 'a1',
      notes: 'PRIVATE: do not share. Assigned to john@company.com',
    });
    const evidenceText = JSON.stringify(draft.evidence);
    expect(evidenceText).not.toContain('john@company.com');
    expect(evidenceText).not.toContain('PRIVATE');
  });

  it('no adapter includes cover message in evidence', () => {
    const draft = fromAnalysisFinding({
      id: 'af2', category: 'performance', priority: 'medium',
      title: 'Slow page', description: 'LCP is too high',
      analysisId: 'a2',
    });
    // cover message is not set by adapters — only by user after creating draft
    expect(draft.message).toBeUndefined();
  });

  it('webhook payload does not include internal_notes field', () => {
    const payload = buildWebhookPayload('fr1', 'fix_request.created', {
      requestType: 'fix', title: 'T', summary: 'S',
      severity: 'low', category: 'c', affectedUrls: [],
    }, 'sent');
    expect(Object.keys(payload)).not.toContain('internal_notes');
  });
});
