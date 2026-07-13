/**
 * Unified Queue Infrastructure — Types
 *
 * A single versioned job model for all automated jobs.
 * Consumers are decoupled from producers via the shared envelope.
 *
 * Security rules (enforced by service, not by callers):
 *  - Priority is assigned server-side; never trust caller-supplied priority.
 *  - tenantId must be revalidated server-side before acting on any resource.
 *  - Payloads must not contain secrets, tokens, or credentials.
 *  - Deduplication keys are hashed before storage.
 */

// ─── Job types ─────────────────────────────────────────────────────────────

export const QueueJobTypes = [
  'analysis.run',
  'monitor.run',
  'monitor.page_check',
  'monitor.discovery',
  'alert.evaluate',
  'email.send',
  'webhook.deliver',
  'report.generate',
  'retention.cleanup',
  'site_verification.check',
  'site_connect.event_process',
  'site_connect.verify',
  'site_connect.route_candidate',
  'error_event.process',
  'error_issue.aggregate',
  'error_alert.evaluate',
  'error_retention.cleanup',
  // ── Accessibility workflow ─────────────────────────────────────────────────
  'accessibility.assessment.start',
  'accessibility.assessment.page',
  'accessibility.assessment.finalize',
  'accessibility.regression.check',
  'accessibility.alert.evaluate',
  'accessibility.statement.generate',
] as const;

export type QueueJobType = (typeof QueueJobTypes)[number];

// ─── Job status lifecycle ──────────────────────────────────────────────────
//
// Allowed transitions:
//   scheduled  → ready           (scheduler promotes due jobs)
//   ready      → leased          (consumer claims atomically)
//   leased     → running         (consumer begins processing)
//   running    → completed       (handler returned success)
//   running    → retry_wait      (handler returned retry; attempt < maxAttempts)
//   retry_wait → scheduled       (backoff period elapses)
//   running    → dead_letter     (handler returned failed or maxAttempts reached)
//   scheduled  → cancelled       (cancel() called before promotion)
//   ready      → cancelled       (cancel() called before claim)
//   leased     → ready           (lease expired — recovered by scheduler)
//   scheduled  → expired         (expiresAt < now when scheduler reads it)
//   ready      → expired         (expiresAt < now when consumer claims it)
//
// FORBIDDEN: completed → * (completed is terminal)
// FORBIDDEN: dead_letter → * (terminal; operators may create NEW retry job)

export type QueueJobStatus =
  | 'scheduled'
  | 'ready'
  | 'leased'
  | 'running'
  | 'retry_wait'
  | 'completed'
  | 'failed'
  | 'dead_letter'
  | 'cancelled'
  | 'expired';

// ─── Priority ──────────────────────────────────────────────────────────────
//
// Lower numeric value = higher priority (like a Unix nice level in reverse).
// Values are server-assigned; never trust a caller-supplied number.

export const QueuePriority = {
  CRITICAL:    10,  // fatal operational recovery
  HIGH:        20,  // user-triggered manual run
  NORMAL:      50,  // scheduled monitor, analysis dispatch
  LOW:         80,  // retries, backfills
  MAINTENANCE: 100, // cleanup, recomputation
} as const;

export type QueuePriorityValue = (typeof QueuePriority)[keyof typeof QueuePriority];

// ─── Failure classification ────────────────────────────────────────────────

export type QueueFailureType =
  | 'transient'           // timeout, 502/503/504, temp DNS, Redis hiccup
  | 'rate_limited'        // upstream 429, cooldown, internal quota
  | 'dependency_unavailable' // Redis down, Supabase down, Worker down
  | 'permanent'           // invalid URL, resource deleted, plan removed
  | 'cancelled'           // monitor disabled, user cancelled
  | 'expired';            // job TTL elapsed before execution

// ─── Job result contract ───────────────────────────────────────────────────

export type QueueJobResult =
  | { status: 'completed'; metadata?: Record<string, string | number | boolean | null> }
  | { status: 'reschedule'; scheduledFor: string; reasonCode: string }
  | { status: 'retry'; errorCode: string; failureType: QueueFailureType; retryAfterMs?: number }
  | { status: 'failed'; errorCode: string; failureType: QueueFailureType }
  | { status: 'cancelled'; reasonCode: string };

// ─── Shared job envelope ──────────────────────────────────────────────────
//
// All jobs share this wrapper regardless of type.
// Payload is generic and validated by each handler.

export interface QueueJobEnvelope<TPayload = unknown> {
  schemaVersion: 1;

  jobId:   string;
  jobType: QueueJobType;

  /** The Supabase user UUID of the owning user. Revalidated server-side. */
  tenantId: string;
  userId?:  string;
  teamId?:  string;

  /** Threads through parent → child job trees. */
  correlationId?: string;
  parentJobId?:   string;
  rootJobId?:     string;

