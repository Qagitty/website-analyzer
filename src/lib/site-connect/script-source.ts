/**
 * WebScore connection script source.
 *
 * Served via /api/site-connect/v1/script (rewritten from
 * /site-connect/v1/webscore-connect.min.js via next.config.js).
 *
 * Design constraints:
 *  - Vanilla JS IIFE — no framework, no bundler dependency
 *  - Reads configuration from data-* attributes on the <script> tag
 *  - All failures are silent: no thrown errors, no console.error in prod
 *  - All collected URLs are sanitised before transmission
 *  - No PII by design (no names, emails, cookies, DOM text, auth headers)
 *  - Privacy-safe: only route patterns, not full query strings
 *  - Sends events to /api/site-connect/events via fetch
 *  - Web Vitals collected via PerformanceObserver (falls back silently)
 *  - Route changes observed via History API monkey-patch + popstate
 */

export const SCRIPT_VERSION = '1.0.0';

export function buildScript(opts: {
  ingestionEndpoint: string;
}): string {
  const { ingestionEndpoint } = opts;

  return /* javascript */`
(function () {
  'use strict';

  var VERSION = '${SCRIPT_VERSION}';
  var ENDPOINT = '${ingestionEndpoint}';
  var HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  // ── Read config from data-* attributes ─────────────────────────────────
  var scriptEl = (
    document.currentScript ||
    (function () {
      var els = document.querySelectorAll('script[data-site-key]');
      return els[els.length - 1];
    })()
  );

  if (!scriptEl) return;

  var SITE_KEY = scriptEl.getAttribute('data-site-key') || '';
  if (!SITE_KEY || !/^ws_site_[0-9a-f]{32}$/.test(SITE_KEY)) return;

  var VERIFICATION_TOKEN = scriptEl.getAttribute('data-verification') || '';
  var ENVIRONMENT = scriptEl.getAttribute('data-environment') || 'production';
  var DISABLE_VITALS = scriptEl.getAttribute('data-disable-vitals') === 'true';
  var DISABLE_ROUTES = scriptEl.getAttribute('data-disable-routes') === 'true';

  // ── URL sanitisation ────────────────────────────────────────────────────
  var SENSITIVE_PARAMS = [
    'token','api_key','apikey','key','secret','password','passwd',
    'auth','authorization','access_token','session','csrf','nonce',
    'client_secret','private_key','code','state','signature'
  ];

  function sanitizeUrl(raw) {
    if (!raw) return null;
    try {
      var u = new URL(raw);
      var params = new URLSearchParams(u.search);
      var toDelete = [];
      params.forEach(function (_, k) {
        if (SENSITIVE_PARAMS.indexOf(k.toLowerCase()) !== -1) toDelete.push(k);
      });
      toDelete.forEach(function (k) { params.delete(k); });
      u.search = params.toString();
      u.hash = '';
      return u.origin + u.pathname + (u.search ? u.search : '');
    } catch (_) { return null; }
  }

  function sanitizeRoute(pathname) {
    if (!pathname) return null;
    // Strip query string and fragment; keep path only
    return (pathname.split('?')[0].split('#')[0] || '/').substring(0, 512);
  }

  // ── Network send ────────────────────────────────────────────────────────
  function send(event) {
    var envelope = {
      schemaVersion: 1,
      siteKey: SITE_KEY,
      sentAt: new Date().toISOString(),
      sdk: { version: VERSION, platform: 'browser' },
      event: event
    };

    var body = JSON.stringify(envelope);

    if (navigator.sendBeacon && body.length < 64 * 1024) {
      // Use sendBeacon for page-unload events
      var blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } else if (typeof fetch === 'function') {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () {});
    }
  }

  // ── Heartbeat ───────────────────────────────────────────────────────────
  function sendHeartbeat(extra) {
    send(Object.assign({
      type: 'heartbeat',
      pageUrl: sanitizeUrl(location.href),
      environment: ENVIRONMENT,
      scriptLoadStatus: 'loaded',
      enabledModules: getEnabledModules(),
      configVersion: '1'
    }, extra || {}));
  }

  function getEnabledModules() {
    var mods = ['heartbeat'];
    if (!DISABLE_VITALS) mods.push('web_vitals');
    if (!DISABLE_ROUTES) mods.push('route_observer');
    if (VERIFICATION_TOKEN) mods.push('verification');
    return mods;
  }

  // ── Verification proof ──────────────────────────────────────────────────
  function sendVerificationProof() {
    if (!VERIFICATION_TOKEN) return;
    send({
      type: 'verification_proof',
      verificationToken: VERIFICATION_TOKEN,
      pageUrl: sanitizeUrl(location.href)
    });
  }

  // ── Web Vitals via PerformanceObserver ──────────────────────────────────
  var vitalsBuffer = {};

  function tryObserveVitals() {
    if (DISABLE_VITALS || typeof PerformanceObserver === 'undefined') return;

    // LCP
    safeObserve('largest-contentful-paint', function (entries) {
      var last = entries[entries.length - 1];
      if (last) vitalsBuffer.lcp = Math.round(last.startTime);
    });

    // CLS
    var clsValue = 0;
    safeObserve('layout-shift', function (entries) {
      entries.forEach(function (e) {
        if (!e.hadRecentInput) clsValue += e.value;
      });
      vitalsBuffer.cls = parseFloat(clsValue.toFixed(4));
    });

    // INP / FID
    safeObserve('event', function (entries) {
      entries.forEach(function (e) {
        var dur = e.duration;
        if (!vitalsBuffer.inp || dur > vitalsBuffer.inp) vitalsBuffer.inp = Math.round(dur);
      });
    }, { durationThreshold: 40 });

    // FCP / TTFB from Navigation Timing
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      try {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
          vitalsBuffer.ttfb = Math.round(nav.responseStart - nav.requestStart);
        }
        var paint = performance.getEntriesByName('first-contentful-paint')[0];
        if (paint) {
          vitalsBuffer.fcp = Math.round(paint.startTime);
        }
      } catch (_) {}
    }
  }

  function safeObserve(type, callback, options) {
    try {
      var obs = new PerformanceObserver(function (list) {
        try { callback(list.getEntries()); } catch (_) {}
      });
      obs.observe(Object.assign({ type: type, buffered: true }, options || {}));
    } catch (_) {}
  }

  function flushVitals() {
    if (DISABLE_VITALS) return;
    if (Object.keys(vitalsBuffer).length === 0) return;
    send({
      type: 'web_vitals',
      pageUrl: sanitizeUrl(location.href),
      route: sanitizeRoute(location.pathname),
      metrics: Object.assign({}, vitalsBuffer)
    });
    vitalsBuffer = {};
  }

  // ── Route observer ──────────────────────────────────────────────────────
  var lastRoute = sanitizeRoute(location.pathname);

  function onRouteChange() {
    if (DISABLE_ROUTES) return;
    var newRoute = sanitizeRoute(location.pathname);
    if (newRoute === lastRoute) return;
    lastRoute = newRoute;
    flushVitals(); // flush vitals for previous page before route change
    send({
      type: 'route_observed',
      route: newRoute,
      pageUrl: sanitizeUrl(location.href),
      method: 'pushState'
    });
  }

  function patchHistory() {
    var orig = history.pushState.bind(history);
    history.pushState = function () {
      orig.apply(history, arguments);
      setTimeout(onRouteChange, 0);
    };
    var origReplace = history.replaceState.bind(history);
    history.replaceState = function () {
      origReplace.apply(history, arguments);
      setTimeout(onRouteChange, 0);
    };
    window.addEventListener('popstate', function () { setTimeout(onRouteChange, 0); });
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    sendHeartbeat();
    if (VERIFICATION_TOKEN) sendVerificationProof();
    tryObserveVitals();
    if (!DISABLE_ROUTES) patchHistory();

    // Flush vitals before page unload
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushVitals();
    });
    window.addEventListener('pagehide', flushVitals, { once: true });

    // Periodic heartbeat
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`.trim();
}
