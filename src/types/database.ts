// Manually maintained until `npm run db:types` can generate from live Supabase project.
// JSONB columns use `unknown` to avoid recursive type issues with the Supabase client generic.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AnalysisStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';
type Plan = 'free' | 'pro' | 'agency';
type SubStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

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
  created_at?: string;
  updated_at?: string;
};

type UserSettingsUpdate = {
  credits?: number;
  credits_used?: number;
  notifications?: unknown;
  preferences?: unknown;
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
    };
    Views: { [_ in never]: never };
    Functions: {
      use_credit: { Args: { p_user_id: string }; Returns: boolean };
      refund_credit: { Args: { p_user_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
