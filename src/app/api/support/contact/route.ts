import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendSupportMessage } from '@/lib/email/resend';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkWebRateLimit } from '@/lib/rate-limit/web';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required').max(50),
  message: z.string().min(1, 'Message is required').max(5000),
});

export async function POST(req: NextRequest) {
  // Rate limit: 3 requests per 10 minutes per IP — prevents contact form spam
  const limited = await checkWebRateLimit(req, 'support-contact', 3, 600);
  if (limited) return limited;

  // Reject oversized bodies (max 10 KB — well above the 5 000-char message limit)
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 10_240) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  await supabase.from('support_messages').insert(parsed.data);

  await sendSupportMessage(parsed.data);

  return NextResponse.json({ ok: true });
}
