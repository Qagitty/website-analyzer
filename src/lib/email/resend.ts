import { Resend } from 'resend';

// Resend is optional — if no API key is configured, emails are silently skipped
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? 'WebAnalyzer <noreply@webanalyzer.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface ScoreDropAlert {
  to: string;
  url: string;
  analysisId: string;
  drops: Array<{ metric: string; previous: number; current: number; delta: number }>;
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
        A scheduled analysis of <strong>${url}</strong> detected a performance regression.
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
      You're receiving this because you set up monitoring for ${url} on WebAnalyzer.
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
        Your scheduled analysis of <strong>${url}</strong> completed successfully.
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
  const to = process.env.SUPPORT_EMAIL ?? 'lagmax.88@gmail.com';

  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — support message from', email, ':', message);
    return;
  }

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
          <td style="padding:8px 0;color:#111827;font-weight:600;">${name}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Email</td>
          <td style="padding:8px 0;"><a href="mailto:${email}" style="color:#4f46e5;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Phone</td>
          <td style="padding:8px 0;color:#111827;">${phone}</td>
        </tr>
      </table>
      <div style="background:#f9fafb;border-radius:8px;padding:14px;font-size:14px;color:#374151;line-height:1.6;">
        ${message.replace(/\n/g, '<br/>')}
      </div>
    </div>
    <div style="padding:12px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      Sent from the WebAnalyzer support chat widget.
      <a href="mailto:${email}" style="color:#6366f1;margin-left:8px;">Reply to ${name}</a>
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
        <strong>${inviterEmail}</strong> has invited you to collaborate on WebAnalyzer.
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
