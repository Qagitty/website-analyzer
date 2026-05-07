import type { SupabaseClient } from '@supabase/supabase-js';

export async function uploadScreenshot(
  supabase: SupabaseClient,
  analysisId: string,
  buffer: Buffer
): Promise<string> {
  const path = `screenshots/${analysisId}.png`;

  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, buffer, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Screenshot upload failed: ${error.message}`);

  const { data } = supabase.storage.from('screenshots').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadDesignScreenshot(
  supabase: SupabaseClient,
  analysisId: string,
  buffer: Buffer,
  mimeType: string = 'image/png'
): Promise<string> {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const path = `designs/${analysisId}.${ext}`;

  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Design upload failed: ${error.message}`);

  const { data } = supabase.storage.from('screenshots').getPublicUrl(path);
  return data.publicUrl;
}
