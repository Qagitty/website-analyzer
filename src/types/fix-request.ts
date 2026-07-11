/**
 * Fix Request domain — shared type definitions.
 *
 * Terminology:
 *  Finding         — a detected technical problem (source of truth in another module)
 *  Fix Request     — a structured request to a developer/team to review or correct findings
 *  Recipient       — the person, team, or external destination receiving the request
 *  Delivery Channel — how the request reaches the recipient
 *  Conversation    — messages and updates related to a request
 *  Remediation Item — internal work-item tracking implementation (existing table)
 *  Verification    — evidence that the issue is no longer present
 */

// ── Request types ─────────────────────────────────────────────────────────────

export type FixRequestType =
  | 'audit'          // investigate and confirm root cause
  | 'fix'            // implement a specific remediation
  | 'estimate'       // provide effort/cost estimate
  | 'review'         // review a proposed fix
  | 'verification'   // confirm fix is complete
  | 'consultation';  // advice without implementation commitment

// ── Source types ──────────────────────────────────────────────────────────────

export type FixRequestSourceType =
  | 'analysis_finding'       // from analysis_issues or ai_insights
  | 'accessibility_finding'  // from accessibility_findings
  | 'error_issue'            // from runtime error monitoring
  | 'monitor_regression'     // from monitor alert / regression
  | 'security_finding'       // from security header analysis
  | 'seo_finding'            // from SEO engine output
  | 'design_mismatch'        // from design comparison
  | 'llm_readiness_finding'  // from LLM readiness check
  | 'remediation_item'       // from existing remediation_items
  | 'manual';                // created from scratch by user

// ── Lifecycle status ──────────────────────────────────────────────────────────

export type FixRequestStatus =
  | 'draft'
  | 'ready'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'delivery_failed'
  | 'acknowledged'
  | 'in_review'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'waiting_for_information'
  | 'fix_submitted'
  | 'verification_required'
  | 'verified'
  | 'closed'
  | 'cancelled';

/** Allowed status transitions. Source is the key, targets are valid next states. */
export const FIX_REQUEST_TRANSITIONS: Record<FixRequestStatus, FixRequestStatus[]> = {
  draft:                    ['ready', 'cancelled'],
  ready:                    ['sending', 'draft', 'cancelled'],
  sending:                  ['sent', 'delivery_failed'],
  sent:                     ['delivered', 'acknowledged', 'declined', 'cancelled'],
  delivered:                ['acknowledged', 'declined', 'cancelled'],
  delivery_failed:          ['ready', 'cancelled'],
  acknowledged:             ['in_review', 'accepted', 'declined', 'cancelled'],
  in_review:                ['accepted', 'declined', 'waiting_for_information', 'cancelled'],
  accepted:                 ['in_progress', 'cancelled'],
  declined:                 ['closed'],
  in_progress:              ['fix_submitted', 'waiting_for_information', 'cancelled'],
  waiting_for_information:  ['in_progress', 'cancelled'],
  fix_submitted:            ['verification_required', 'in_progress'],
  verification_required:    ['verified', 'in_progress'],
  verified:                 ['closed'],
  closed:                   [],
  cancelled:                [],
};

