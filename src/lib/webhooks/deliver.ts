import crypto from 'crypto';

// Private/reserved IP ranges that must not be reachable via user-supplied webhook URLs.
// Prevents SSRF attacks targeting AWS metadata, internal services, Redis, etc.
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,           // link-local / AWS metadata
  /^100\.6[4-9]\.|^100\.[7-9]\d\.|^100\.1[01]\d\.|^100\.12[0-7]\./,  // CGNAT
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
  /^\[/,                   // IPv6 bracket notation (e.g. [::1])
];

export function isSsrfUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return true;
    const host = parsed.hostname.toLowerCase();
    return PRIVATE_IP_PATTERNS.some((p) => p.test(host));
  } catch {
    return true;
  }
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
    eligible.map((wh: any) => deliverWebhook(wh.url, wh.secret ?? '', payload))
  );
}
