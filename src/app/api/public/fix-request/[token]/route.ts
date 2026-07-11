/**
 * Public fix request view.
 *
 * SECURITY: This endpoint is unauthenticated. Access is controlled entirely
 * by the scoped token stored in fix_request_public_links.
 *
 * Rules:
 *  - Token must exist, not be revoked, and not be expired
 *  - Only fields matching the link's access_scope are returned
 *  - internal_notes are NEVER returned
 *  - Private evidence items (isPrivate:true) are NEVER returned
 *  - Recipient contact details are NEVER returned
 *  - No direct Supabase access is granted to external recipients
 *  - Privacy: no IP addresses stored; view count is incremented only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const RESPONSE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'no-store, no-cache',
};

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceRoleClient();
  const { token } = params;

  if (!token || token.length !== 64 || !/^[0-9a-f]+$/.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404, headers: RESPONSE_HEADERS });
  }

  const { data: link, error: linkErr } = await supabase
    .from('fix_request_public_links')
    .select('id, fix_request_id, access_scope, can_acknowledge, can_post_messages, can_submit_response, expires_at, is_revoked')
    .eq('token', token)
    .single();

  if (linkErr || !link) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: RESPONSE_HEADERS });
  if (link.is_revoked)  return NextResponse.json({ error: 'This link has been revoked.' }, { status: 410, headers: RESPONSE_HEADERS });
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 410, headers: RESPONSE_HEADERS });
  }

  const { data: fr, error: frErr } = await supabase
    .from('fix_requests')
    .select('request_type, status, severity, title, summary, category, source_type, affected_urls, reproduction_steps, verification_steps, recommended_fix, code_example, evidence, requested_due_date, technical_description, created_at, updated_at')
    .eq('id', link.fix_request_id)
    .single();

  if (frErr || !fr) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: RESPONSE_HEADERS });

  // Filter evidence — never expose private items externally
  const publicEvidence = ((fr.evidence ?? []) as Array<{ isPrivate?: boolean; [k: string]: unknown }>)
    .filter((e) => !e.isPrivate);

  const response: Record<string, unknown> = {
    requestType:  fr.request_type,
    status:       fr.status,
    severity:     fr.severity,
    title:        fr.title,
    summary:      fr.summary,
    category:     fr.category,
    affectedUrls: fr.affected_urls,
    evidence:     publicEvidence,
    createdAt:    fr.created_at,
    updatedAt:    fr.updated_at,
    // Link capabilities
    canAcknowledge:    link.can_acknowledge,
    canPostMessages:   link.can_post_messages,
    canSubmitResponse: link.can_submit_response,
    linkExpiresAt:     link.expires_at,
    linkId:            link.id,
  };

  // Standard scope stops here; full_technical adds more
  if (link.access_scope === 'full_technical') {
    response.technicalDescription = fr.technical_description;
    response.reproductionSteps    = fr.reproduction_steps;
    response.verificationSteps    = fr.verification_steps;
    response.recommendedFix       = fr.recommended_fix;
    response.codeExample          = fr.code_example;
    response.requestedDueDate     = fr.requested_due_date;
  }

  // Update view tracking (no IP stored; view_count increment via DB expression)
  await supabase.rpc('fix_request_link_record_view', { p_link_id: link.id }).maybeSingle();

  return NextResponse.json(response, { headers: RESPONSE_HEADERS });
}
