import { Resend } from 'resend';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Resend is optional — if no API key is configured, emails are silently skipped
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? 'WebAnalyzer <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface ScoreDropAlert {
  to: string;
  url: string;
  analysisId: string;
  drops: Array<{ metric: string; previous: number; current: number; delta: number }>;
}

export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string;
  name?: string | null;
}): Promise<void> {
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping welcome email for', to);
    return;
  }

  const displayName = escapeHtml(name?.split(' ')[0] || 'there');
  const analyzeUrl = `${APP_URL}/analyze`;
  const dashboardUrl = `${APP_URL}/dashboard`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to WebAnalyzer</title>
</head>
<body style="margin:0;padding:0;background:#0d0d14;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Logo header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                🌐 WebAnalyzer
              </div>
              <div style="font-size:13px;color:#c4b5fd;margin-top:4px;letter-spacing:0.5px;">
                Website Performance &amp; Quality Analysis
              </div>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="background:#16161f;padding:32px;border-left:1px solid #2d2d3d;border-right:1px solid #2d2d3d;">

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f0ff;">
                Welcome, ${displayName}! 🎉
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#a09fbb;line-height:1.6;">
                Your account is ready. You have <strong style="color:#818cf8;">3 free analyses</strong> to get started — no credit card needed.
              </p>

              <!-- Feature list -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2d2d3d;">
                    <span style="color:#818cf8;font-size:16px;">⚡</span>
                    <span style="color:#c4c3db;font-size:14px;margin-left:10px;">
                      <strong style="color:#f1f0ff;">Performance scores</strong> — Lighthouse metrics, Core Web Vitals, TTFB
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2d2d3d;">
                    <span style="color:#818cf8;font-size:16px;">♿</span>
                    <span style="color:#c4c3db;font-size:14px;margin-left:10px;">
                      <strong style="color:#f1f0ff;">Accessibility audit</strong> — WCAG compliance checks, EAA readiness
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2d2d3d;">
                    <span style="color:#818cf8;font-size:16px;">🤖</span>
                    <span style="color:#c4c3db;font-size:14px;margin-left:10px;">
                      <strong style="color:#f1f0ff;">AI insights</strong> — Claude-powered recommendations tailored to your site
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="color:#818cf8;font-size:16px;">📄</span>
                    <span style="color:#c4c3db;font-size:14px;margin-left:10px;">
                      <strong style="color:#f1f0ff;">PDF reports</strong> — shareable, professional-grade reports for clients
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="${analyzeUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.2px;">
                      Analyze Your First Site →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}"
                       style="color:#818cf8;font-size:13px;text-decoration:none;">
                      Go to your dashboard
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0d14;border:1px solid #2d2d3d;border-top:none;border-radius:0 0 16px 16px;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#5c5b73;line-height:1.6;">
                You're receiving this because you just created an account on
                <a href="${APP_URL}" style="color:#6366f1;text-decoration:none;">WebAnalyzer</a>.
                <br />Questions? Just reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to WebAnalyzer, ${displayName}! 🎉`,
    html,
  });
}

export async function sendScoreDropAlert({
  to,
  url,
  analysisId,
  drops,
}: ScoreDropAlert): Promise<void> {
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping alert email for', to);
    return;
  }

  const reportUrl = `${APP_URL}/reports/${analysisId}`;

  const dropRows = drops
    .map(
      (d) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${d.metric}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${d.previous}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#dc2626;font-weight:600;">${d.current} (▼${d.delta})</td>
        </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#4f46e5;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:18px;">⚠️ Score Drop Detected</h1>
    </div>
    <div style="padding:24px;space-y:16px;">
      <p style="margin:0 0 12px;color:#374151;">
        A scheduled analysis of <strong>${escapeHtml(url)}</strong> detected a performance regression.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;">Metric</th>
            <th style="padding:8px 12px;text-align:center;">Previous</th>
            <th style="padding:8px 12px;text-align:center;">Now</th>
          </tr>
        </thead>
        <tbody>${dropRows}</tbody>
      </table>
      <a href="${reportUrl}"
         style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
        View Full Report →
      </a>
    </div>
    <div style="padding:12px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      You're receiving this because you set up monitoring for ${escapeHtml(url)} on WebAnalyzer.
      <a href="${APP_URL}/monitors" style="color:#6366f1;">Manage monitors</a>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `⚠️ Score drop detected on ${url}`,
    html,
  });
}

export async function sendMonitorSummary({
  to,
  url,
  analysisId,
  scores,
}: {
  to: string;
  url: string;
  analysisId: string;
  scores: Record<string, number>;
}): Promise<void> {
  if (!resend) return;

  const reportUrl = `${APP_URL}/reports/${analysisId}`;

  const scoreRows = Object.entries(scores)
    .filter(([k]) => ['performance', 'accessibility', 'seo', 'bestPractices'].includes(k))
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${k}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;color:${v >= 90 ? '#16a34a' : v >= 50 ? '#d97706' : '#dc2626'};">${v}</td>
        </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#4f46e5;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:18px;">✅ Scheduled Analysis Complete</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;color:#374151;">
        Your scheduled analysis of <strong>${escapeHtml(url)}</strong> completed successfully.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;">Metric</th>
            <th style="padding:8px 12px;text-align:center;">Score</th>
          </tr>
        </thead>
        <tbody>${scoreRows}</tbody>
      </table>
      <a href="${reportUrl}"
         style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
        View Full Report →
      </a>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `✅ Scheduled analysis complete — ${url}`,
    html,
  });
}

export async function sendSupportMessage({
  name,
  email,
  phone,
  message,
}: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<void> {
  const to = process.env.SUPPORT_EMAIL;
  if (!to) {
    console.warn('[email] SUPPORT_EMAIL is not set — support message dropped. From:', email);
    return;
  }

  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — support message from', email, ':', message);
    return;
  }

  const safeName    = escapeHtml(name);
  const safeEmail   = escapeHtml(email);
  const safePhone   = escapeHtml(phone);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#4f46e5;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:18px;">💬 New Support Message</h1>
    </div>
    <div style="padding:24px;space-y:16px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;width:90px;">Name</td>
          <td style="padding:8px 0;color:#111827;font-weight:600;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Email</td>
          <td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#4f46e5;">${safeEmail}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Phone</td>
          <td style="padding:8px 0;color:#111827;">${safePhone}</td>
        </tr>
      </table>
      <div style="background:#f9fafb;border-radius:8px;padding:14px;font-size:14px;color:#374151;line-height:1.6;">
        ${safeMessage}
      </div>
    </div>
    <div style="padding:12px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      Sent from the WebAnalyzer support chat widget.
      <a href="mailto:${safeEmail}" style="color:#6366f1;margin-left:8px;">Reply to ${safeName}</a>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    replyTo: email,
    subject: `💬 Support: ${name} — ${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`,
    html,
  });
}

export async function sendAnalysisComplete({
  to,
  url,
  analysisId,
  scores,
}: {
  to: string;
  url: string;
  analysisId: string;
  scores?: Record<string, number> | null;
}): Promise<void> {
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping completion email for', to);
    return;
  }

  const reportUrl = `${APP_URL}/reports/${analysisId}`;
  const perf = scores?.performance;
  const a11y = scores?.accessibility;
  const seo  = scores?.seo;

  const scoreColor = (v: number) =>
    v >= 90 ? '#16a34a' : v >= 50 ? '#d97706' : '#dc2626';

  const scoreRow = (label: string, v: number | undefined) =>
    v != null
      ? `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #2d2d3d;color:#a09fbb;font-size:14px;">${label}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2d2d3d;text-align:center;font-weight:700;font-size:14px;color:${scoreColor(v)};">${v}</td>
        </tr>`
      : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Analysis Complete</title>
</head>
<body style="margin:0;padding:0;background:#0d0d14;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:24px 32px;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;">✅ Your report is ready</div>
              <div style="font-size:13px;color:#c4b5fd;margin-top:4px;">${escapeHtml(url)}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#16161f;padding:28px 32px;border-left:1px solid #2d2d3d;border-right:1px solid #2d2d3d;">
              <p style="margin:0 0 20px;font-size:15px;color:#a09fbb;line-height:1.6;">
                Your analysis completed successfully. Here's a quick score summary:
              </p>
              ${(perf != null || a11y != null || seo != null) ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#1e1e2e;">
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b6b8a;text-transform:uppercase;letter-spacing:0.05em;">Metric</th>
                    <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b6b8a;text-transform:uppercase;letter-spacing:0.05em;">Score</th>
                  </tr>
                </thead>
                <tbody>
                  ${scoreRow('Performance', perf)}
                  ${scoreRow('Accessibility', a11y)}
                  ${scoreRow('SEO', seo)}
                </tbody>
              </table>` : ''}
              <a href="${reportUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
                View Full Report →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#0d0d14;border:1px solid #2d2d3d;border-top:none;border-radius:0 0 16px 16px;padding:14px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#5c5b73;">
                You're receiving this because you enabled analysis completion notifications in
                <a href="${APP_URL}/settings/notifications" style="color:#6366f1;text-decoration:none;">Settings → Notifications</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `✅ Analysis complete — ${url}`,
    html,
  });
}

