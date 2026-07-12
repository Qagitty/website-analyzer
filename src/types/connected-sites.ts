export interface ConnectedSiteKey {
  id: string;
  key_prefix: string;
  status: 'active' | 'rotated' | 'revoked';
  created_at: string;
  rotated_at: string | null;
  last_used_at: string | null;
}

export interface ConnectedSiteConnectionStatus {
  last_seen_at: string | null;
  sdk_version: string | null;
  script_load_status:
    | 'loaded'
    | 'initialized'
    | 'config_error'
    | 'origin_rejected'
    | 'csp_blocked'
    | 'unknown'
    | null;
  environment: string | null;
}

export interface ConnectedSite {
  id: string;
  user_id: string;
  monitor_id: string | null;
  name: string;
  root_url: string;
  normalized_origin: string;
  canonical_host: string;
  verification_status:
    | 'unverified'
    | 'pending'
    | 'verified'
    | 'failed'
    | 'expired'
    | 'revoked';
  verification_method: 'script' | 'meta_tag' | null;
  verified_at: string | null;
  last_heartbeat_at: string | null;
  last_script_version: string | null;
  is_enabled: boolean;
  telemetry_enabled: boolean;
  indexing_diagnostics_enabled: boolean;
  crawler_visibility_enabled: boolean;
  environment: 'production' | 'staging' | 'development';
  created_at: string;
  updated_at: string;
}

export interface ConnectedSiteWithDetails extends ConnectedSite {
  connected_site_keys: ConnectedSiteKey[];
  site_connection_status: ConnectedSiteConnectionStatus[] | null;
}

export interface MetricAggregate {
  p50: number | null;
  p75: number | null;
  p90: number | null;
  sampleCount: number;
  rating: 'good' | 'needs_improvement' | 'poor' | 'insufficient_data';
}

export interface TelemetrySummary {
  range: '24h' | '7d' | '30d';
  sampleCount: number;
  metrics: {
    lcp?: MetricAggregate;
    cls?: MetricAggregate;
    inp?: MetricAggregate;
    fcp?: MetricAggregate;
    ttfb?: MetricAggregate;
  };
  lastEventAt: string | null;
  telemetryEnabled: boolean;
}

export interface ObservedRoute {
  route: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
  source: string;
}

export interface IndexingPage {
  route: string;
  observation: Record<string, unknown>;
  warnings: string[];
  lastSeen: string;
}

export interface ConnectedSiteViewModel {
  id: string;
  name: string;
  origin: string;
  verificationLabel: string;
  connectionLabel: string;
  lastHeartbeatLabel: string;
  scriptVersion: string | null;
  telemetryEnabled: boolean;
  indexingEnabled: boolean;
  isEnabled: boolean;
  environment: string;
}
