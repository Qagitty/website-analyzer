import { describe, it, expect } from 'vitest';

// The valid transitions mirror what the API enforces
const VALID_TRANSITIONS: Record<string, string[]> = {
  open:                  ['in_progress', 'accepted_risk', 'not_applicable'],
  in_progress:           ['resolved', 'open', 'accepted_risk'],
  resolved:              ['verification_required', 'open'],
  verification_required: ['verified', 'open'],
  verified:              ['open'],
  accepted_risk:         ['open'],
  not_applicable:        ['open'],
};

function canTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

describe('accessibility finding state machine', () => {
  it('open can transition to in_progress', () => {
    expect(canTransition('open', 'in_progress')).toBe(true);
  });

  it('open can be accepted_risk', () => {
    expect(canTransition('open', 'accepted_risk')).toBe(true);
  });

  it('open can be not_applicable', () => {
    expect(canTransition('open', 'not_applicable')).toBe(true);
  });

  it('open cannot jump directly to verified', () => {
    expect(canTransition('open', 'verified')).toBe(false);
  });

  it('resolved transitions to verification_required (not directly to verified)', () => {
    expect(canTransition('resolved', 'verification_required')).toBe(true);
    expect(canTransition('resolved', 'verified')).toBe(false);
  });

  it('verification_required can become verified', () => {
    expect(canTransition('verification_required', 'verified')).toBe(true);
  });

  it('verified can be reopened', () => {
    expect(canTransition('verified', 'open')).toBe(true);
  });

  it('accepted_risk can be reopened', () => {
    expect(canTransition('accepted_risk', 'open')).toBe(true);
  });

  it('not_applicable can be reopened', () => {
    expect(canTransition('not_applicable', 'open')).toBe(true);
  });

  it('accepted_risk cannot directly become resolved', () => {
    expect(canTransition('accepted_risk', 'resolved')).toBe(false);
  });

  it('unknown status has no valid transitions', () => {
    expect(canTransition('nonexistent', 'open')).toBe(false);
  });

  it('complete happy path: open → in_progress → resolved → verification_required → verified', () => {
    const path = ['open', 'in_progress', 'resolved', 'verification_required', 'verified'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('all terminal statuses have a way back to open', () => {
    const terminals = ['accepted_risk', 'not_applicable', 'verified'];
    for (const t of terminals) {
      expect(canTransition(t, 'open')).toBe(true);
    }
  });
});
