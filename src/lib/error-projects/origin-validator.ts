export function isOriginAllowed(
  requestOrigin: string | null,
  normalizedOrigin: string,
  allowedOrigins: string[],
): boolean {
  if (!requestOrigin) return false;
  const allAllowed = [normalizedOrigin, ...allowedOrigins].map((o) =>
    o.toLowerCase().replace(/\/$/, ''),
  );
  return allAllowed.includes(requestOrigin.toLowerCase().replace(/\/$/, ''));
}

export function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
    Vary:                           'Origin',
  };
}
