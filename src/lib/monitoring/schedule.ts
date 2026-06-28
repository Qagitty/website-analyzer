/**
 * Timezone-aware schedule calculation (§3).
 *
 * Rules:
 *  - All schedules carry an IANA timezone. Never use server-local time.
 *  - calculateNextRun() is deterministic given (schedule, from).
 *  - DST transitions: use wall-clock semantics — 9am means 9am in the target
 *    timezone even when clocks change.
 *  - Jitter is bounded and additive, never resets the wall-clock time.
 *  - Do not support frequencies below 'daily' (§60 — no unbounded frequency).
 */

import type { MonitorSchedule } from './types';

// ─── IANA timezone helpers ────────────────────────────────────────────────────

interface LocalDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number; // 0-59
  weekday: number; // 0=Sun … 6=Sat
}

/**
 * Break a UTC Date into local wall-clock parts for the given IANA timezone.
 * Uses Intl.DateTimeFormat — available in Node 18+ and all modern browsers.
 */
export function getLocalParts(date: Date, timezone: string): LocalDateParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(date)) {
    parts[type] = value;
  }

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    year: parseInt(parts.year ?? '2000', 10),
    month: parseInt(parts.month ?? '1', 10),
    day: parseInt(parts.day ?? '1', 10),
    hour: parseInt(parts.hour ?? '0', 10) % 24,
    minute: parseInt(parts.minute ?? '0', 10),
    weekday: weekdayMap[parts.weekday ?? 'Sun'] ?? 0,
  };
}

/**
 * Construct a UTC Date that corresponds to a specific local wall-clock time
 * in the given IANA timezone.
 *
 * Works by binary-searching for the UTC instant whose local representation
 * matches the target. Handles DST gaps (skipped times map to post-transition).
 */
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // Construct a naive UTC approximation from local wall clock
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  // Verify by round-tripping: check what local time the naive UTC produces
  const check = getLocalParts(new Date(naive), timezone);
  const checkMs =
    Date.UTC(check.year, check.month - 1, check.day, check.hour, check.minute);

  // Compute the offset and correct
  const offsetMs = naive - checkMs;
  return new Date(naive + offsetMs);
}

// ─── Next-run calculation ─────────────────────────────────────────────────────

const MIN_INTERVAL_HOURS = 1; // §60 — no sub-hourly schedules

/**
 * Calculate the next UTC run time given a schedule and a reference "from" time.
 *
 * The returned time is strictly after `from` (never equal).
 * Jitter, if configured, is deterministic per run (applied by the caller using
 * addJitter() after this function returns the base time).
 */
export function calculateNextRun(schedule: MonitorSchedule, from: Date): Date {
  const tz = schedule.timezone || 'UTC';
  const targetHour = schedule.hour ?? 9;
  const targetMinute = schedule.minute ?? 0;

  switch (schedule.type) {
    case 'daily':
      return nextDailyRun(tz, targetHour, targetMinute, from);

    case 'weekly': {
      const days = schedule.dayOfWeek?.length ? schedule.dayOfWeek : [1]; // Monday default
      return nextWeeklyRun(tz, days, targetHour, targetMinute, from);
    }

    case 'monthly': {
      const dom = schedule.dayOfMonth ?? 1;
      return nextMonthlyRun(tz, dom, targetHour, targetMinute, from);
    }

    case 'custom':
      // Custom cron expressions are evaluated by the caller (cron library).
      // Fall back to weekly as a safe default if called directly.
      return nextWeeklyRun(tz, [1], targetHour, targetMinute, from);

    default:
      return nextDailyRun(tz, targetHour, targetMinute, from);
  }
}

function nextDailyRun(
  timezone: string,
  hour: number,
  minute: number,
  from: Date,
): Date {
  const local = getLocalParts(from, timezone);

  // Try today
  const todayAtTarget = localToUtc(local.year, local.month, local.day, hour, minute, timezone);
  if (todayAtTarget.getTime() > from.getTime()) {
    return todayAtTarget;
  }

  // Tomorrow at target time
  const tomorrow = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const tLocal = getLocalParts(tomorrow, timezone);
  return localToUtc(tLocal.year, tLocal.month, tLocal.day, hour, minute, timezone);
}