  /**
   * Stable idempotency key. The service rejects jobs with a duplicate key
   * that is still within the deduplication window.
   */
  idempotencyKey:    string;
  deduplicationKey?: string;

  priority:    QueuePriorityValue;
  attempt:     number;
  maxAttempts: number;

  createdAt:    string; // ISO 8601
  scheduledFor: string; // ISO 8601 — when to run (now for immediate)
  expiresAt?:   string; // ISO 8601 — discard if not started by this time

  /** SHA-256 prefix of the target origin; used for per-origin throttling. */
  originHash?: string;

  /** Arbitrary grouping key for per-resource locking (e.g. "monitor:{id}"). */
  concurrencyKey?: string;

  /** Job-type weight class for throttling decisions. */
  weight?: 'light' | 'medium' | 'heavy';

  payload: TPayload;
}

// ─── Lease model ──────────────────────────────────────────────────────────

export interface JobLease {
  jobId:          string;
  workerId:       string;
  leasedAt:       string;
  leaseExpiresAt: string;
}

// ─── Enqueue inputs ────────────────────────────────────────────────────────

export interface EnqueueJobInput<TPayload = unknown> {
  jobType:          QueueJobType;
  tenantId:         string;
  userId?:          string;
  teamId?:          string;
  correlationId?:   string;
  parentJobId?:     string;
  rootJobId?:       string;
  idempotencyKey:   string;
  deduplicationKey?: string;
  priority?:        QueuePriorityValue;
  maxAttempts?:     number;
  /** When to run; omit for immediate. */
  scheduledFor?:    string;
  expiresAt?:       string;
  originHash?:      string;
  concurrencyKey?:  string;
  weight?:          'light' | 'medium' | 'heavy';
  payload:          TPayload;
}

export interface EnqueueJobResult {
  jobId:       string;
  status:      'enqueued' | 'deduplicated' | 'scheduled';
  scheduledFor: string;
  /** Present when status = 'deduplicated' */
  existingJobId?: string;
}

// ─── Claim / complete / fail inputs ───────────────────────────────────────

export interface ClaimJobsInput {
  jobTypes:    QueueJobType[];
  workerId:    string;
  maxJobs:     number;
  leaseSeconds?: number;
}

export interface ClaimedJob<TPayload = unknown> {
  envelope: QueueJobEnvelope<TPayload>;
  lease:    JobLease;
}

export interface CompleteJobInput {
  jobId:    string;
  workerId: string;
  result:   QueueJobResult;
}

export interface FailJobInput {
  jobId:        string;
  workerId:     string;
  errorCode:    string;
  errorMessage: string;
  failureType:  QueueFailureType;
  retryAfterMs?: number;
}

export type FailJobResult =
  | { outcome: 'scheduled_retry'; scheduledFor: string; attempt: number }
  | { outcome: 'dead_lettered'; reason: string };

export interface RenewLeaseInput {
  jobId:       string;
  workerId:    string;
  leaseSeconds: number;
}

export interface RenewLeaseResult {
  renewed: boolean;
  leaseExpiresAt?: string;
  reason?: string;
}

export interface CancelJobResult {
  cancelled: boolean;
  previousStatus?: QueueJobStatus;
  reason?: string;
}

// ─── Queue service interface ───────────────────────────────────────────────

export interface QueueService {
  enqueue<TPayload>(input: EnqueueJobInput<TPayload>): Promise<EnqueueJobResult>;
  cancel(jobId: string, reason?: string): Promise<CancelJobResult>;
  claim(input: ClaimJobsInput): Promise<Array<ClaimedJob>>;
  complete(input: CompleteJobInput): Promise<void>;
  fail(input: FailJobInput): Promise<FailJobResult>;
  renewLease(input: RenewLeaseInput): Promise<RenewLeaseResult>;
}

// ─── Handler context & registry ───────────────────────────────────────────

export interface QueueJobContext {
  jobId:         string;
  jobType:       QueueJobType;
  tenantId:      string;
  correlationId?: string;
  attempt:       number;
  lease:         JobLease;
  /** Call periodically in long-running jobs to extend the lease. */
  renewLease(): Promise<void>;
}

export type QueueJobHandler<TPayload = unknown> = (
  ctx: QueueJobContext,
  payload: TPayload,
) => Promise<QueueJobResult>;

// ─── Structured log events ─────────────────────────────────────────────────

export type QueueLogEvent =
  | 'job_enqueued'
  | 'job_deduplicated'
  | 'job_scheduled'
  | 'job_promoted'
  | 'job_claimed'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_retry_scheduled'
  | 'job_dead_lettered'
  | 'job_cancelled'
  | 'job_expired'
  | 'lease_renewed'
  | 'lease_expired'
  | 'origin_delayed'
  | 'origin_suspended'
  | 'queue_paused'
  | 'queue_resumed'
  | 'scheduler_run'
  | 'consumer_run';
