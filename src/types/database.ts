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
  agency_name: string | null;    // migration 007
  brand_color: string | null;    // migration 007
  show_powered_by: boolean;      // migration 007
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
};

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
    };
    Views: { [_ in never]: never };
    Functions: {
      use_credit: { Args: { p_user_id: string }; Returns: boolean };
      refund_credit: { Args: { p_user_id: string }; Returns: undefined };
      email_exists: { Args: { p_email: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
