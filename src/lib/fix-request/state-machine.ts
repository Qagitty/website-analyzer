/**
 * Fix Request lifecycle state machine.
 *
 * All status transitions must pass through this module.
 * Transitions are explicit and exhaustive — unknown transitions are rejected.
 */

import {
  type FixRequestStatus,
  FIX_REQUEST_TRANSITIONS,
  canTransition,
  fixRequestError,
} from '@/types/fix-request';

export type TransitionResult =
  | { ok: true }
  | { ok: false; error: string; code: string };

/**
 * Validate a proposed status transition.
 * Returns ok:true if the transition is valid.
 */
export function validateTransition(
  from: FixRequestStatus,
  to: FixRequestStatus,
): TransitionResult {
  if (from === to) {
    return { ok: false, ...fixRequestError('FIX_REQUEST_INVALID_STATUS_TRANSITION', `Already in status '${from}'.`) };
  }
  if (!canTransition(from, to)) {
    const allowed = FIX_REQUEST_TRANSITIONS[from];
    return {
      ok: false,
      ...fixRequestError(
        'FIX_REQUEST_INVALID_STATUS_TRANSITION',
        `Cannot transition from '${from}' to '${to}'. Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none'}.`,
      ),
    };
  }
  return { ok: true };
}

/**
 * Returns the set of statuses that a request in the given status can move to.
 */
export function allowedTransitions(from: FixRequestStatus): FixRequestStatus[] {
  return FIX_REQUEST_TRANSITIONS[from] ?? [];
}

/**
 * Returns whether the given status is a terminal state
 * (no further transitions are permitted).
 */
export function isTerminalStatus(status: FixRequestStatus): boolean {
  return FIX_REQUEST_TRANSITIONS[status].length === 0;
}

/**
 * Returns whether the request is in an active/open state
 * (not yet closed, cancelled, or verified).
 */
export function isActiveStatus(status: FixRequestStatus): boolean {
  return !['closed', 'cancelled', 'verified'].includes(status);
}

/**
 * Returns whether the request has been externally delivered
 * (sent to at least one external channel).
 */
export function isDeliveredStatus(status: FixRequestStatus): boolean {
  return ['sent', 'delivered', 'acknowledged', 'in_review', 'accepted', 'in_progress',
          'waiting_for_information', 'fix_submitted', 'verification_required',
          'verified', 'closed'].includes(status);
}

/**
 * Returns whether the external recipient can still interact.
 */
export function isExternallyActionable(status: FixRequestStatus): boolean {
  return ['sent', 'delivered', 'acknowledged', 'in_review', 'accepted',
          'in_progress', 'waiting_for_information'].includes(status);
}
