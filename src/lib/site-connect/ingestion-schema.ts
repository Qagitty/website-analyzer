/**
 * Zod schemas for the site-connect public ingestion endpoint.
 *
 * All inputs from the browser script are validated here before any DB write.
 * Bounds are strict to prevent abuse:
 *   - String fields are length-capped
 *   - Arrays have element limits
 *   - Object depth is bounded by schema shape (no recursive unknowns)
 *   - Prototype-pollution keys are rejected by stripping __proto__, constructor, etc.
 */

import { z } from 'zod';

// ── Shared primitives ──────────────────────────────────────────────────────────

const SafeString  = (max: number) => z.string().max(max).trim();
const SafeUrl     = z.string().max(2048).url().optional();
const SafeVersion = z.string().max(32).regex(/^[0-9a-zA-Z._+-]+$/).optional();
const Timestamp   = z.string().datetime({ offset: true });

// ── SDK metadata ──────────────────────────────────────────────────────────────

const SdkSchema = z.object({
  name:    SafeString(64),
  version: SafeString(32),
});

// ── Individual event types ────────────────────────────────────────────────────

export const HeartbeatEventSchema = z.object({
  type:              z.literal('heartbeat'),
  pageUrl:           SafeString(2048).optional(),
  route:             SafeString(512).optional(),
  environment:       z.enum(['production', 'staging', 'development']).optional(),
  scriptLoadStatus:  z.enum(['loaded', 'initialized', 'config_error', 'origin_rejected', 'csp_blocked', 'unknown']).optional(),
  enabledModules:    z.array(z.string().max(64)).max(20).optional(),
  configVersion:     SafeString(64).optional(),
});

export const VerificationProofEventSchema = z.object({
  type:              z.literal('verification_proof'),
  verificationToken: SafeString(128), // raw token provided by user from dashboard
  pageUrl:           SafeString(2048).optional(),
});

export const WebVitalsEventSchema = z.object({
  type:   z.literal('web_vitals'),
  route:  SafeString(512).optional(),
  metrics: z.object({
    lcp:  z.number().min(0).max(120_000).optional(),   // ms
    cls:  z.number().min(0).max(100).optional(),        // score (0-10 typical, 100 max)
    inp:  z.number().min(0).max(60_000).optional(),    // ms
    fcp:  z.number().min(0).max(120_000).optional(),   // ms
    ttfb: z.number().min(0).max(60_000).optional(),    // ms
  }),
  navigationType: z.enum(['navigate', 'reload', 'back_forward', 'prerender']).optional(),
  deviceCategory: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).optional(),
});

export const RouteObservedEventSchema = z.object({
  type:           z.literal('route_observed'),
  route:          SafeString(512),
  pageUrl:        SafeString(2048).optional(),
  method:         z.enum(['pushState', 'replaceState', 'popstate', 'initial']).optional(),
});

export const IndexabilityObservationSchema = z.object({
  type:           z.literal('indexability_observation'),
  pageUrl:        SafeString(2048).optional(),
  route:          SafeString(512).optional(),
  // Rendered metadata observed client-side
  hasTitle:          z.boolean().optional(),
  titleText:         SafeString(512).optional(),
  hasMetaDescription: z.boolean().optional(),
  hasCanonical:      z.boolean().optional(),
  canonicalHref:     SafeString(2048).optional(),
  hasNoindex:        z.boolean().optional(),
  noindexSource:     z.enum(['meta', 'header', 'unknown']).optional(),
  hasStructuredData: z.boolean().optional(),
  structuredDataTypes: z.array(z.string().max(128)).max(20).optional(),
  hasHreflang:       z.boolean().optional(),
  isClientRendered:  z.boolean().optional(),
});

export const ResourceSummaryEventSchema = z.object({
  type:                  z.literal('resource_summary'),
  failedSameOrigin:      z.number().int().min(0).max(1000).optional(),
  failedCrossOrigin:     z.number().int().min(0).max(1000).optional(),
  slowResourceCount:     z.number().int().min(0).max(1000).optional(),
  totalTransferKb:       z.number().min(0).max(100_000).optional(),
  longTaskCount:         z.number().int().min(0).max(500).optional(),
});

// ── Envelope ──────────────────────────────────────────────────────────────────

const SiteConnectEventSchema = z.discriminatedUnion('type', [
  HeartbeatEventSchema,
  VerificationProofEventSchema,
  WebVitalsEventSchema,
  RouteObservedEventSchema,
  IndexabilityObservationSchema,
  ResourceSummaryEventSchema,
]);

export const SiteConnectEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  eventId:       z.string().uuid(),
  siteKey:       z.string().regex(/^ws_site_[0-9a-f]{32}$/, 'Invalid site key format'),
  sentAt:        Timestamp,
  event:         SiteConnectEventSchema,
  sdk:           SdkSchema,
});

export type SiteConnectEnvelope = z.infer<typeof SiteConnectEnvelopeSchema>;
export type SiteConnectEvent    = z.infer<typeof SiteConnectEventSchema>;

// ── Sanitization ──────────────────────────────────────────────────────────────

const SECRET_PARAM_PATTERN = /[?&](token|key|secret|password|auth|access_token|id_token|code|state|nonce|api_key|apikey|session|csrf|sig|signature)=[^&]*/gi;

/**
 * Strip known-sensitive query parameters from a URL.
 * Applied both in the browser script and server-side.
 */
export function sanitizeUrl(rawUrl: string | undefined | null): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const u = new URL(rawUrl);
    // Remove fragment
    u.hash = '';
    // Remove sensitive query params
    const safeSearch = u.search.replace(SECRET_PARAM_PATTERN, '');
    u.search = safeSearch;
    return u.toString();
  } catch {
    return undefined; // invalid URL — drop it
  }
}

/**
 * Sanitize a route path (strip query params and fragments).
 */
export function sanitizeRoute(route: string | undefined | null): string | undefined {
  if (!route) return undefined;
  try {
    // Route may not be a full URL
    const stripped = route.split('?')[0].split('#')[0];
    return stripped.slice(0, 512) || undefined;
  } catch {
    return undefined;
  }
}
