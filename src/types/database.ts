// Manually maintained until `npm run db:types` can generate from live Supabase project.
// JSONB columns use `unknown` to avoid recursive type issues with the Supabase client generic.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AnalysisStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';
type Plan = 'free' | 'pro' | 'agency' | 'compliance';
type SubStatus = 'active' | 'canceled' | 'past_due' | 'trialing';
type MonitorFrequency = 'daily' | 'weekly';
type TeamRole = 'member' | 'admin';
type TeamStatus = 'pending' | 'active' | 'rejected';
type RemediationStatus = 'open' | 'in_progress' | 'resolved' | 'verified';

// ── Standalone row types (no self-referencing via Database) ─────────────────

type AnalysisRow = {
  id: string;
  user_id: string;
  url: string;
  status: AnalysisStatus;
  screenshot_url: string | null;
  lighthouse_scores: unknown;
  console_errors: unknown;
  accessibility_issues: unknown;
  network_requests: unknown;
  ai_insights: unknown;
  ai_summary: string | null;
  design_screenshot_url: string | null;  // migration 004
  design_comparison: unknown;            // migration 004
  crawl_pages: unknown;                  // migration 009
  error_message: string | null;
  queue_position: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AnalysisInsert = {
  id?: string;
  user_id: string;
  url: string;
  status?: AnalysisStatus;
  screenshot_url?: string | null;
  lighthouse_scores?: unknown;
  console_errors?: unknown;
  accessibility_issues?: unknown;
  network_requests?: unknown;
  ai_insights?: unknown;
  ai_summary?: string | null;
  design_screenshot_url?: string | null;
  design_comparison?: unknown;
  crawl_pages?: unknown;
  error_message?: string | null;
  queue_position?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AnalysisUpdate = {
  status?: AnalysisStatus | string;
  screenshot_url?: string | null;
  lighthouse_scores?: unknown;
  console_errors?: unknown;
  accessibility_issues?: unknown;
  network_requests?: unknown;
  ai_insights?: unknown;
  ai_summary?: string | null;
  design_screenshot_url?: string | null;
  design_comparison?: unknown;
  crawl_pages?: unknown;
  error_message?: string | null;
  queue_position?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
};

type UserSettingsRow = {
  id: string;
  user_id: string;
  credits: number;
  credits_used: number;
  notifications: unknown;
  preferences: unknown;
  agency_name: string | null;
  brand_color: string | null;
  show_powered_by: boolean;
  logo_url: string | null;
  plan: string | null;
  widget_key: string | null;
  widget_settings: unknown;
  created_at: string;
  updated_at: string;
};

type UserSettingsInsert = {
  id?: string;
  user_id: string;
  credits?: number;
  credits_used?: number;
  notifications?: unknown;
  preferences?: unknown;
  agency_name?: string | null;
  brand_color?: string | null;
  show_powered_by?: boolean;
  logo_url?: string | null;
  plan?: string | null;
  widget_key?: string | null;
  widget_settings?: unknown;
  created_at?: string;
  updated_at?: string;
};

type UserSettingsUpdate = {
  credits?: number;
  credits_used?: number;
  notifications?: unknown;
  preferences?: unknown;
  agency_name?: string | null;
  brand_color?: string | null;
  show_powered_by?: boolean;
  logo_url?: string | null;
  plan?: string | null;
  widget_key?: string | null;
  widget_settings?: unknown;
  updated_at?: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  status: SubStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

type SubscriptionInsert = {
  id?: string;
  user_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan?: Plan;
  status?: SubStatus;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  created_at?: string;
  updated_at?: string;
};

type SubscriptionUpdate = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan?: Plan | string;
  status?: SubStatus | string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  updated_at?: string;
};

type SupportMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  read: boolean;
  created_at: string;
};

type SupportMessageInsert = {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  read?: boolean;
  created_at?: string;
};

type SupportMessageUpdate = {
  read?: boolean;
};

// ── Monitor ──────────────────────────────────────────────────────────────────

type MonitorStatus = 'active' | 'paused' | 'disabled' | 'error' | 'deleted';

type MonitorRow = {
  id: string;
  user_id: string;
  url: string;
  frequency: MonitorFrequency;
  is_active: boolean;
  notify_on_score_drop: boolean;
  score_drop_threshold: number;
  last_run_at: string | null;
  next_run_at: string;
  last_analysis_id: string | null;
  last_scores: unknown;
  created_at: string;
  updated_at: string;
  // v2 columns (migration 023)
  schema_version: string | null;
  normalized_root_url: string | null;
  organization_id: string | null;
  schedule: unknown | null;
  scope: unknown | null;
  comparison_policy: unknown | null;
  alert_policy: unknown | null;
  retention_policy: unknown | null;
  status: MonitorStatus | null;
  baseline_policy: string | null;
  last_run_id: string | null;
  // migration 025
  page_mode: 'homepage' | 'important' | 'all' | 'custom' | null;
  max_pages: number | null;
  pages_last_discovered_at: string | null;
};

type MonitorInsert = {
  id?: string;
  user_id: string;
  url: string;
  frequency?: MonitorFrequency;
  is_active?: boolean;
  notify_on_score_drop?: boolean;
  score_drop_threshold?: number;
  last_run_at?: string | null;
  next_run_at: string;
  last_analysis_id?: string | null;
  last_scores?: unknown;
  created_at?: string;
  updated_at?: string;
  schema_version?: string | null;
  normalized_root_url?: string | null;
  organization_id?: string | null;
  schedule?: unknown | null;
  scope?: unknown | null;
  comparison_policy?: unknown | null;
  alert_policy?: unknown | null;
  retention_policy?: unknown | null;
  status?: MonitorStatus | null;
  baseline_policy?: string | null;
  last_run_id?: string | null;
  page_mode?: 'homepage' | 'important' | 'all' | 'custom' | null;
  max_pages?: number | null;
  pages_last_discovered_at?: string | null;
};

type MonitorUpdate = {
  url?: string;
  frequency?: MonitorFrequency;
  is_active?: boolean;
  notify_on_score_drop?: boolean;
  score_drop_threshold?: number;
  last_run_at?: string | null;
  next_run_at?: string;
  last_analysis_id?: string | null;
  last_scores?: unknown;
  updated_at?: string;
  schema_version?: string | null;
  normalized_root_url?: string | null;
  organization_id?: string | null;
  schedule?: unknown | null;
  scope?: unknown | null;
  comparison_policy?: unknown | null;
  alert_policy?: unknown | null;
  retention_policy?: unknown | null;
  status?: MonitorStatus | null;
  baseline_policy?: string | null;
  last_run_id?: string | null;
  page_mode?: 'homepage' | 'important' | 'all' | 'custom' | null;
  max_pages?: number | null;
  pages_last_discovered_at?: string | null;
};

// ── MonitorPage (migration 025) ───────────────────────────────────────────────

type MonitorPageRow = {
  id: string;
  monitor_id: string;
  url: string;
  page_type: 'root' | 'pinned' | 'discovered';
  is_active: boolean;
  discovery_source: 'manual' | 'sitemap' | 'crawl' | 'initial' | null;
  depth: number;
  importance_score: number;
  last_scores: unknown | null;
  last_analysis_id: string | null;
  last_run_id: string | null;
  last_checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type MonitorPageInsert = {
  id?: string;
  monitor_id: string;
  url: string;
  page_type?: 'root' | 'pinned' | 'discovered';
  is_active?: boolean;
  discovery_source?: 'manual' | 'sitemap' | 'crawl' | 'initial' | null;
  depth?: number;
  importance_score?: number;
  last_scores?: unknown | null;
  last_analysis_id?: string | null;
  last_run_id?: string | null;
  last_checked_at?: string | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

type MonitorPageUpdate = {
  page_type?: 'root' | 'pinned' | 'discovered';
  is_active?: boolean;
  discovery_source?: 'manual' | 'sitemap' | 'crawl' | 'initial' | null;
  depth?: number;
  importance_score?: number;
  last_scores?: unknown | null;
  last_analysis_id?: string | null;
  last_run_id?: string | null;
  last_checked_at?: string | null;
  sort_order?: number;
  updated_at?: string;
};

// ── MonitorRun (migration 023) ────────────────────────────────────────────────

type MonitorRunStatus =
  | 'scheduled' | 'claimed' | 'queued' | 'running'
  | 'partial' | 'completed' | 'failed' | 'cancelled' | 'superseded';

type MonitorRunRow = {
  id: string;
  monitor_id: string;
  analysis_id: string | null;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  status: MonitorRunStatus;
  trigger: 'schedule' | 'manual' | 'deployment' | 'retry';
  attempt: number;
  configuration_snapshot: unknown | null;
  baseline_run_id: string | null;
  comparison_result: unknown | null;
  alert_evaluation: unknown | null;
  failure_origin: string | null;
  errors: unknown;
  usage: unknown | null;
  // migration 026 — multi-page aggregate counters
  total_pages: number | null;
  queued_pages: number | null;
  completed_pages: number | null;
  failed_pages: number | null;
  created_at: string;
  updated_at: string;
};

type MonitorRunInsert = {
  id?: string;
  monitor_id: string;
  analysis_id?: string | null;
  scheduled_for: string;
  started_at?: string | null;
  completed_at?: string | null;
  status?: MonitorRunStatus;
  trigger?: 'schedule' | 'manual' | 'deployment' | 'retry';
  attempt?: number;
  configuration_snapshot?: unknown | null;
  baseline_run_id?: string | null;
  comparison_result?: unknown | null;
  alert_evaluation?: unknown | null;
  failure_origin?: string | null;
  errors?: unknown;
  usage?: unknown | null;
  created_at?: string;
  updated_at?: string;
};

type MonitorRunUpdate = Partial<Omit<MonitorRunInsert, 'monitor_id'>>;

// ── MonitorIncident (migration 023) ───────────────────────────────────────────

type MonitorIncidentRow = {
  id: string;
  monitor_id: string;
  fingerprint: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'acknowledged' | 'resolved' | 'muted' | 'reopened';
  first_detected_run_id: string | null;
  last_detected_run_id: string | null;
  resolved_run_id: string | null;
  affected_pages: unknown;
  event_history: unknown;
  occurrence_count: number;
  last_detected_at: string;
  created_at: string;
  updated_at: string;
};

type MonitorIncidentInsert = Partial<MonitorIncidentRow> & {
  monitor_id: string;
  fingerprint: string;
  title: string;
  severity: MonitorIncidentRow['severity'];
};

type MonitorIncidentUpdate = Partial<Omit<MonitorIncidentRow, 'id' | 'monitor_id' | 'fingerprint'>>;

// ── TeamMember ───────────────────────────────────────────────────────────────

type TeamMemberRow = {
  id: string;
  owner_id: string;
  member_email: string;
  member_id: string | null;
  role: TeamRole;
  status: TeamStatus;
  invite_token: string | null;
  invited_at: string;
  accepted_at: string | null;
  invite_expires_at: string | null;  // migration 016
  created_at: string;
};

type TeamMemberInsert = {
  id?: string;
  owner_id: string;
  member_email: string;
  member_id?: string | null;
  role?: TeamRole;
  status?: TeamStatus;
  invite_token?: string | null;
  invited_at?: string;
  accepted_at?: string | null;
  invite_expires_at?: string | null;
  created_at?: string;
};

type TeamMemberUpdate = {
  member_id?: string | null;
  role?: TeamRole;
  status?: TeamStatus;
  invite_token?: string | null;
  accepted_at?: string | null;
  invite_expires_at?: string | null;
};

// ── Webhook ──────────────────────────────────────────────────────────────────

type WebhookRow = {
  id: string;
  user_id: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type WebhookInsert = {
  id?: string;
  user_id: string;
  url: string;
  events?: string[];
  secret?: string | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

type WebhookUpdate = {
  url?: string;
  events?: string[];
  secret?: string | null;
  active?: boolean;
  updated_at?: string;
};

// ── ApiKey ───────────────────────────────────────────────────────────────────

type ApiKeyRow = {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  key_encrypted: string | null;  // migration 013
  last_used_at: string | null;
  requests_today: number;
  created_at: string;
  revoked_at: string | null;
};

type ApiKeyInsert = {
  id?: string;
  user_id: string;
  name?: string;
  key_hash: string;
  key_prefix: string;
  key_encrypted?: string | null;
  last_used_at?: string | null;
  requests_today?: number;
  created_at?: string;
  revoked_at?: string | null;
};

type ApiKeyUpdate = {
  name?: string;
  key_hash?: string;
  key_prefix?: string;
  key_encrypted?: string | null;
  last_used_at?: string | null;
  requests_today?: number;
  revoked_at?: string | null;
};

// ── RemediationItem ──────────────────────────────────────────────────────────

type RemediationItemRow = {
  id: string;
  user_id: string;
  analysis_id: string;
  url: string;
  issue_id: string;
  issue_description: string;
  impact: string;
  wcag_criteria: string[];
  status: RemediationStatus;
  notes: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type RemediationItemInsert = {
  id?: string;
  user_id: string;
  analysis_id: string;
  url: string;
  issue_id: string;
  issue_description: string;
  impact: string;
  wcag_criteria?: string[];
  status?: RemediationStatus;
  notes?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

type RemediationItemUpdate = {
  status?: RemediationStatus;
  notes?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  updated_at?: string;
};

// ── ConnectedSite (migration 028) ────────────────────────────────────────────

type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed' | 'expired' | 'revoked';
type SiteKeyStatus      = 'active' | 'rotated' | 'revoked';
type ScriptLoadStatus   = 'loaded' | 'config_error' | 'origin_rejected' | 'csp_blocked' | 'unknown';
type SiteEnvironment    = 'production' | 'staging' | 'development';

type ConnectedSiteRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  monitor_id: string | null;
  name: string;
  root_url: string;
  normalized_origin: string;
  canonical_host: string;
  verification_status: VerificationStatus;
  verification_method: string | null;
  verified_at: string | null;
  last_verified_at: string | null;
  last_heartbeat_at: string | null;
  last_script_version: string | null;
  is_enabled: boolean;
  telemetry_enabled: boolean;
  indexing_diagnostics_enabled: boolean;
  crawler_visibility_enabled: boolean;
  environment: SiteEnvironment;
  created_at: string;
  updated_at: string;
};

type ConnectedSiteInsert = {
  id?: string;
  user_id: string;
  team_id?: string | null;
  monitor_id?: string | null;
  name: string;
  root_url: string;
  normalized_origin: string;
  canonical_host: string;
  verification_status?: VerificationStatus;
  verification_method?: string | null;
  verified_at?: string | null;
  last_verified_at?: string | null;
  last_heartbeat_at?: string | null;
  last_script_version?: string | null;
  is_enabled?: boolean;
  telemetry_enabled?: boolean;
  indexing_diagnostics_enabled?: boolean;
  crawler_visibility_enabled?: boolean;
  environment?: SiteEnvironment;
  created_at?: string;
  updated_at?: string;
};

type ConnectedSiteUpdate = {
  name?: string;
  monitor_id?: string | null;
  is_enabled?: boolean;
  telemetry_enabled?: boolean;
  indexing_diagnostics_enabled?: boolean;
  crawler_visibility_enabled?: boolean;
  environment?: SiteEnvironment;
  verification_status?: VerificationStatus;
  verification_method?: string | null;
  verified_at?: string | null;
  last_verified_at?: string | null;
  last_heartbeat_at?: string | null;
  last_script_version?: string | null;
  updated_at?: string;
};

type ConnectedSiteKeyRow = {
  id: string;
  connected_site_id: string;
  user_id: string;
  key_prefix: string;
  key_hash: string;
  key_encrypted: string;
  status: SiteKeyStatus;
  rotated_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type ConnectedSiteKeyInsert = {
  id?: string;
  connected_site_id: string;
  user_id: string;
  key_prefix: string;
  key_hash: string;
  key_encrypted: string;
  status?: SiteKeyStatus;
  rotated_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_at?: string;
};

type ConnectedSiteKeyUpdate = {
  status?: SiteKeyStatus;
  rotated_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
};

type SiteVerificationChallengeRow = {
  id: string;
  connected_site_id: string;
  method: string;
  token_hash: string;
  token_encrypted: string;
  expected_value: string;
  expires_at: string;
  consumed_at: string | null;
  attempt_count: number;
  last_attempt_at: string | null;
  created_at: string;
};

type SiteVerificationChallengeInsert = {
  id?: string;
  connected_site_id: string;
  method: string;
  token_hash: string;
  token_encrypted: string;
  expected_value: string;
  expires_at: string;
  consumed_at?: string | null;
  attempt_count?: number;
  last_attempt_at?: string | null;
  created_at?: string;
};

type SiteVerificationChallengeUpdate = {
  consumed_at?: string | null;
  attempt_count?: number;
  last_attempt_at?: string | null;
};

type SiteConnectionStatusRow = {
  connected_site_id: string;
  last_seen_at: string;
  sdk_version: string | null;
  page_url: string | null;
  environment: SiteEnvironment | null;
  script_load_status: ScriptLoadStatus | null;
  config_version: string | null;
  latest_safe_metadata: unknown;
  updated_at: string;
};

type SiteConnectionStatusInsert = {
  connected_site_id: string;
  last_seen_at?: string;
  sdk_version?: string | null;
  page_url?: string | null;
  environment?: SiteEnvironment | null;
  script_load_status?: ScriptLoadStatus | null;
  config_version?: string | null;
  latest_safe_metadata?: unknown;
  updated_at?: string;
};

type SiteConnectionStatusUpdate = Partial<Omit<SiteConnectionStatusInsert, 'connected_site_id'>>;

type SiteTelemetryEventRow = {
  id: string;
  connected_site_id: string;
  event_type: string;
  page_url_sanitized: string | null;
  route: string | null;
  timestamp: string;
  received_at: string;
  metrics: unknown;
  sdk_version: string;
  schema_version: number;
  created_at: string;
};

type SiteTelemetryEventInsert = {
  id?: string;
  connected_site_id: string;
  event_type: string;
  page_url_sanitized?: string | null;
  route?: string | null;
  timestamp: string;
  received_at?: string;
  metrics?: unknown;
  sdk_version?: string;
  schema_version?: number;
  created_at?: string;
};

type SiteTelemetryEventUpdate = never;

// ── Fix Request types (migration 030) ────────────────────────────────────────

type FixRequestStatus =
  | 'draft' | 'ready' | 'sending' | 'sent' | 'delivered' | 'delivery_failed'
  | 'acknowledged' | 'in_review' | 'accepted' | 'declined' | 'in_progress'
  | 'waiting_for_information' | 'fix_submitted' | 'verification_required'
  | 'verified' | 'closed' | 'cancelled';

type FixRequestRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  request_type: string;
  status: FixRequestStatus;
  severity: string;
  title: string;
  summary: string | null;
  technical_description: string | null;
  category: string | null;
  source_type: string;
  source_id: string | null;
  analysis_id: string | null;
  monitor_id: string | null;
  site_id: string | null;
  affected_urls: string[];
  reproduction_steps: string[];
  verification_steps: string[];
  recommended_fix: string | null;
  code_example: string | null;
  evidence: unknown;
  attachments: unknown;
  requested_due_date: string | null;
  requested_priority: string | null;
  recipient_config: unknown;
  delivery_channels: string[];
  cover_message: string | null;
  audit_response: unknown;
  estimate: unknown;
  verification_result: string | null;
  verification_evidence: unknown;
  internal_notes: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type FixRequestInsert = {
  id?: string;
  user_id: string;
  team_id?: string | null;
  request_type: string;
  status?: FixRequestStatus;
  severity?: string;
  title: string;
  summary?: string | null;
  technical_description?: string | null;
  category?: string | null;
  source_type: string;
  source_id?: string | null;
  analysis_id?: string | null;
  monitor_id?: string | null;
  site_id?: string | null;
  affected_urls?: string[];
  reproduction_steps?: string[];
  verification_steps?: string[];
  recommended_fix?: string | null;
  code_example?: string | null;
  evidence?: unknown;
  attachments?: unknown;
  requested_due_date?: string | null;
  requested_priority?: string | null;
  recipient_config?: unknown;
  delivery_channels?: string[];
  cover_message?: string | null;
  audit_response?: unknown;
  estimate?: unknown;
  verification_result?: string | null;
  verification_evidence?: unknown;
  internal_notes?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type FixRequestUpdate = Partial<Omit<FixRequestInsert, 'user_id'>>;

type FixRequestRecipientRow = {
  id: string;
  fix_request_id: string;
  user_id: string;
  recipient_type: string;
  recipient_user_id: string | null;
  team_member_id: string | null;
  display_name: string | null;
  recipient_email: string | null;
  webhook_id: string | null;
  phone_e164: string | null;
  telegram_username: string | null;
  status: string;
  delivery_channel: string | null;
  last_delivery_attempt: string | null;
  last_delivery_status: string | null;
  delivery_error_summary: string | null;
  created_at: string;
  updated_at: string;
};

type FixRequestRecipientInsert = {
  id?: string;
  fix_request_id: string;
  user_id: string;
  recipient_type: string;
  recipient_user_id?: string | null;
  team_member_id?: string | null;
  display_name?: string | null;
  recipient_email?: string | null;
  webhook_id?: string | null;
  phone_e164?: string | null;
  telegram_username?: string | null;
  status?: string;
  delivery_channel?: string | null;
  last_delivery_attempt?: string | null;
  last_delivery_status?: string | null;
  delivery_error_summary?: string | null;
  created_at?: string;
  updated_at?: string;
};

type FixRequestRecipientUpdate = Partial<Omit<FixRequestRecipientInsert, 'fix_request_id' | 'user_id'>>;

type FixRequestDeliveryRow = {
  id: string;
  fix_request_id: string;
  recipient_id: string | null;
  user_id: string;
  channel: string;
  attempt_number: number;
  status: string;
  provider_ref: string | null;
  evidence_level: string | null;
  error_summary: string | null;
  http_status: number | null;
  attempted_at: string;
};

type FixRequestDeliveryInsert = {
  id?: string;
  fix_request_id: string;
  recipient_id?: string | null;
  user_id: string;
  channel: string;
  attempt_number?: number;
  status: string;
  provider_ref?: string | null;
  evidence_level?: string | null;
  error_summary?: string | null;
  http_status?: number | null;
  attempted_at?: string;
};

type FixRequestDeliveryUpdate = Partial<Omit<FixRequestDeliveryInsert, 'fix_request_id' | 'user_id'>>;

type FixRequestMessageRow = {
  id: string;
  fix_request_id: string;
  user_id: string;
  visibility: 'internal' | 'recipient_visible';
  format: 'text' | 'markdown';
  content: string;
  attachment_storage_key: string | null;
  attachment_filename: string | null;
  sender_display_name: string | null;
  sender_is_external: boolean;
  edited_at: string | null;
  created_at: string;
};

type FixRequestMessageInsert = {
  id?: string;
  fix_request_id: string;
  user_id: string;
  visibility?: 'internal' | 'recipient_visible';
  format?: 'text' | 'markdown';
  content: string;
  attachment_storage_key?: string | null;
  attachment_filename?: string | null;
  sender_display_name?: string | null;
  sender_is_external?: boolean;
  edited_at?: string | null;
  created_at?: string;
};

type FixRequestMessageUpdate = Partial<Omit<FixRequestMessageInsert, 'fix_request_id' | 'user_id'>>;

type FixRequestActivityRow = {
  id: string;
  fix_request_id: string;
  user_id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  metadata: unknown;
  actor_is_external: boolean;
  actor_display_name: string | null;
  created_at: string;
};

type FixRequestActivityInsert = {
  id?: string;
  fix_request_id: string;
  user_id: string;
  event_type: string;
  previous_status?: string | null;
  new_status?: string | null;
  metadata?: unknown;
  actor_is_external?: boolean;
  actor_display_name?: string | null;
  created_at?: string;
};

type FixRequestActivityUpdate = never;

type FixRequestPublicLinkRow = {
  id: string;
  fix_request_id: string;
  user_id: string;
  token: string;
  access_scope: 'standard' | 'full_technical';
  can_view_messages: boolean;
  can_post_messages: boolean;
  can_acknowledge: boolean;
  can_submit_response: boolean;
  expires_at: string;
  is_revoked: boolean;
  revoked_at: string | null;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
};

type FixRequestPublicLinkInsert = {
  id?: string;
  fix_request_id: string;
  user_id: string;
  token: string;
  access_scope?: 'standard' | 'full_technical';
  can_view_messages?: boolean;
  can_post_messages?: boolean;
  can_acknowledge?: boolean;
  can_submit_response?: boolean;
  expires_at: string;
  is_revoked?: boolean;
  revoked_at?: string | null;
  view_count?: number;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  created_at?: string;
};

type FixRequestPublicLinkUpdate = Partial<Omit<FixRequestPublicLinkInsert, 'fix_request_id' | 'user_id' | 'token'>>;

// ── Main Database type ───────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      analyses: {
        Row: AnalysisRow;
        Insert: AnalysisInsert;
        Update: AnalysisUpdate;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: UserSettingsInsert;
        Update: UserSettingsUpdate;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: SubscriptionInsert;
        Update: SubscriptionUpdate;
        Relationships: [];
      };
      support_messages: {
        Row: SupportMessageRow;
        Insert: SupportMessageInsert;
        Update: SupportMessageUpdate;
        Relationships: [];
      };
      monitors: {
        Row: MonitorRow;
        Insert: MonitorInsert;
        Update: MonitorUpdate;
        Relationships: [];
      };
      team_members: {
        Row: TeamMemberRow;
        Insert: TeamMemberInsert;
        Update: TeamMemberUpdate;
        Relationships: [];
      };
      webhooks: {
        Row: WebhookRow;
        Insert: WebhookInsert;
        Update: WebhookUpdate;
        Relationships: [];
      };
      api_keys: {
        Row: ApiKeyRow;
        Insert: ApiKeyInsert;
        Update: ApiKeyUpdate;
        Relationships: [];
      };
      remediation_items: {
        Row: RemediationItemRow;
        Insert: RemediationItemInsert;
        Update: RemediationItemUpdate;
        Relationships: [];
      };
      monitor_runs: {
        Row: MonitorRunRow;
        Insert: MonitorRunInsert;
        Update: MonitorRunUpdate;
        Relationships: [];
      };
      monitor_incidents: {
        Row: MonitorIncidentRow;
        Insert: MonitorIncidentInsert;
        Update: MonitorIncidentUpdate;
        Relationships: [];
      };
      monitor_pages: {
        Row: MonitorPageRow;
        Insert: MonitorPageInsert;
        Update: MonitorPageUpdate;
        Relationships: [];
      };
      connected_sites: {
        Row: ConnectedSiteRow;
        Insert: ConnectedSiteInsert;
        Update: ConnectedSiteUpdate;
        Relationships: [];
      };
      connected_site_keys: {
        Row: ConnectedSiteKeyRow;
        Insert: ConnectedSiteKeyInsert;
        Update: ConnectedSiteKeyUpdate;
        Relationships: [];
      };
      site_verification_challenges: {
        Row: SiteVerificationChallengeRow;
        Insert: SiteVerificationChallengeInsert;
        Update: SiteVerificationChallengeUpdate;
        Relationships: [];
      };
      site_connection_status: {
        Row: SiteConnectionStatusRow;
        Insert: SiteConnectionStatusInsert;
        Update: SiteConnectionStatusUpdate;
        Relationships: [];
      };
      site_telemetry_events: {
        Row: SiteTelemetryEventRow;
        Insert: SiteTelemetryEventInsert;
        Update: SiteTelemetryEventUpdate;
        Relationships: [];
      };
      fix_requests: {
        Row: FixRequestRow;
        Insert: FixRequestInsert;
        Update: FixRequestUpdate;
        Relationships: [];
      };
      fix_request_recipients: {
        Row: FixRequestRecipientRow;
        Insert: FixRequestRecipientInsert;
        Update: FixRequestRecipientUpdate;
        Relationships: [];
      };
      fix_request_deliveries: {
        Row: FixRequestDeliveryRow;
        Insert: FixRequestDeliveryInsert;
        Update: FixRequestDeliveryUpdate;
        Relationships: [];
      };
      fix_request_messages: {
        Row: FixRequestMessageRow;
        Insert: FixRequestMessageInsert;
        Update: FixRequestMessageUpdate;
        Relationships: [];
      };
      fix_request_activities: {
        Row: FixRequestActivityRow;
        Insert: FixRequestActivityInsert;
        Update: FixRequestActivityUpdate;
        Relationships: [];
      };
      fix_request_public_links: {
        Row: FixRequestPublicLinkRow;
        Insert: FixRequestPublicLinkInsert;
        Update: FixRequestPublicLinkUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      use_credit: { Args: { p_user_id: string }; Returns: boolean };
      refund_credit: { Args: { p_user_id: string }; Returns: undefined };
      email_exists: { Args: { p_email: string }; Returns: boolean };
      claim_monitor_run: {
        Args: { p_monitor_id: string; p_run_id: string; lease_minutes?: number };
        Returns: string | null;
      };
      release_monitor_lease: {
        Args: { p_monitor_id: string; p_run_id: string };
        Returns: boolean;
      };
      cleanup_expired_monitor_leases: {
        Args: Record<never, never>;
        Returns: number;
      };
      resolve_site_key: {
        Args: { p_key_hash: string };
        Returns: Array<{
          connected_site_id: string;
          user_id: string;
          normalized_origin: string;
          is_enabled: boolean;
          telemetry_enabled: boolean;
          indexing_diagnostics_enabled: boolean;
        }>;
      };
      upsert_monitor_incident: {
        Args: {
          p_monitor_id: string;
          p_fingerprint: string;
          p_title: string;
          p_severity: string;
          p_run_id: string;
          p_affected_pages?: unknown;
          p_event_entry?: unknown;
        };
        Returns: string;
      };
      fix_request_link_record_view: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
