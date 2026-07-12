import { formatDistanceToNow } from 'date-fns';
import type { ConnectedSiteWithDetails, ConnectedSiteViewModel } from '@/types/connected-sites';

const VERIFICATION_LABELS: Record<string, string> = {
  unverified: 'Unverified',
  pending: 'Verification pending',
  verified: 'Verified',
  failed: 'Verification failed',
  expired: 'Verification expired',
  revoked: 'Revoked',
};

const SCRIPT_STATUS_LABELS: Record<string, string> = {
  loaded: 'Script active',
  initialized: 'Script active',
  config_error: 'Configuration invalid',
  origin_rejected: 'Origin rejected',
  csp_blocked: 'CSP may be blocking the script',
  unknown: 'Script status unknown',
};

export function toConnectedSiteViewModel(
  site: ConnectedSiteWithDetails
): ConnectedSiteViewModel {
  const status = site.site_connection_status?.[0] ?? null;

  let connectionLabel = 'No recent heartbeat';
  if (!site.is_enabled) {
    connectionLabel = 'Disabled';
  } else if (site.verification_status === 'revoked') {
    connectionLabel = 'Revoked';
  } else if (status?.last_seen_at) {
    const ageMs = Date.now() - new Date(status.last_seen_at).getTime();
    if (ageMs < 25 * 3600_000) {
      connectionLabel =
        SCRIPT_STATUS_LABELS[status.script_load_status ?? 'unknown'] ?? 'Active';
    } else {
      connectionLabel = 'No recent heartbeat';
    }
  } else if (site.verification_status !== 'verified') {
    connectionLabel = 'Script not detected';
  }

  let lastHeartbeatLabel = 'Never';
  const hb = site.last_heartbeat_at ?? status?.last_seen_at ?? null;
  if (hb) {
    try {
      lastHeartbeatLabel = formatDistanceToNow(new Date(hb), { addSuffix: true });
    } catch {
      lastHeartbeatLabel = hb;
    }
  }

  return {
    id: site.id,
    name: site.name,
    origin: site.normalized_origin,
    verificationLabel:
      VERIFICATION_LABELS[site.verification_status] ?? site.verification_status,
    connectionLabel,
    lastHeartbeatLabel,
    scriptVersion: site.last_script_version ?? status?.sdk_version ?? null,
    telemetryEnabled: site.telemetry_enabled,
    indexingEnabled: site.indexing_diagnostics_enabled,
    isEnabled: site.is_enabled,
    environment: site.environment ?? 'production',
  };
}
