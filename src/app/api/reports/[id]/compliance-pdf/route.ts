import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateCompliancePDF } from '@/lib/pdf/compliance-generator';
import { planAtLeast } from '@/lib/stripe/plans';
import type { Analysis } from '@/types/analysis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Compliance PDF requires Pro plan or higher
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (!planAtLeast(subscription?.plan ?? 'free', 'pro')) {
    return NextResponse.json(
      { error: 'Compliance PDF reports require the Pro plan or higher.' },
      { status: 402 },
    );
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
    .select('agency_name')
    .eq('user_id', user.id)
    .single();

  const agencyName = (settings as any)?.agency_name ?? undefined;

  const pdfBuffer = await generateCompliancePDF(
    analysis as unknown as Analysis,
    agencyName,
  );

  let hostname = 'site';
  try { hostname = new URL(analysis.url).hostname; } catch {}

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="compliance-report-${hostname}.pdf"`,
    },
  });
}