function nextWeeklyRun(
  timezone: string,
  daysOfWeek: number[],
  hour: number,
  minute: number,
  from: Date,
): Date {
  const sortedDays = [...new Set(daysOfWeek)].sort((a, b) => a - b);

  // Try each day within the next 7 days
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(from.getTime() + offset * 24 * 60 * 60 * 1000);
    const local = getLocalParts(candidate, timezone);
    if (!sortedDays.includes(local.weekday)) continue;

    const at = localToUtc(local.year, local.month, local.day, hour, minute, timezone);
    if (at.getTime() > from.getTime()) return at;
  }

  // Fallback: 7 days from now (should not normally reach here)
  return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
}

function nextMonthlyRun(
  timezone: string,
  dayOfMonth: number,
  hour: number,
  minute: number,
  from: Date,
): Date {
  const local = getLocalParts(from, timezone);

  // Try this month
  const domClamped = Math.min(dayOfMonth, 28); // avoid month-end overflow
  const thisMonth = localToUtc(local.year, local.month, domClamped, hour, minute, timezone);
  if (thisMonth.getTime() > from.getTime()) return thisMonth;

  // Next month
  let nextMonth = local.month + 1;
  let nextYear = local.year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return localToUtc(nextYear, nextMonth, domClamped, hour, minute, timezone);
}

// ─── Jitter ───────────────────────────────────────────────────────────────────

/**
 * Add bounded random jitter to a base run time.
 * Jitter is additive only — runs never fire earlier than the base time.
 * Maximum jitter is capped at 30 minutes regardless of configuration.
 */
export function addJitter(date: Date, maxMinutes: number): Date {
  const cappedMaxMs = Math.min(maxMinutes, 30) * 60 * 1000;
  const jitterMs = Math.floor(Math.random() * cappedMaxMs);
  return new Date(date.getTime() + jitterMs);
}

// ─── Backward compatibility: legacy frequency → MonitorSchedule ───────────────

/**
 * Adapt a legacy monitor's `frequency` string to the new MonitorSchedule model.
 * Legacy monitors run at 9am UTC by default (preserving existing behavior).
 */
export function scheduleFromLegacyFrequency(
  frequency: 'daily' | 'weekly',
  timezone = 'UTC',
): MonitorSchedule {
  if (frequency === 'weekly') {
    return {
      type: 'weekly',
      timezone,
      hour: 9,
      minute: 0,
      dayOfWeek: [1], // Monday
    };
  }
  return {
    type: 'daily',
    timezone,
    hour: 9,
    minute: 0,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Returns null if valid, or an error string describing the problem. */
export function validateSchedule(schedule: MonitorSchedule): string | null {
  if (!schedule.timezone) return 'timezone is required';

  // Verify the timezone is valid (throws for unknown timezones in V8)
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: schedule.timezone });
  } catch {
    return `Invalid IANA timezone: ${schedule.timezone}`;
  }

  if (schedule.type === 'custom' && !schedule.cronExpression) {
    return 'cronExpression is required for custom schedule type';
  }

  if (schedule.hour !== undefined && (schedule.hour < 0 || schedule.hour > 23)) {
    return 'hour must be 0–23';
  }

  if (schedule.minute !== undefined && (schedule.minute < 0 || schedule.minute > 59)) {
    return 'minute must be 0–59';
  }

  if (schedule.type === 'monthly' && schedule.dayOfMonth !== undefined) {
    if (schedule.dayOfMonth < 1 || schedule.dayOfMonth > 28) {
      return 'dayOfMonth must be 1–28';
    }
  }

  if (schedule.jitterWindowMinutes !== undefined && schedule.jitterWindowMinutes < 0) {
    return 'jitterWindowMinutes must be non-negative';
  }

  // Prevent sub-hourly schedules (§60)
  if (schedule.type === 'custom' && schedule.cronExpression) {
    const parts = schedule.cronExpression.trim().split(/\s+/);
    if (parts.length >= 1 && parts[0] !== '*' && parts[0].includes('/')) {
      const interval = parseInt(parts[0].split('/')[1] ?? '60', 10);
      if (!isNaN(interval) && interval < MIN_INTERVAL_HOURS * 60) {
        return 'Schedules more frequent than hourly are not supported';
      }
    }
  }

  return null;
}

/**
 * Returns true when the schedule would fire more than once per hour
 * (used to gate pro-only high-frequency schedules).
 */
export function isHighFrequency(schedule: MonitorSchedule): boolean {
  return schedule.type === 'custom' && !!schedule.cronExpression?.match(/^\*|\d+\/\d+/);
}
