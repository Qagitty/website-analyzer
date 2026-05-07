import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateReportPDF } from '@/lib/pdf/generator';
import type { Analysis } from '@/types/analysis';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const pdfBuffer = await generateReportPDF(analysis as unknown as Analysis);
  const hostname = new URL(analysis.url).hostname;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${hostname}.pdf"`,
    },
  });
}
