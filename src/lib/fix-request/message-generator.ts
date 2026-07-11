/**
 * Channel-specific message formatting for Fix Requests.
 *
 * Each channel receives a tailored message variant.
 * SECURITY:
 *  - All user-supplied text must pass through escapeHtml before HTML templates
 *  - Internal notes and private_notes must NEVER be included
 *  - Recipient contact details must NOT appear in rendered message bodies
 *  - No secrets or tokens embedded in message text (links use separate signed URLs)
 */

import type { FixRequestSeverity } from '@/types/fix-request';

// ── Escaping ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ── Shared context ────────────────────────────────────────────────────────────

export interface MessageContext {
  requestType:  string;
  title:        string;
  summary:      string;
  severity:     FixRequestSeverity;
  category:     string;
  affectedUrls: string[];
  coverMessage?: string;
  senderName?:  string;         // display name only; never their email
  shareLink?:   string;         // signed external link (may be absent for some channels)
}

// ── Email ─────────────────────────────────────────────────────────────────────

export interface EmailMessage {
  subject:  string;
  html:     string;
  text:     string;
}

const SEVERITY_BADGE: Record<FixRequestSeverity, string> = {
  critical:      '🔴 Critical',
  high:          '🟠 High',
  medium:        '🟡 Medium',
  low:           '🟢 Low',
  informational: '⚪ Informational',
};

export function buildEmailMessage(ctx: MessageContext): EmailMessage {
  const sender  = ctx.senderName ? esc(ctx.senderName) : 'Your team';
  const title   = esc(truncate(ctx.title, 200));
  const summary = esc(truncate(ctx.summary, 1000));
  const sev     = SEVERITY_BADGE[ctx.severity];
  const type    = esc(ctx.requestType.charAt(0).toUpperCase() + ctx.requestType.slice(1));
  const urls    = ctx.affectedUrls.slice(0, 5).map((u) => `<li>${esc(u)}</li>`).join('');
  const link    = ctx.shareLink
    ? `<p style="margin-top:24px"><a href="${esc(ctx.shareLink)}" style="color:#6366f1;font-weight:600">View request &rarr;</a></p>`
    : '';
  const cover   = ctx.coverMessage
    ? `<p style="margin-top:16px;border-left:4px solid #6366f1;padding-left:12px;color:#374151">${esc(truncate(ctx.coverMessage, 2000))}</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px">
  <p style="font-size:14px;color:#6b7280">${sender} sent you a <strong>${type} request</strong> via WebAnalyzer</p>
  <h1 style="font-size:20px;margin:8px 0">${title}</h1>
  <p style="margin:4px 0;font-size:13px">${sev} &nbsp;|&nbsp; ${esc(ctx.category)}</p>
  ${cover}
  <p style="margin-top:16px">${summary}</p>
  ${urls ? `<p><strong>Affected URLs:</strong></p><ul style="font-size:13px;color:#374151">${urls}</ul>` : ''}
  ${link}
  <hr style="margin:32px 0;border-top:1px solid #e5e7eb">
  <p style="font-size:12px;color:#9ca3af">This request was sent via WebAnalyzer. Do not reply to this email — use the link above to respond.</p>
</body>
</html>`.trim();

  const text = [
    `${sender} sent you a ${ctx.requestType} request via WebAnalyzer`,
    '',
    title,
    `Severity: ${ctx.severity} | Category: ${ctx.category}`,
    ctx.coverMessage ? `\n"${truncate(ctx.coverMessage, 500)}"` : '',
    '',
    summary,
    ctx.affectedUrls.length > 0 ? 'Affected URLs:\n' + ctx.affectedUrls.slice(0, 5).join('\n') : '',
    ctx.shareLink ? `\nView request: ${ctx.shareLink}` : '',
  ].filter(Boolean).join('\n');

  const subject = `[${ctx.severity.toUpperCase()}] ${ctx.requestType.charAt(0).toUpperCase() + ctx.requestType.slice(1)} request: ${truncate(ctx.title, 80)}`;

  return { subject, html, text };
}