export function canTransition(from: FixRequestStatus, to: FixRequestStatus): boolean {
  return FIX_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Severity ──────────────────────────────────────────────────────────────────

export type FixRequestSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

// ── Delivery channels ─────────────────────────────────────────────────────────

export type FixRequestDeliveryChannel =
  | 'email'
  | 'whatsapp_link'       // click-to-chat deep link — no delivery confirmation
  | 'whatsapp_business'   // WhatsApp Business API — requires provider config
  | 'telegram_share'      // share link — no delivery confirmation
  | 'telegram_bot'        // Telegram Bot API — requires provider config
  | 'internal_assignment' // assign to an internal team member
  | 'internal_chat'       // request-scoped internal chat
  | 'webhook'             // HMAC-signed webhook payload
  | 'external_link';      // shareable external request page

/** Channels that represent confirmed delivery vs. user action only. */
export const CHANNEL_EVIDENCE_LEVEL: Record<FixRequestDeliveryChannel, DeliveryEvidenceLevel> = {
  email:               'accepted_by_provider',
  whatsapp_link:       'opened_external_app',
  whatsapp_business:   'delivered_by_provider',
  telegram_share:      'opened_external_app',
  telegram_bot:        'accepted_by_provider',
  internal_assignment: 'recipient_acknowledged',
  internal_chat:       'recipient_viewed',
  webhook:             'accepted_by_provider',
  external_link:       'recipient_viewed',
};

export type DeliveryEvidenceLevel =
  | 'prepared'
  | 'opened_external_app'
  | 'accepted_by_provider'
  | 'delivered_by_provider'
  | 'recipient_viewed'
  | 'recipient_acknowledged';

// ── Recipient types ───────────────────────────────────────────────────────────

export type FixRequestRecipientType =
  | 'internal_user'
  | 'team_member'
  | 'email'
  | 'whatsapp'
  | 'telegram'
  | 'webhook'
  | 'external_link';

export interface FixRequestRecipientSelection {
  type:          FixRequestRecipientType;
  /** For internal_user / team_member */
  userId?:       string;
  teamMemberId?: string;
  displayName?:  string;
  /** For email — plain text, validated before storage */
  email?:        string;
  /** For whatsapp — E.164 format */
  phoneE164?:    string;
  /** For telegram — username only used for display; bot needs chat_id */
  telegramUsername?: string;
  /** For webhook — existing webhook endpoint ID */
  webhookId?:    string;
}

// ── Evidence and attachments ──────────────────────────────────────────────────

export interface FixRequestEvidence {
  type:        'screenshot' | 'log' | 'report_excerpt' | 'test_result' | 'url' | 'text';
  label:       string;
  value:       string;        // URL, text content, or Storage path
  isPrivate:   boolean;       // if true: never expose in external/public views
}

export interface FixRequestAttachmentReference {
  storageKey:   string;       // randomized path in private bucket
  fileName:     string;       // safe display name
  mimeType:     string;
  fileSizeBytes: number;
  isPrivate:    boolean;
  uploadedAt:   string;
}

// ── Draft model ───────────────────────────────────────────────────────────────

export interface FixRequestDraft {
  requestType:          FixRequestType;
  title:                string;
  summary:              string;
  technicalDescription: string;
  severity:             FixRequestSeverity;
  category:             string;

  siteId?:      string;
  monitorId?:   string;
  analysisId?:  string;
  sourceType:   FixRequestSourceType;
  sourceId?:    string;

  affectedUrls:       string[];
  reproductionSteps:  string[];
  recommendedFix?:    string;
  codeExample?:       string;
  verificationSteps:  string[];

  evidence:    FixRequestEvidence[];
  attachments: FixRequestAttachmentReference[];

  requestedDueDate?:  string;
  requestedPriority?: 'urgent' | 'high' | 'normal' | 'low';

  recipientSelection: FixRequestRecipientSelection;
  deliveryChannels:   FixRequestDeliveryChannel[];

  message?: string;
}

// ── Validation bounds ─────────────────────────────────────────────────────────

export const FIX_REQUEST_BOUNDS = {
  title:             { min: 3, max: 200 },
  summary:           { max: 1000 },
  technicalDesc:     { max: 10_000 },
  codeExample:       { max: 20_000 },
  message:           { max: 5_000 },
  affectedUrls:      { max: 20 },
  evidence:          { max: 20 },
  attachments:       { max: 10 },
  reproductionSteps: { max: 20 },
  verificationSteps: { max: 20 },
  recipients:        { max: 10 },
} as const;

// ── Message visibility ────────────────────────────────────────────────────────

export type FixRequestMessageVisibility = 'internal' | 'recipient_visible';

export type FixRequestMessageFormat = 'text' | 'markdown';

// ── Verification ──────────────────────────────────────────────────────────────

export type VerificationResult =
  | 'passed'
  | 'failed'
  | 'partially_passed'
  | 'unable_to_verify';

export interface VerificationEvidence {
  method:         'automated_rescan' | 'manual_check' | 'monitor_observation' | 'header_fetch';
  verifierId:     string;
  analysisId?:    string;
  monitorRunId?:  string;
  result:         VerificationResult;
  notes?:         string;
  engineVersion?: string;
  beforeEvidenceKey?: string;  // Storage reference
  afterEvidenceKey?:  string;
  verifiedAt:     string;
}

// ── Audit response (for audit-type requests) ──────────────────────────────────

export interface AuditResponse {
  rootCause?:              string;
  affectedComponents?:     string[];
  recommendedApproach?:    string;
  estimatedComplexity?:    'small' | 'medium' | 'large' | 'unknown';
  estimatedHoursMin?:      number;
  estimatedHoursMax?:      number;
  risks?:                  string[];
  accessRequired?:         string[];
  questions?:              string[];
}

// ── Estimate ──────────────────────────────────────────────────────────────────

export interface FixRequestEstimate {
  complexity:         'small' | 'medium' | 'large' | 'unknown';
  hoursMin?:          number;
  hoursMax?:          number;
  costAmount?:        number;
  costCurrency?:      string;   // ISO 4217
  assumptions?:       string;
  exclusions?:        string;
  earliestStart?:     string;
  estimatedComplete?: string;
  expiresAt?:         string;
  submittedAt:        string;
}

// ── Plan entitlements ─────────────────────────────────────────────────────────

export interface FixRequestEntitlement {
  enabled:              boolean;
  requestsPerMonth:     number;
  internalAssignment:   boolean;
  emailDelivery:        boolean;
  externalLinks:        boolean;
  whatsappShare:        boolean;
  whatsappBusiness:     boolean;
  telegramShare:        boolean;
  telegramBot:          boolean;
  internalChat:         boolean;
  webhookDelivery:      boolean;
  teamTemplates:        boolean;
  verificationWorkflow: boolean;
  retentionDays:        number;
}

// ── Typed error codes ─────────────────────────────────────────────────────────

export type FixRequestErrorCode =
  | 'FIX_REQUEST_NOT_FOUND'
  | 'FIX_REQUEST_SOURCE_NOT_FOUND'
  | 'FIX_REQUEST_INVALID_STATUS_TRANSITION'
  | 'FIX_REQUEST_RECIPIENT_INVALID'
  | 'FIX_REQUEST_CHANNEL_UNAVAILABLE'
  | 'FIX_REQUEST_CHANNEL_NOT_CONFIGURED'
  | 'FIX_REQUEST_PLAN_REQUIRED'
  | 'FIX_REQUEST_LIMIT_REACHED'
  | 'FIX_REQUEST_DELIVERY_FAILED'
  | 'FIX_REQUEST_ALREADY_SENT'
  | 'FIX_REQUEST_PUBLIC_LINK_EXPIRED'
  | 'FIX_REQUEST_PUBLIC_LINK_REVOKED'
  | 'FIX_REQUEST_ATTACHMENT_INVALID'
  | 'FIX_REQUEST_ATTACHMENT_TOO_LARGE'
  | 'FIX_REQUEST_VERIFICATION_FAILED'
  | 'FIX_REQUEST_QUEUE_UNAVAILABLE'
  | 'FIX_REQUEST_FORBIDDEN';

export function fixRequestError(code: FixRequestErrorCode, message: string) {
  return { error: message, code };
}

// ── Activity event types ──────────────────────────────────────────────────────

export type FixRequestActivityEventType =
  | 'created'
  | 'updated'
  | 'assigned'
  | 'status_changed'
  | 'send_requested'
  | 'delivery_accepted'
  | 'delivery_failed'
  | 'viewed'
  | 'acknowledged'
  | 'accepted'
  | 'declined'
  | 'message_created'
  | 'estimate_submitted'
  | 'estimate_accepted'
  | 'estimate_declined'
  | 'fix_submitted'
  | 'verification_started'
  | 'verified'
  | 'reopened'
  | 'public_link_created'
  | 'public_link_revoked'
  | 'closed'
  | 'cancelled';

// ── Developer contact preferences ─────────────────────────────────────────────

export interface WorkingHours {
  timezone:   string;  // IANA tz name, e.g. 'Europe/Berlin'
  startHour:  number;  // 0-23
  endHour:    number;  // 0-23
  workDays:   number[]; // 0=Sun, 1=Mon … 6=Sat
}

export interface DeveloperContactPreference {
  preferredChannels:      FixRequestDeliveryChannel[];
  email?:                 string;
  whatsappNumber?:        string;  // E.164
  telegramUsername?:      string;
  internalChatEnabled?:   boolean;
  preferredLanguage?:     string;  // BCP 47
  timezone?:              string;
  workingHours?:          WorkingHours;
}