export async function sendAnalysisFailed({
  to,
  url,
  analysisId,
}: {
  to: string;
  url: string;
  analysisId: string;
}): Promise<void> {
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping failure email for', to);
    return;
  }

  const analyzeUrl = `${APP_URL}/analyze`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Analysis Failed</title></head>
<body style="margin:0;padding:0;background:#0d0d14;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);border-radius:16px 16px 0 0;padding:24px 32px;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;">⚠️ Analysis failed</div>
              <div style="font-size:13px;color:#fca5a5;margin-top:4px;">${escapeHtml(url)}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#16161f;padding:28px 32px;border-left:1px solid #2d2d3d;border-right:1px solid #2d2d3d;">
              <p style="margin:0 0 20px;font-size:15px;color:#a09fbb;line-height:1.6;">
                The analysis of <strong style="color:#f1f0ff;">${escapeHtml(url)}</strong> could not be completed.
                Your credit has been refunded automatically.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#a09fbb;line-height:1.6;">
                This can happen if the site is unreachable, takes too long to respond, or blocks automated scanning.
                You can try again from the Analyze page.
              </p>
              <a href="${analyzeUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
                Try Again →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#0d0d14;border:1px solid #2d2d3d;border-top:none;border-radius:0 0 16px 16px;padding:14px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#5c5b73;">
                You're receiving this because you enabled failure notifications in
                <a href="${APP_URL}/settings/notifications" style="color:#6366f1;text-decoration:none;">Settings → Notifications</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `⚠️ Analysis failed — ${url}`,
    html,
  });
}

export async function sendTeamInvite({
  to,
  inviterEmail,
  acceptUrl,
}: {
  to: string;
  inviterEmail: string;
  acceptUrl: string;
}): Promise<void> {
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping team invite email for', to);
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#4f46e5;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:18px;">You've been invited to join a team on WebAnalyzer</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 20px;color:#374151;">
        <strong>${escapeHtml(inviterEmail)}</strong> has invited you to collaborate on WebAnalyzer.
      </p>
      <a href="${acceptUrl}"
         style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
        Accept Invitation
      </a>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
        This link expires in 7 days. If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
    <div style="padding:12px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      WebAnalyzer — Website performance &amp; accessibility analysis
      <br />
      <a href="${APP_URL}" style="color:#6366f1;">${APP_URL}</a>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been invited to join a team on WebAnalyzer`,
    html,
  });
}
