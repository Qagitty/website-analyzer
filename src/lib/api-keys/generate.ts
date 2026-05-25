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
  return crypto.createHash('sha256').update(secret).digest();
}

// Returns "<iv_hex>.<ciphertext_hex>.<authtag_hex>"
export function encryptApiKey(raw: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${enc.toString('hex')}.${cipher.getAuthTag().toString('hex')}`;
}

export function decryptApiKey(stored: string): string {
  const [ivHex, encHex, tagHex] = stored.split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
}
