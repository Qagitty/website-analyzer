import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Bucket name ──────────────────────────────────────────────────────────────
// The bucket MUST be set to PRIVATE in Supabase Dashboard:
//   Storage → screenshots → Edit → uncheck "Public bucket"
// This prevents direct URL access to any file without a signed URL.
const BUCKET = 'screenshots';

// ─── Upload helpers ───────────────────────────────────────────────────────────
// These return the STORAGE PATH (e.g. "screenshots/uuid.png"), not a public URL.
// Paths are stored in the DB.  Use getSignedUrl() to serve files to users.

export async function uploadScreenshot(
  supabase: SupabaseClient,
  analysisId: string,
  buffer: Buffer,
): Promise<string> {
  const path = `screenshots/${analysisId}.png`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Screenshot upload failed: ${error.message}`);

  // Return path, not public URL — callers use getSignedUrl() to serve it
  return path;
}

export async function uploadDesignScreenshot(
  supabase: SupabaseClient,
  analysisId: string,
  buffer: Buffer,
  mimeType: string = 'image/png',
): Promise<string> {
  const ext = mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? 'jpg' : 'png';
  const path = `designs/${analysisId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Design upload failed: ${error.message}`);

  return path;
}

// ─── Signed URL helper ────────────────────────────────────────────────────────
// Generates a time-limited signed URL from a stored path.
//
// @param storedValue  Either a storage path ("screenshots/uuid.png") or a legacy
//                     public URL ("https://xxx.supabase.co/.../screenshots/uuid.png").
//                     Legacy URLs are handled transparently for backward compat.
// @param expiresIn    Seconds until the URL expires (default: 1 hour)

export async function getSignedUrl(
  supabase: SupabaseClient,
  storedValue: string,
  expiresIn = 3600,
): Promise<string> {
  const path = extractPath(storedValue);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL for "${path}": ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Like getSignedUrl but returns null instead of throwing on failure.
 * Use this in Server Components where a missing screenshot is non-fatal.
 */
export async function getSignedUrlOrNull(
  supabase: SupabaseClient,
  storedValue: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!storedValue) return null;
  try {
    return await getSignedUrl(supabase, storedValue, expiresIn);
  } catch (err) {
    console.error('[storage] getSignedUrlOrNull failed:', err);
    return null;
  }
}

export async function uploadLogo(
  supabase: SupabaseClient,
  userId: string,
  buffer: Buffer,
  mimeType: string = 'image/png',
): Promise<string> {
  const ext = mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? 'jpg'
            : mimeType === 'image/webp' ? 'webp'
            : 'png';
  const path = `logos/${userId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Logo upload failed: ${error.message}`);
  return path;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extracts the storage path from either:
 *  - A raw path:  "screenshots/abc.png"
 *  - A legacy public URL: "https://xxx.supabase.co/storage/v1/object/public/screenshots/screenshots/abc.png"
 */
function extractPath(storedValue: string): string {
  if (!storedValue.startsWith('http')) return storedValue;

  // Legacy public URLs contain "/object/public/<bucket>/<path>"
  const marker = `/object/public/${BUCKET}/`;
  const idx = storedValue.indexOf(marker);
  if (idx !== -1) {
    return storedValue.slice(idx + marker.length);
  }

  // Signed URL pattern: "/object/sign/<bucket>/<path>"
  const signMarker = `/object/sign/${BUCKET}/`;
  const signIdx = storedValue.indexOf(signMarker);
  if (signIdx !== -1) {
    const withQuery = storedValue.slice(signIdx + signMarker.length);
    return withQuery.split('?')[0];
  }

  // Fallback: return as-is (will fail at Supabase; nothing we can do)
  return storedValue;
}
