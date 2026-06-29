#!/usr/bin/env npx tsx
/**
 * One-time migration: re-encrypt all v1 API keys (SHA-256 KDF) to v2 (PBKDF2-SHA256).
 *
 * Background
 * ----------
 * SE4 fix (commit 8a6854d) changed the AES-256-GCM key derivation from raw SHA-256
 * to PBKDF2-SHA256 (600K iterations). New keys are written with a "v2:" prefix.
 * Existing rows without that prefix use the old SHA-256 KDF and remain crackable
 * offline until re-encrypted. `legacyKey()` stays in generate.ts only to support
 * those rows — once this script runs successfully, remove it.
 *
 * Usage
 * -----
 *   API_KEY_ENCRYPTION_SECRET="<secret>" \
 *   NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   npx tsx scripts/migrate-api-keys-v2.ts
 *
 * After a successful run (exit 0), remove `legacyKey()` from
 * src/lib/api-keys/generate.ts and delete this script.
 *
 * Safety
 * ------
 * - Idempotent: rows already in v2 format are skipped automatically.
 * - Dry-run mode: set DRY_RUN=1 to preview without writing.
 * - The script reads only `id` and `key_encrypted`; it never logs raw key values.
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ── Key derivation (inlined to avoid Next.js module resolution) ───────────────

const KDF_SALT       = Buffer.from('website-analyzer-api-key-kdf-v1');
const KDF_ITERATIONS = 600_000;
const KDF_KEY_LEN    = 32;

let _cachedSecret: string | undefined;
let _cachedKey:    Buffer | undefined;

function deriveKeyV2(secret: string): Buffer {
  if (_cachedSecret === secret && _cachedKey) return _cachedKey;
  _cachedKey    = crypto.pbkdf2Sync(secret, KDF_SALT, KDF_ITERATIONS, KDF_KEY_LEN, 'sha256');
  _cachedSecret = secret;
  return _cachedKey;
}

function legacyKeyV1(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptV1(stored: string, secret: string): string | null {
  const parts = stored.split('.');
  if (parts.length !== 3) return null;
  const [ivHex, encHex, tagHex] = parts;
  try {
    const ivBuf  = Buffer.from(ivHex,  'hex');
    const encBuf = Buffer.from(encHex, 'hex');
    const tagBuf = Buffer.from(tagHex, 'hex');
    if (ivBuf.length !== 12) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', legacyKeyV1(secret), ivBuf);
    decipher.setAuthTag(tagBuf);
    return decipher.update(encBuf, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

function encryptV2(raw: string, secret: string): string {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKeyV2(secret), iv);
  const enc    = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  return `v2:${iv.toString('hex')}.${enc.toString('hex')}.${cipher.getAuthTag().toString('hex')}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const secret         = process.env.API_KEY_ENCRYPTION_SECRET;
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun         = process.env.DRY_RUN === '1';

  if (!secret)         throw new Error('API_KEY_ENCRYPTION_SECRET is required');
  if (secret.length < 32) throw new Error('API_KEY_ENCRYPTION_SECRET must be >= 32 characters');
  if (!supabaseUrl)    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  if (dryRun) console.log('DRY RUN — no DB writes will occur.\n');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find rows that are non-null and don't yet have the v2 prefix.
  const { data: rows, error: fetchError } = await supabase
    .from('api_keys')
    .select('id, key_encrypted')
    .not('key_encrypted', 'is', null)
    .not('key_encrypted', 'like', 'v2:%');

  if (fetchError) throw new Error(`DB fetch failed: ${fetchError.message}`);

  if (!rows || rows.length === 0) {
    console.log('✓ Nothing to migrate — all rows are already v2 format (or no encrypted keys exist).');
    console.log('  Safe to remove legacyKey() from src/lib/api-keys/generate.ts.');
    return;
  }

  console.log(`Found ${rows.length} v1 row(s) to migrate.`);
  console.log('Deriving PBKDF2 key (600K iterations, ~200ms)...');
  deriveKeyV2(secret); // warm cache before the loop
  console.log('Key derived. Starting migration...\n');

  let migrated = 0;
  let failed   = 0;

  for (const row of rows) {
    const raw = decryptV1(row.key_encrypted as string, secret);
    if (!raw) {
      console.error(`  ✗ ${row.id} — could not decrypt (malformed ciphertext or wrong secret)`);
      failed++;
      continue;
    }

    const v2 = encryptV2(raw, secret);

    if (dryRun) {
      console.log(`  ~ ${row.id} — would re-encrypt to v2 format`);
      migrated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ key_encrypted: v2 })
      .eq('id', row.id);

    if (updateError) {
      console.error(`  ✗ ${row.id} — DB update failed: ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${row.id} — migrated`);
      migrated++;
    }
  }

  console.log(`\nResult: ${migrated} migrated, ${failed} failed.`);

  if (failed > 0) {
    console.error('\nSome rows failed — do NOT remove legacyKey() yet. Re-run to retry.');
    process.exit(1);
  }

  console.log('\nAll rows migrated to v2 format.');
  if (!dryRun) {
    console.log('Next step: remove legacyKey() from src/lib/api-keys/generate.ts and delete this script.');
  }
}

main().catch(err => {
  console.error('\nMigration aborted:', err.message);
  process.exit(1);
});
