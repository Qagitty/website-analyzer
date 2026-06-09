/**
 * GET  /api/widget/key — return current widget key + settings (auth required)
 * POST /api/widget/key — regenerate widget key (auth required)
 * PATCH /api/widget/key — update widget settings (buttonText, buttonColor, position, showEmail)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateWidgetKey } from '@/lib/widget/key';
import { hasFeature, featureGateError } from '@/lib/billing/limits';
import { z } from 'zod';

const settingsSchema = z.object({
  buttonText:  z.string().max(60).optional(),
  buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position:    z.enum(['bottom-right', 'bottom-left', 'bottom-center']).optional(),
  showEmail:   z.boolean().optional(),
});

async function getOrCreateKey(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<string> {
  const { data } = await (supabase.from('user_settings') as any)
    .select('widget_key')
    .eq('user_id', userId)
    .single();

  if (data?.widget_key) return data.widget_key;

  // Auto-generate on first access
  const newKey = generateWidgetKey();
  await (supabase.from('user_settings') as any)
    .update({ widget_key: newKey })
    .eq('user_id', userId);
  return newKey;
}

export async function GET() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subscription } = await supabase
    .from('subscriptions').select('plan').eq('user_id', user.id).single();
  const plan = subscription?.plan ?? 'free';
  if (!hasFeature(plan, 'leadWidget')) {
    return NextResponse.json(featureGateError('leadWidget', 'agency'), { status: 403 });
  }

  const { data: settings } = await (supabase.from('user_settings') as any)
    .select('widget_key, widget_settings')
    .eq('user_id', user.id)
    .single();

  let key = settings?.widget_key;
  if (!key) key = await getOrCreateKey(supabase, user.id);

  const widgetSettings = settings?.widget_settings ?? {};
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return NextResponse.json({
    key,
    settings: widgetSettings,
    hostedUrl:  `${appUrl}/widget/${key}`,
    scriptUrl:  `${appUrl}/api/widget-script?key=${key}`,
    embedSnippet: `<script src="${appUrl}/api/widget-script" data-key="${key}" async></script>`,
    iframeSnippet: `<iframe src="${appUrl}/widget/${key}" width="100%" height="480" frameborder="0" title="Website Audit Widget" loading="lazy"></iframe>`,
  });
}

// POST: regenerate widget key
export async function POST() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subscription } = await supabase
    .from('subscriptions').select('plan').eq('user_id', user.id).single();
  const plan = subscription?.plan ?? 'free';
  if (!hasFeature(plan, 'leadWidget')) {
    return NextResponse.json(featureGateError('leadWidget', 'agency'), { status: 403 });
  }

  const newKey = generateWidgetKey();
  await (supabase.from('user_settings') as any)
    .update({ widget_key: newKey })
    .eq('user_id', user.id);

  return NextResponse.json({ key: newKey });
}

// PATCH: update widget settings
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subscription } = await supabase
    .from('subscriptions').select('plan').eq('user_id', user.id).single();
  const plan = subscription?.plan ?? 'free';
  if (!hasFeature(plan, 'leadWidget')) {
    return NextResponse.json(featureGateError('leadWidget', 'agency'), { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Merge into existing settings
  const { data: current } = await (supabase.from('user_settings') as any)
    .select('widget_settings').eq('user_id', user.id).single();

  const merged = { ...(current?.widget_settings ?? {}), ...parsed.data };

  await (supabase.from('user_settings') as any)
    .update({ widget_settings: merged })
    .eq('user_id', user.id);

  return NextResponse.json({ settings: merged });
}
