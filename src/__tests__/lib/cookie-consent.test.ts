import { describe, it, expect, beforeEach } from 'vitest';

// ── Cookie consent — pure logic tests ────────────────────────────────────────
// Tests cover: consent reading/writing, analytics gating, and banner visibility.
// No DOM required — all logic is extracted into pure functions.

type ConsentValue = 'accepted' | 'rejected' | null;

const CONSENT_KEY = 'cookie_consent';

function getConsent(store: Record<string, string>): ConsentValue {
  const value = store[CONSENT_KEY];
  if (value === 'accepted') return 'accepted';
  if (value === 'rejected') return 'rejected';
  return null;
}

function setConsent(store: Record<string, string>, value: 'accepted' | 'rejected'): void {
  store[CONSENT_KEY] = value;
}

function shouldShowBanner(store: Record<string, string>): boolean {
  return getConsent(store) === null;
}

function shouldFireAnalytics(store: Record<string, string>): boolean {
  return getConsent(store) === 'accepted';
}

describe('getConsent()', () => {
  it('returns null when no consent stored', () => {
    expect(getConsent({})).toBeNull();
  });

  it('returns "accepted" when consent is accepted', () => {
    expect(getConsent({ [CONSENT_KEY]: 'accepted' })).toBe('accepted');
  });

  it('returns "rejected" when consent is rejected', () => {
    expect(getConsent({ [CONSENT_KEY]: 'rejected' })).toBe('rejected');
  });

  it('returns null for unknown stored value', () => {
    expect(getConsent({ [CONSENT_KEY]: 'partial' })).toBeNull();
  });
});

describe('setConsent()', () => {
  it('stores "accepted" in the store', () => {
    const store: Record<string, string> = {};
    setConsent(store, 'accepted');
    expect(store[CONSENT_KEY]).toBe('accepted');
  });

  it('stores "rejected" in the store', () => {
    const store: Record<string, string> = {};
    setConsent(store, 'rejected');
    expect(store[CONSENT_KEY]).toBe('rejected');
  });

  it('overwrites a previous consent value', () => {
    const store: Record<string, string> = { [CONSENT_KEY]: 'accepted' };
    setConsent(store, 'rejected');
    expect(store[CONSENT_KEY]).toBe('rejected');
  });
});

describe('shouldShowBanner()', () => {
  it('shows banner when no consent stored', () => {
    expect(shouldShowBanner({})).toBe(true);
  });

  it('hides banner when consent is accepted', () => {
    expect(shouldShowBanner({ [CONSENT_KEY]: 'accepted' })).toBe(false);
  });

  it('hides banner when consent is rejected', () => {
    expect(shouldShowBanner({ [CONSENT_KEY]: 'rejected' })).toBe(false);
  });
});

describe('shouldFireAnalytics()', () => {
  it('does not fire analytics without consent', () => {
    expect(shouldFireAnalytics({})).toBe(false);
  });

  it('fires analytics when consent is accepted', () => {
    expect(shouldFireAnalytics({ [CONSENT_KEY]: 'accepted' })).toBe(true);
  });

  it('does not fire analytics when consent is rejected', () => {
    expect(shouldFireAnalytics({ [CONSENT_KEY]: 'rejected' })).toBe(false);
  });
});

// ── Round-trip behaviour ──────────────────────────────────────────────────────

describe('Consent round-trip', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
  });

  it('accept → banner hidden → analytics fires', () => {
    expect(shouldShowBanner(store)).toBe(true);
    setConsent(store, 'accepted');
    expect(shouldShowBanner(store)).toBe(false);
    expect(shouldFireAnalytics(store)).toBe(true);
  });

  it('reject → banner hidden → analytics does not fire', () => {
    expect(shouldShowBanner(store)).toBe(true);
    setConsent(store, 'rejected');
    expect(shouldShowBanner(store)).toBe(false);
    expect(shouldFireAnalytics(store)).toBe(false);
  });

  it('changing from accepted to rejected disables analytics', () => {
    setConsent(store, 'accepted');
    expect(shouldFireAnalytics(store)).toBe(true);
    setConsent(store, 'rejected');
    expect(shouldFireAnalytics(store)).toBe(false);
  });
});
