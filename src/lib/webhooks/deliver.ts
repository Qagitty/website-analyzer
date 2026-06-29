import crypto from 'crypto';
import { validateWebhookUrl } from '@/lib/security/url-validator';

/** Returns true if the URL must be blocked for SSRF reasons. */
export function isSsrfUrl(url: string): boolean {
  return !validateWebhookUrl(url).valid;
}

export interface WebhookPayload {
  event: 'analysis.completed' | 'score.dropped';
  analysisId: string;
  url: string;
  scores?: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
  reportUrl?: string;
  timestamp: string;
}

function isSlackUrl(url: string): boolean {
  return url.includes('hooks.slack.com') || url.includes('hooks.slack-gov.com');
}

function buildSlackPayload(payload: WebhookPayload): object {
  const scoreLines = payload.scores
    ? [
        `*Performance:* ${payload.scores.performance}`,
        `*Accessibility:* ${payload.scores.accessibility}`,
        `*SEO:* ${payload.scores.seo}`,
        `*Best Practices:* ${payload.scores.bestPractices}`,
      ].join('  |  ')
    : '';

  const title =
    payload.event === 'analysis.completed'
      ? `Analysis complete: ${payload.url}`
      : `Score dropped: ${payload.url}`;

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: title, emoji: true },
      },
      ...(scoreLines
        ? [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: scoreLines },
            },
          ]
        : []),
      ...(payload.reportUrl
        ? [
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View Report', emoji: true },
                  url: payload.reportUrl,
                  style: 'primary',
                },
              ],
            },
          ]
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `WebAnalyzer · ${new Date(payload.timestamp).toLocaleString()}`,
          },
        ],
      },
    ],
  };
}

export async function deliverWebhook(
  webhookUrl: string,
  secret: string,
  payload: WebhookPayload
): Promise<void> {
  // Final SSRF guard at delivery time — catches URLs that slipped past creation-time
  // validation (e.g. rows created before the check was added).
  if (isSsrfUrl(webhookUrl)) {
    throw new Error(`Blocked SSRF attempt to: ${webhookUrl}`);
  }

  // SE6 — never sign with an empty key: HMAC('sha256', '') produces valid but
  // trivially forgeable signatures. Skip delivery and log so the operator notices.
  if (!secret) {
    console.warn('[webhooks] Skipping delivery — no secret configured for webhook to', webhookUrl);
    return;
  }

  const body = isSlackUrl(webhookUrl)
    ? JSON.stringify(buildSlackPayload(payload))
    : JSON.stringify(payload);

  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  await fetch(webhookUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'Content-Type': 'application/json',
      'X-WebAnalyzer-Signature': `sha256=${signature}`,
      'X-WebAnalyzer-Event': payload.event,
    },
    body,
  });
}

export async function fireWebhooksForAnalysis(
  supabaseServiceClient: any,
  userId: string,
  payload: WebhookPayload
): Promise<void> {
  const { data: webhooks } = await supabaseServiceClient
    .from('webhooks')
    .select('url, secret, events')
    .eq('user_id', userId)
    .eq('active', true);

  if (!webhooks?.length) return;

  const eligible = webhooks.filter((wh: any) => wh.events?.includes(payload.event));

  await Promise.allSettled(
    eligible.map((wh: any) => deliverWebhook(wh.url, wh.secret ?? '', payload)) // deliverWebhook guards empty secret internally
  );
}
