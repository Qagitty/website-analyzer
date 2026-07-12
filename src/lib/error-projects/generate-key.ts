import { encryptApiKey } from '@/lib/api-keys/generate';
import { createHash, randomBytes } from 'crypto';

const PREFIX = 'ws_err_';

export function generateErrorProjectKey(): {
  raw: string;
  hash: string;
  prefix: string;
  encrypted: string;
} {
  const raw       = PREFIX + randomBytes(16).toString('hex');
  const hash      = createHash('sha256').update(raw).digest('hex');
  const prefix    = raw.slice(0, PREFIX.length + 6) + '...';
  const encrypted = encryptApiKey(raw);
  return { raw, hash, prefix, encrypted };
}

export function hashErrorProjectKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
