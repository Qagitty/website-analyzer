import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { hasFeature } from '@/lib/billing/limits';
import { validateTransition } from '@/lib/fix-request/state-machine';
import { deliverToChannel } from '@/lib/fix-request/channel-adapters';
import { sendFixRequestEmail } from '@/lib/email/resend';
import type { MessageContext } from '@/lib/fix-request/message-generator';
import type { FixRequestStatus, FixRequestDeliveryChannel } from '@/types/fix-request';
import { z } from 'zod';

const sendSchema = z.object({
  recipientType:     z.enum(['internal_user', 'team_member', 'email', 'whatsapp', 'telegram', 'webhook', 'external_link']),
  deliveryChannel:   z.enum(['email', 'whatsapp_link', 'telegram_share', 'internal_assignment', 'external_link', 'webhook', 'internal_chat']),
  // Channel-specific fields (validated per channel below)
  recipientEmail:    z.string().email().optional(),
  phoneE164:         z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  webhookId:         z.string().uuid().optional(),
  assigneeUserId:    z.string().uuid().optional(),
  shareExpiresInHours: z.number().int().min(1).max(8760).default(168),  // 1 hour–1 year; default 7 days
  shareScope:        z.enum(['standard', 'full_technical']).default('standard'),
  shareCanAcknowledge:    z.boolean().default(true),
  shareCanPostMessages:   z.boolean().default(false),
  shareCanSubmitResponse: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const serviceClient = createServiceRoleClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase.from('user_settings').select('plan').eq('user_id', user.id).single();
  const plan = settings?.plan ?? 'free';

  if (!hasFeature(plan, 'fixRequests')) {
    return NextResponse.json({ error: 'Fix requests require a Pro plan or higher.' }, { status: 403 });
  }

  // Load the fix request
  const { data: fr, error: fetchErr } = await supabase
    .from('fix_requests')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (fetchErr || !fr) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  const transition = validateTransition(fr.status as FixRequestStatus, 'sending');
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error, code: transition.code }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const d = parsed.data;
  const channel = d.deliveryChannel as FixRequestDeliveryChannel;

  // Feature-gate per channel
  if (channel === 'email' && !hasFeature(plan, 'fixRequestEmailDelivery')) {
    return NextResponse.json({ error: 'Email delivery requires a Pro plan or higher.', code: 'FEATURE_GATE_fixRequestEmailDelivery' }, { status: 403 });
  }
  if (channel === 'external_link' && !hasFeature(plan, 'fixRequestExternalLinks')) {
    return NextResponse.json({ error: 'External share links require a Pro plan or higher.', code: 'FEATURE_GATE_fixRequestExternalLinks' }, { status: 403 });
  }
  if (channel === 'webhook' && !hasFeature(plan, 'fixRequestWebhookDelivery')) {
    return NextResponse.json({ error: 'Webhook delivery requires an Agency plan or higher.', code: 'FEATURE_GATE_fixRequestWebhookDelivery' }, { status: 403 });
  }
  if (channel === 'internal_assignment' && !hasFeature(plan, 'fixRequestTeamAssignment')) {
    return NextResponse.json({ error: 'Team assignment requires an Agency plan or higher.', code: 'FEATURE_GATE_fixRequestTeamAssignment' }, { status: 403 });
  }

  // Build public link token if needed
  let shareLink: string | undefined;
  let tokenId: string | undefined;

  if (channel === 'external_link' || channel === 'email') {
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = new Date(Date.now() + d.shareExpiresInHours * 3_600_000).toISOString();

    const { data: link, error: linkErr } = await serviceClient
      .from('fix_request_public_links')
      .insert({
        fix_request_id:       params.id,
        user_id:              user.id,
        token,
        access_scope:         d.shareScope,
        can_acknowledge:      d.shareCanAcknowledge,
        can_post_messages:    d.shareCanPostMessages,
        can_submit_response:  d.shareCanSubmitResponse,
        expires_at:           expiresAt,
      })
      .select('id')
      .single();

    if (linkErr || !link) return NextResponse.json({ error: 'Failed to create share token' }, { status: 500 });
    tokenId = link.id;
    shareLink = `${process.env.NEXT_PUBLIC_APP_URL}/fix-request/${token}`;
  }

  // Resolve webhook config
  let webhookUrl: string | undefined;
  let webhookSecret: string | undefined;
  let isSlack = false;

  if (channel === 'webhook' && d.webhookId) {
    const { data: wh } = await supabase
      .from('webhooks')
      .select('url, secret, active')
      .eq('id', d.webhookId)
      .eq('user_id', user.id)
      .single();
    if (!wh?.active) return NextResponse.json({ error: 'Webhook not found or inactive.' }, { status: 404 });
    webhookUrl    = wh.url;
    webhookSecret = wh.secret ?? '';
    isSlack = webhookUrl.includes('hooks.slack.com') || webhookUrl.includes('hooks.slack-gov.com');
  }

  const ctx: MessageContext = {
    requestType:  fr.request_type,
    title:        fr.title,
    summary:      fr.summary ?? '',
    severity:     fr.severity,
    category:     fr.category ?? '',
    affectedUrls: fr.affected_urls ?? [],
    coverMessage: fr.cover_message ?? undefined,
    shareLink,
  };

  // Mark as sending
  await serviceClient.from('fix_requests').update({ status: 'sending' }).eq('id', params.id);

  const result = await deliverToChannel({
    channel,
    ctx,
    fixRequestId: params.id,
    recipientEmail:  d.recipientEmail,
    phoneE164:       d.phoneE164,
    webhookUrl,
    webhookSecret,
    webhookStatus:   'sent',
    webhookEvent:    'fix_request.created',
    isSlackWebhook:  isSlack,
    assigneeUserId:  d.assigneeUserId,
    externalTokenId: tokenId,
    emailSendFn:     sendFixRequestEmail,
  });

  const newStatus: FixRequestStatus = result.status === 'failed' ? 'delivery_failed' : 'sent';

  await serviceClient.from('fix_requests').update({ status: newStatus }).eq('id', params.id);

  // Record delivery
  await serviceClient.from('fix_request_deliveries').insert({
    fix_request_id: params.id,
    user_id:        user.id,
    channel:        result.channel,
    status:         result.status === 'accepted' || result.status === 'delivered' || result.status === 'link_generated' ? 'accepted' : 'failed',
    provider_ref:   result.providerRef,
    evidence_level: result.evidenceLevel,
    http_status:    result.httpStatus,
    error_summary:  result.errorSummary,
  });

  // Record recipient
  await serviceClient.from('fix_request_recipients').insert({
    fix_request_id:    params.id,
    user_id:           user.id,
    recipient_type:    d.recipientType,
    recipient_user_id: d.assigneeUserId,
    recipient_email:   channel === 'email' ? d.recipientEmail : undefined,
    phone_e164:        channel === 'whatsapp_link' ? d.phoneE164 : undefined,
    webhook_id:        d.webhookId,
    delivery_channel:  channel,
    status:            newStatus === 'sent' ? 'sent' : 'failed',
    last_delivery_attempt: new Date().toISOString(),
    last_delivery_status:  result.status,
    delivery_error_summary: result.errorSummary,
  });

  await serviceClient.from('fix_request_activities').insert({
    fix_request_id: params.id,
    user_id:        user.id,
    event_type:     newStatus === 'sent' ? 'delivery_accepted' : 'delivery_failed',
    previous_status: 'sending',
    new_status:      newStatus,
    metadata:        { channel, evidenceLevel: result.evidenceLevel },
  });

  return NextResponse.json({
    status:         newStatus,
    channel:        result.channel,
    evidenceLevel:  result.evidenceLevel,
    shareLink:      result.link ?? shareLink,
    errorSummary:   result.errorSummary,
  });
}