// ── WhatsApp click-to-chat link ───────────────────────────────────────────────

export function buildWhatsAppLinkMessage(ctx: MessageContext): string {
  const lines = [
    `Hi! ${ctx.senderName ?? 'Your team'} sent a *${ctx.requestType} request* via WebAnalyzer.`,
    '',
    `*${truncate(ctx.title, 120)}*`,
    `Severity: ${ctx.severity} | Category: ${ctx.category}`,
    '',
    truncate(ctx.summary, 300),
    ctx.shareLink ? `\nDetails: ${ctx.shareLink}` : '',
  ].filter(Boolean).join('\n');

  return encodeURIComponent(lines);
}

export function buildWhatsAppLink(phoneE164: string, ctx: MessageContext): string {
  const msg = buildWhatsAppLinkMessage(ctx);
  return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${msg}`;
}

// ── Telegram share link ───────────────────────────────────────────────────────

export function buildTelegramShareLink(ctx: MessageContext): string {
  const text = [
    `${ctx.senderName ?? 'Your team'} sent a ${ctx.requestType} request`,
    truncate(ctx.title, 120),
    `Severity: ${ctx.severity}`,
    ctx.shareLink ?? '',
  ].filter(Boolean).join('\n');
  const encodedText = encodeURIComponent(text);
  const encodedUrl  = ctx.shareLink ? encodeURIComponent(ctx.shareLink) : '';
  return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
}

// ── Webhook payload ───────────────────────────────────────────────────────────

export interface FixRequestWebhookPayload {
  event:       'fix_request.created' | 'fix_request.updated' | 'fix_request.status_changed';
  fixRequestId: string;
  requestType: string;
  status:      string;
  severity:    string;
  title:       string;
  summary:     string;
  category:    string;
  affectedUrls: string[];
  shareLink?:  string;
  timestamp:   string;
}

export function buildWebhookPayload(
  fixRequestId: string,
  event: FixRequestWebhookPayload['event'],
  ctx: MessageContext,
  status: string,
): FixRequestWebhookPayload {
  return {
    event,
    fixRequestId,
    requestType:  ctx.requestType,
    status,
    severity:     ctx.severity,
    title:        ctx.title,
    summary:      truncate(ctx.summary, 500),
    category:     ctx.category,
    affectedUrls: ctx.affectedUrls.slice(0, 10),
    shareLink:    ctx.shareLink,
    timestamp:    new Date().toISOString(),
  };
}

// ── Slack Block Kit (auto-detected when URL matches hooks.slack.com) ──────────

export function buildSlackPayload(ctx: MessageContext) {
  const sev = SEVERITY_BADGE[ctx.severity];
  const blocks: object[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Fix Request: ${truncate(ctx.title, 150)}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Type:*\n${ctx.requestType}` },
        { type: 'mrkdwn', text: `*Severity:*\n${sev}` },
        { type: 'mrkdwn', text: `*Category:*\n${ctx.category}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: truncate(ctx.summary, 800) },
    },
  ];

  if (ctx.affectedUrls.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Affected URLs:*\n${ctx.affectedUrls.slice(0, 5).map((u) => `• ${u}`).join('\n')}`,
      },
    });
  }

  if (ctx.coverMessage) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `> ${truncate(ctx.coverMessage, 500).replace(/\n/g, '\n> ')}` },
    });
  }

  if (ctx.shareLink) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Request', emoji: true },
          url: ctx.shareLink,
          style: 'primary',
        },
      ],
    });
  }

  return { blocks };
}

// ── Internal assignment notification (for in-app use) ────────────────────────

export function buildAssignmentNotificationText(ctx: MessageContext): string {
  return [
    `You have been assigned a ${ctx.requestType} request: ${truncate(ctx.title, 120)}`,
    `Severity: ${ctx.severity} | ${ctx.category}`,
    ctx.coverMessage ? `\n"${truncate(ctx.coverMessage, 200)}"` : '',
  ].filter(Boolean).join('\n');
}
