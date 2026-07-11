/**
 * Centralized Redis key builders for the unified queue.
 *
 * Rules:
 *  - All keys are prefixed with queue:v1: for namespace versioning.
 *  - Never concatenate raw user input or URLs into keys.
 *  - Use originHash / dedupeHash (already SHA-256-truncated) not raw values.
 *  - Migrating from old monitor:jobs? See LEGACY_MONITOR_JOBS_KEY below.
 */

export const Q = {
  // ── Sorted sets ─────────────────────────────────────────────────────────
  /** Scheduled jobs waiting to be promoted (score = scheduledAt Unix ms). */
  scheduled: () => 'queue:v1:scheduled' as const,

  /** Dead-letter queue (score = failedAt Unix ms). */
  dlq: () => 'queue:v1:dlq' as const,

  // ── Lists (per-priority ready queues, FIFO) ───────────────────────────
  /** Ready-to-run queue for the given numeric priority level. */
  ready: (priority: number) => `queue:v1:ready:${priority}` as const,

  /** All priority levels we use — for consumer polling. */
  PRIORITIES: [10, 20, 50, 80, 100] as const,

  // ── Job metadata hash ─────────────────────────────────────────────────
  /** Full job envelope stored as a JSON string. */
  job: (jobId: string) => `queue:v1:job:${jobId}` as const,

  // ── Lease ──────────────────────────────────────────────────────────────
  /** TTL key that exists while the job is leased. Value = workerId. */
  lease: (jobId: string) => `queue:v1:lease:${jobId}` as const,

  // ── Status ─────────────────────────────────────────────────────────────
  /** String key storing the current QueueJobStatus. */
  status: (jobId: string) => `queue:v1:status:${jobId}` as const,

  // ── Deduplication ─────────────────────────────────────────────────────
  /**
   * TTL key for deduplication window. Value = jobId of the existing job.
   * Key uses a caller-supplied hash (never raw string values).
   */
  dedupe: (hash: string) => `queue:v1:dedupe:${hash}` as const,

  // ── Concurrency counters ──────────────────────────────────────────────
  /** Global count of currently running jobs. */
  concurrencyGlobal: () => 'queue:v1:concurrency:global' as const,

  /** Per-job-type running count. jobType is one of QueueJobTypes (safe enum). */
  concurrencyType: (jobType: string) => `queue:v1:concurrency:type:${jobType}` as const,

  /** Per-concurrency-key count (e.g. "monitor:mon-123"). */
  concurrencyKey: (key: string) => `queue:v1:concurrency:key:${key}` as const,

  // ── Per-origin throttle ───────────────────────────────────────────────
  /**
   * Unix-ms timestamp: no heavy job for this origin before this time.
   * originHash must be the 16-char hex SHA-256 prefix from getOriginKey().
   */
  originNextAt: (originHash: string) => `queue:v1:origin:${originHash}:next_at` as const,

  /** Count of active heavy jobs for this origin. */
  originActive: (originHash: string) => `queue:v1:origin:${originHash}:active` as const,

  /** Origin suspension marker (value = reason, TTL = suspension duration). */
  originSuspended: (originHash: string) => `queue:v1:origin:${originHash}:suspended` as const,

  // ── Pause controls ────────────────────────────────────────────────────
  /** Global queue pause flag. Exists = paused. */
  pauseGlobal: () => 'queue:v1:pause:global' as const,

  /** Per-job-type pause flag. */
  pauseType: (jobType: string) => `queue:v1:pause:type:${jobType}` as const,

  // ── Scheduler lock ────────────────────────────────────────────────────
  /** Short-lived mutex so only one scheduler cron runs at a time. */
  schedulerLock: () => 'queue:v1:lock:scheduler' as const,
};

/**
 * Legacy monitor dispatch key from the pre-unified queue implementation.
 * The dispatcher cron reads this until all legacy jobs are drained.
 * New jobs MUST use Q.scheduled() + Q.ready() instead.
 */
export const LEGACY_MONITOR_JOBS_KEY = 'monitor:jobs';
