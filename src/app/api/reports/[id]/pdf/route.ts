import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateReportPDF } from '@/lib/pdf/generator';
import { getSignedUrlOrNull } from '@/lib/supabase/storage';
import { hasFeature, featureGateError } from '@/lib/billing/limits';
import { sanitizePdfFilename } from '@/lib/pdf/pdf-view-model';
import type { Analysis } from '@/types/analysis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Feature gate: PDF export requires Pro+
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = subscription?.plan ?? 'free';
  if (!hasFeature(plan, 'pdfExport')) {
    return NextResponse.json(featureGateError('pdfExport', 'pro'), { status: 403 });
  }

  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !analysis || analysis.status !== 'completed') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('agency_name, brand_color, show_powered_by, logo_url')
    .eq('user_id', user.id)
    .single();

  // Resolve signed URLs (screenshot + optional logo) in parallel
  const [screenshotUrl, logoUrl] = await Promise.all([
    getSignedUrlOrNull(supabase, (analysis as any).screenshot_url),
    getSignedUrlOrNull(supabase, (settings as any)?.logo_url),
  ]);

  const branding = {
    agencyName:    (settings as any)?.agency_name    ?? undefined,
    brandColor:    (settings as any)?.brand_color    ?? '#6366f1',
    showPoweredBy: (settings as any)?.show_powered_by ?? true,
    logoUrl:       logoUrl ?? undefined,
  };

  const pdfBuffer = await generateReportPDF(
    analysis as unknown as Analysis,
    branding,
    screenshotUrl ?? undefined,
  );

  // §37 — safe filename: never expose raw hostname, always sanitize
  let filename = 'website-analysis.pdf';
  try {
    const hostname = new URL(analysis.url).hostname;
    const dateStr = (analysis.completed_at ?? analysis.created_at ?? '').slice(0, 10);
    filename = sanitizePdfFilename(hostname, dateStr);
  } catch {
    // keep default
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
