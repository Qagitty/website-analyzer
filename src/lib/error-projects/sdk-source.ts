/* eslint-disable */
export function getSdkSource(version: string = '1.0.0'): string {
  return `/* WebScore Error Monitoring SDK v${version} */
(function(window) {
  'use strict';
  var SDK_VERSION = '${version}';
  var INGESTION_ENDPOINT = '/api/error-monitoring/envelope';
  var MAX_BREADCRUMBS = 30;
  var MAX_CONTEXT_DEPTH = 4;
  var MAX_STRING = 2048;
  var SENSITIVE_PARAMS = ['token','code','key','secret','auth','session','password','email','signature','jwt','access_token','refresh_token'];

  var config = null;
  var breadcrumbs = [];
  var userContext = null;
  var customContexts = {};
  var initialized = false;

  function sanitizeUrl(url) {
    try {
      var u = new URL(url);
      var params = new URLSearchParams();
      u.searchParams.forEach(function(v, k) {
        if (SENSITIVE_PARAMS.indexOf(k.toLowerCase()) === -1) params.set(k, v);
      });
      return (u.origin + u.pathname + (params.toString() ? '?' + params.toString() : '')).slice(0, MAX_STRING);
    } catch(e) { return String(url).slice(0, MAX_STRING); }
  }

  function truncate(s, n) { return typeof s === 'string' ? s.slice(0, n || MAX_STRING) : s; }

  function scrubCtx(v, depth) {
    depth = depth || 0;
    if (depth > MAX_CONTEXT_DEPTH) return '[truncated]';
    if (typeof v === 'string') return v.slice(0, MAX_STRING);
    if (typeof v !== 'object' || v === null) return v;
    if (Array.isArray(v)) return v.slice(0, 20).map(function(x) { return scrubCtx(x, depth+1); });
    var out = {}, count = 0;
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      if (count++ > 50) { out.__truncated = true; break; }
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (SENSITIVE_PARAMS.indexOf(k.toLowerCase()) !== -1) { out[k] = '[scrubbed]'; continue; }
      out[k] = scrubCtx(v[k], depth+1);
    }
    return out;
  }

  function genId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function addBreadcrumb(type, category, data) {
    breadcrumbs.push({ type: type, category: category, data: data, timestamp: new Date().toISOString() });
    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs = breadcrumbs.slice(-MAX_BREADCRUMBS);
  }

  function parseStack(err) {
    if (!err || !err.stack) return [];
    var frames = [];
    var lines = err.stack.split('\\n').slice(1, 51);
    lines.forEach(function(line) {
      var m = line.match(/at (.+?) \\((.+?):(\\d+):(\\d+)\\)/) ||
               line.match(/at (.+?):(\\d+):(\\d+)/) ||
               line.match(/(.+)@(.+):(\\d+):(\\d+)/);
      if (m && m.length >= 4) {
        frames.push({ function: m[1] || '?', filename: m[2] || '?', lineno: parseInt(m[3]) || 0, colno: parseInt(m[4]) || 0 });
      }
    });
    return frames.slice(0, 50);
  }

  function shouldSample() {
    return !config || config.sampleRate >= 1 || Math.random() < config.sampleRate;
  }

  var sendQueue = [];
  var sending = false;
  var retryCount = 0;
  var MAX_RETRIES = 3;

  function flushQueue() {
    if (sending || sendQueue.length === 0) return;
    sending = true;
    var envelope = sendQueue.shift();
    var body = JSON.stringify(envelope);
    var url = (config && config.ingestUrl) || INGESTION_ENDPOINT;

    function tryBeacon() {
      if (window.navigator && window.navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        var ok = window.navigator.sendBeacon(url, blob);
        if (ok) { sending = false; retryCount = 0; flushQueue(); return; }
      }
      trySend();
    }

    function trySend() {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
        .then(function(r) {
          sending = false;
          if (r.status === 429 || r.status === 503) {
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              setTimeout(flushQueue, Math.pow(2, retryCount) * 1000 + Math.random() * 500);
            }
          } else {
            retryCount = 0; flushQueue();
          }
        })
        .catch(function() {
          sending = false;
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(flushQueue, Math.pow(2, retryCount) * 1000 + Math.random() * 500);
          }
        });
    }

    tryBeacon();
  }

  function buildEnvelope(eventData) {
    var pageUrl = sanitizeUrl(window.location.href);
    return {
      schemaVersion: 1,
      eventId: genId(),
      sentAt: new Date().toISOString(),
      projectKey: config.projectKey,
      event: Object.assign({
        page: { url: pageUrl, referrer: sanitizeUrl(document.referrer) || undefined },
        runtime: {
          browser: navigator.userAgent ? navigator.userAgent.slice(0, 200) : undefined,
          deviceCategory: window.matchMedia ? (window.matchMedia('(max-width:767px)').matches ? 'mobile' : 'desktop') : 'unknown'
        },
        breadcrumbs: breadcrumbs.slice(),
        context: scrubCtx(customContexts, 0),
        environment: config.environment || 'production',
        release: config.release || undefined
      }, eventData)
    };
  }

  function captureError(message, exceptionType, stack, level, extra) {
    if (!initialized || !config) return;
    if (!shouldSample()) return;
    var envelope = buildEnvelope({
      type: extra && extra.type || 'exception',
      level: level || 'error',
      message: truncate(message, MAX_STRING),
      exception: { type: exceptionType || 'Error', value: truncate(message, MAX_STRING) },
      stack: stack ? parseStack({ stack: stack }) : [],
      customFingerprint: extra && extra.fingerprint || undefined
    });
    sendQueue.push(envelope);
    if (sendQueue.length > 20) sendQueue = sendQueue.slice(-20);
    flushQueue();
  }

  function init(cfg) {
    if (initialized) return;
    if (!cfg || !cfg.projectKey || !cfg.projectKey.startsWith('ws_err_')) {
      console.warn('[WebScoreErrors] invalid project key');
      return;
    }
    config = {
      projectKey: cfg.projectKey,
      environment: cfg.environment || 'production',
      release: cfg.release || undefined,
      sampleRate: typeof cfg.sampleRate === 'number' ? Math.min(1, Math.max(0, cfg.sampleRate)) : 1,
      ingestUrl: cfg.ingestUrl || INGESTION_ENDPOINT
    };
    MAX_BREADCRUMBS = cfg.maxBreadcrumbs || MAX_BREADCRUMBS;
    initialized = true;

    var origOnerror = window.onerror;
    window.onerror = function(msg, src, line, col, err) {
      var message = err ? (err.message || String(msg)) : String(msg);
      var stack = err ? err.stack : undefined;
      var type = err ? (err.name || 'Error') : 'Error';
      if (String(src).indexOf(config.ingestUrl) !== -1) {
        return origOnerror ? origOnerror.apply(this, arguments) : false;
      }
      addBreadcrumb('error', 'exception', { message: truncate(message, 200) });
      captureError(message, type, stack, 'error', { type: 'exception' });
      return origOnerror ? origOnerror.apply(this, arguments) : false;
    };

    window.addEventListener('unhandledrejection', function(e) {
      var reason = e.reason;
      var message, type, stack;
      if (reason instanceof Error) { message = reason.message; type = reason.name; stack = reason.stack; }
      else if (typeof reason === 'string') { message = reason; type = 'UnhandledRejection'; }
      else { message = 'Unhandled promise rejection'; type = 'UnhandledRejection'; }
      addBreadcrumb('error', 'unhandledrejection', { message: truncate(message, 200) });
      captureError(message || 'Unhandled rejection', type, stack, 'error', { type: 'unhandled_rejection' });
    });

    var origPushState = history.pushState;
    var origReplaceState = history.replaceState;
    function navCrumb(url) { addBreadcrumb('navigation', 'navigation', { to: sanitizeUrl(String(url)).slice(0, 256) }); }
    history.pushState = function() { origPushState.apply(this, arguments); navCrumb(arguments[2]); };
    history.replaceState = function() { origReplaceState.apply(this, arguments); navCrumb(arguments[2]); };
    window.addEventListener('popstate', function() { navCrumb(window.location.href); });
  }

  function autoInit() {
    var script = document.currentScript || document.querySelector('script[data-project-key^="ws_err_"]');
    if (script) {
      var key = script.getAttribute('data-project-key');
      var env = script.getAttribute('data-environment') || 'production';
      var rel = script.getAttribute('data-release') || undefined;
      if (key) init({ projectKey: key, environment: env, release: rel });
    }
  }

  var W = {
    init: init,
    captureException: function(err, ctx) {
      if (!initialized) return;
      var message = err instanceof Error ? err.message : String(err);
      var type = err instanceof Error ? err.name : 'Error';
      var stack = err instanceof Error ? err.stack : undefined;
      captureError(message, type, stack, 'error', Object.assign({ type: 'exception' }, ctx || {}));
    },
    captureMessage: function(msg, level, ctx) {
      if (!initialized) return;
      captureError(truncate(String(msg), MAX_STRING), 'Message', undefined, level || 'info', Object.assign({ type: 'message' }, ctx || {}));
    },
    setContext: function(key, data) {
      if (!initialized) return;
      customContexts[String(key).slice(0, 64)] = scrubCtx(data, 0);
    },
    setUser: function(u) {
      if (!initialized) return;
      userContext = u ? { id: u.id ? String(u.id).slice(0, 128) : undefined } : null;
    },
    addBreadcrumb: function(type, category, data) { addBreadcrumb(type, category, scrubCtx(data, 0)); },
    isInitialized: function() { return initialized; }
  };

  window.WebScoreErrors = W;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(window);`;
}
