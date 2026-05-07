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
