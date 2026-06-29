import crypto from 'crypto';

// SE4 — PBKDF2 key derivation parameters.
// A fixed application salt is acceptable here: the purpose is to slow down
// offline brute-force of the env var (GPU SHA-256 at ~10B/sec vs ~10K/sec
// with 600K PBKDF2 iterations). We're not protecting against cross-app
// rainbow tables (env vars are unique per deployment).
const KDF_SALT       = Buffer.from('website-analyzer-api-key-kdf-v1');
const KDF_ITERATIONS = 600_000;
const KDF_KEY_LEN    = 32; // AES-256

// Cache the PBKDF2-derived key per process — PBKDF2 is intentionally slow
// and `API_KEY_ENCRYPTION_SECRET` is constant at runtime.
let _cachedSecret: string | undefined;
let _cachedKey:    Buffer  | undefined;

function validateSecret(secret: string | undefined): string {
  if (!secret) throw new Error('API_KEY_ENCRYPTION_SECRET is not set');
  if (secret.length < 32) throw new Error('API_KEY_ENCRYPTION_SECRET must be at least 32 characters');
  return secret;
}

function deriveKey(secret: string): Buffer {
  if (_cachedSecret === secret && _cachedKey) return _cachedKey;
  _cachedKey    = crypto.pbkdf2Sync(secret, KDF_SALT, KDF_ITERATIONS, KDF_KEY_LEN, 'sha256');
  _cachedSecret = secret;
  return _cachedKey;
}

/** Legacy SHA-256 KDF — used only to decrypt v1 keys already in the DB. */
function legacyKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  // Format: wa_live_<32 random hex chars>
  const random = crypto.randomBytes(16).toString('hex');
  const raw    = `wa_live_${random}`;
  const hash   = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 15); // "wa_live_" + first 7 chars
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Encrypts an API key for storage.
 * Output format: "v2:<iv_hex>.<ciphertext_hex>.<authtag_hex>"
 * (v1 legacy format omits the "v2:" prefix and used SHA-256 KDF)
 */
export function encryptApiKey(raw: string): string {
  const secret = validateSecret(process.env.API_KEY_ENCRYPTION_SECRET);
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const enc    = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  return `v2:${iv.toString('hex')}.${enc.toString('hex')}.${cipher.getAuthTag().toString('hex')}`;
}

/**
 * Decrypts an API key from storage.
 * SE7 — returns null on malformed input; only throws when the encryption
 *        key itself is misconfigured.
 * SE4 — supports both:
 *   v2 (new): "v2:<iv>.<enc>.<tag>" — PBKDF2-SHA256 KDF, 600K iterations
 *   v1 (legacy): "<iv>.<enc>.<tag>" — raw SHA-256 KDF (read-only; no new v1 keys)
 */
export function decryptApiKey(stored: string): string | null {
  const secret = validateSecret(process.env.API_KEY_ENCRYPTION_SECRET);

  const isV2 = stored.startsWith('v2:');
  const body  = isV2 ? stored.slice(3) : stored;

  const parts = body.split('.');
  if (parts.length !== 3) return null;

  const [ivHex, encHex, tagHex] = parts;
  let ivBuf: Buffer, encBuf: Buffer, tagBuf: Buffer;
  try {
    ivBuf  = Buffer.from(ivHex,  'hex');
    encBuf = Buffer.from(encHex, 'hex');
    tagBuf = Buffer.from(tagHex, 'hex');
  } catch {
    return null;
  }
  if (ivBuf.length !== 12) return null;

  try {
    const key     = isV2 ? deriveKey(secret) : legacyKey(secret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
    decipher.setAuthTag(tagBuf);
    return decipher.update(encBuf, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return null; // GCM auth tag failure — corrupted data or key mismatch
  }
}
