import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateXLSX } from '@/lib/exports/xlsx';
import type { Analysis } from '@/types/analysis';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const buffer = await generateXLSX(data as unknown as Analysis);
  const hostname = (() => { try { return new URL(data.url).hostname; } catch { return 'report'; } })();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="report-${hostname}.xlsx"`,
    },
  });
}
