import { createHash } from 'crypto';

interface FingerprintInput {
  projectId:        string;
  exceptionType?:   string;
  message:          string;
  topFrame?:        { filename?: string; function?: string };
  customFingerprint?: string[];
}

function normalizeMessage(msg: string): string {
  return msg
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '{id}')
    .replace(/\b\d+\b/g, '{n}')
    .replace(/\b[0-9a-f]{6,}\b/gi, '{hex}')
    .slice(0, 200);
}

export function calculateFingerprint(input: FingerprintInput): string {
  if (input.customFingerprint && input.customFingerprint.length > 0) {
    const parts = ['custom', input.projectId, ...input.customFingerprint.slice(0, 5)].join('|');
    return createHash('sha256').update(parts).digest('hex').slice(0, 40);
  }

  const parts = [
    input.projectId,
    input.exceptionType ?? 'Error',
    normalizeMessage(input.message),
    input.topFrame?.filename?.replace(/https?:\/\/[^/]+/, '').replace(/\?.*$/, '') ?? '',
    input.topFrame?.function ?? '',
  ].join('|');

  return createHash('sha256').update(parts).digest('hex').slice(0, 40);
}

export function normalizeStackTitle(
  exceptionType: string | undefined,
  message: string,
): string {
  const type = exceptionType ?? 'Error';
  const msg  = message.slice(0, 100);
  return `${type}: ${msg}`;
}
