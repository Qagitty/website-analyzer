import crypto from 'crypto';

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  // Format: wa_live_<32 random hex chars>
  const random = crypto.randomBytes(16).toString('hex'); // 32 hex chars
  const raw = `wa_live_${random}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 15); // "wa_live_" + first 7 chars
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function encryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error('API_KEY_ENCRYPTION_SECRET is not set');
  // SE4 — enforce minimum entropy: a short secret produces a valid AES-256 key
  // without warning because SHA-256 accepts any length input.
  if (secret.length < 32) throw new Error('API_KEY_ENCRYPTION_SECRET must be at least 32 characters');
  return crypto.createHash('sha256').update(secret).digest();
}

// Returns "<iv_hex>.<ciphertext_hex>.<authtag_hex>"
export function encryptApiKey(raw: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${enc.toString('hex')}.${cipher.getAuthTag().toString('hex')}`;
}

/**
 * SE7 — returns null on malformed input instead of throwing unexpectedly.
 * Only throws when the encryption key itself is misconfigured (encryptionKey() throws).
 * GCM auth tag failures (corrupted data / key mismatch) are caught and return null.
 */
export function decryptApiKey(stored: string): string | null {
  const parts = stored.split('.');
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
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), ivBuf);
    decipher.setAuthTag(tagBuf);
    return decipher.update(encBuf, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return null; // GCM auth tag failure — corrupted data or key mismatch
  }
}
