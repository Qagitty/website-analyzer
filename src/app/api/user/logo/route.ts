import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { uploadLogo } from '@/lib/supabase/storage';
import { hasFeature, featureGateError } from '@/lib/billing/limits';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Feature gate: white-label logo requires Agency+
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = subscription?.plan ?? 'free';
  if (!hasFeature(plan, 'whiteLabelPdf')) {
    return NextResponse.json(featureGateError('whiteLabelPdf', 'agency'), { status: 403 });
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const file = formData.get('logo');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing logo file' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PNG, JPG, or WebP.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Logo must be under 2 MB.' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let logoPath: string;
  try {
    logoPath = await uploadLogo(supabase, user.id, buffer, file.type);
  } catch (err) {
    console.error('[logo] upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  // Save path to user_settings
  const { error: updateError } = await supabase
    .from('user_settings')
    .update({ logo_url: logoPath } as any)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ logoPath }, { status: 200 });
}

// DELETE /api/user/logo — remove logo
export async function DELETE() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase
    .from('user_settings')
    .update({ logo_url: null } as any)
    .eq('user_id', user.id);

  return new NextResponse(null, { status: 204 });
}
