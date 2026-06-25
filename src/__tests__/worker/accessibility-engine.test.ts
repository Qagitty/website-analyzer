import { describe, it, expect } from 'vitest';
import { checkAccessibility, MANUAL_REVIEW_CHECKLIST } from '../../../src/workers/analyzer/accessibility';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const GOOD_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Good page</title>
</head>
<body>
  <a href="#main" class="sr-only focus:not-sr-only">Skip to main content</a>
  <nav><a href="/about">About</a></nav>
  <main id="main">
    <h1>Page Title</h1>
    <img src="photo.jpg" alt="Team photo">
    <form>
      <label for="name">Name</label>
      <input id="name" type="text">
      <button type="submit">Submit</button>
    </form>
  </main>
</body>
</html>`;

const BAD_PAGE = `
<html>
<head>
  <meta name="viewport" content="user-scalable=no">
  <style>a:focus { outline: none; }</style>
</head>
<body>
  <h1>First heading</h1>
  <h1>Duplicate h1</h1>
  <h3>Skipped level</h3>
  <img src="photo.jpg">
  <img src="decorative.png" alt="">
  <button></button>
  <a href="/go">click here</a>
  <a href="/empty"><img src="icon.png" alt=""></a>
  <a href="/new" target="_blank">External link</a>
  <input type="text">
  <select><option>Choose</option></select>
  <div onclick="doThing()">Click me</div>
  <span onclick="doOther()">Also click</span>
  <iframe src="https://example.com/embed"></iframe>
  <video><source src="video.mp4"></video>
  <audio><source src="audio.mp3"></audio>
  <video autoplay src="video.mp4"></video>
  <th>Column</th>
  <span aria-label="" tabindex="1">thing</span>
  <button aria-hidden="true">Hidden</button>
</body>
</html>`;

// ─── Return type shape ────────────────────────────────────────────────────────

describe('checkAccessibility return type', () => {
  it('returns AccessibilityAuditResult with required fields', () => {
    const result = checkAccessibility(GOOD_PAGE);
    expect(result.version).toBe('accessibility-v2');
    expect(result.mode).toBe('static-html-only');
    expect(typeof result.disclaimer).toBe('string');
    expect(result.disclaimer.length).toBeGreaterThan(10);
    expect(Array.isArray(result.findings)).toBe(true);
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.scoreBreakdown).toBeDefined();
    expect(Array.isArray(result.manualReviewItems)).toBe(true);
    expect(result.totalElements).toBeDefined();
  });

  it('each finding has required v2 fields', () => {
    const result = checkAccessibility(BAD_PAGE);
    for (const f of result.findings) {
      expect(typeof f.id).toBe('string');
      expect(typeof f.what).toBe('string');
      expect(typeof f.why).toBe('string');
      expect(typeof f.howToFix).toBe('string');
      expect(typeof f.howToVerify).toBe('string');
      expect(['confirmed','likely','manual-review','passed','not-applicable']).toContain(f.status);
      expect(['critical','serious','moderate','minor','manual-review']).toContain(f.severity);
      expect(Array.isArray(f.where)).toBe(true);
      // Legacy aliases
      expect(f.description).toBeDefined();
      expect(Array.isArray(f.nodes)).toBe(true);
      expect(Array.isArray(f.wcagCriteria)).toBe(true);
    }
  });
});

// ─── Missing alt detection ────────────────────────────────────────────────────

describe('image-alt rule', () => {
  it('confirms images missing alt attribute', () => {
    const result = checkAccessibility('<html lang="en"><body><h1>T</h1><main><img src="x.jpg"></main></body></html>');
    const f = result.findings.find(f => f.id === 'image-alt');
    expect(f).toBeDefined();
    expect(f!.status).toBe('confirmed');
    expect(f!.severity).toBe('critical');
  });

  it('does not flag images with alt=""', () => {
    const result = checkAccessibility('<html lang="en"><body><h1>T</h1><main><img src="x.jpg" alt=""></main></body></html>');
    const f = result.findings.find(f => f.id === 'image-alt');
    expect(f).toBeUndefined();
  });

  it('does not flag images with aria-label', () => {
    const result = checkAccessibility('<html lang="en"><body><h1>T</h1><main><img src="x.jpg" aria-label="Photo"></main></body></html>');
    const f = result.findings.find(f => f.id === 'image-alt');
    expect(f).toBeUndefined();
  });

  it('flags empty alt as manual-review', () => {
    const result = checkAccessibility('<html lang="en"><body><h1>T</h1><main><img src="x.jpg" alt=""></main></body></html>');
    const f = result.findings.find(f => f.id === 'image-alt-empty');
    expect(f).toBeDefined();
    expect(f!.status).toBe('manual-review');
  });

  it('does not flag hidden images', () => {
    const result = checkAccessibility('<html lang="en"><body><h1>T</h1><main><img src="x.jpg" hidden></main></body></html>');
    const f = result.findings.find(f => f.id === 'image-alt');
    expect(f).toBeUndefined();
  });

  it('does not flag display:none images', () => {
    const result = checkAccessibility('<html lang="en"><body><h1>T</h1><main><img src="x.jpg" style="display:none"></main></body></html>');
    const f = result.findings.find(f => f.id === 'image-alt');
    expect(f).toBeUndefined();
  });
});

// ─── HTML lang ────────────────────────────────────────────────────────────────

describe('html-has-lang rule', () => {
  it('confirms missing lang', () => {
    const result = checkAccessibility('<html><body><h1>T</h1></body></html>');
    const f = result.findings.find(f => f.id === 'html-has-lang');
    expect(f).toBeDefined();
    expect(f!.status).toBe('confirmed');
  });

  it('passes when lang is present', () => {
    const result = checkAccessibility('<html lang="en"><body><h1>T</h1></body></html>');
    const f = result.findings.find(f => f.id === 'html-has-lang');
    expect(f).toBeUndefined();
  });
});

// ─── Focus indicator ──────────────────────────────────────────────────────────

describe('focus-outline-removed rule', () => {
  it('is confirmed when outline:none is inside :focus selector without compensation', () => {
    const html = '<html lang="en"><style>a:focus { outline: none; }</style><body><h1>T</h1></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'focus-outline-removed');
    expect(f).toBeDefined();
    expect(f!.status).toBe('confirmed');
  });

  it('is manual-review when outline:none is inside :focus but box-shadow compensates', () => {
    const html = '<html lang="en"><style>a:focus { outline: none; box-shadow: 0 0 0 2px #4f46e5; }</style><body><h1>T</h1></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'focus-outline-removed');
    expect(f).toBeDefined();
    expect(f!.status).toBe('manual-review');
  });

  it('is likely when outline:none appears outside :focus context', () => {
    const html = '<html lang="en"><style>* { outline: none; }</style><body><h1>T</h1></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'focus-outline-removed');
    expect(f).toBeDefined();
    expect(f!.status).toBe('likely');
  });

  it('is not flagged when no outline removal found', () => {
    const result = checkAccessibility(GOOD_PAGE);
    const f = result.findings.find(f => f.id === 'focus-outline-removed');
    expect(f).toBeUndefined();
  });
});

// ─── SVG accessibility ────────────────────────────────────────────────────────

describe('SVG classification', () => {
  it('flags unlabelled large SVG as likely svg-img-alt', () => {
    const html = '<html lang="en"><body><h1>T</h1><main><svg width="200" height="200"><rect/></svg></main></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'svg-img-alt');
    expect(f).toBeDefined();
    expect(f!.status).toBe('likely');
  });

  it('flags small icon SVG without aria-hidden as likely svg-decorative-aria-hidden', () => {
    const html = '<html lang="en"><body><h1>T</h1><main><svg width="24" height="24"><path/></svg></main></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'svg-decorative-aria-hidden');
    expect(f).toBeDefined();
    expect(f!.status).toBe('likely');
  });

  it('does not flag SVG with aria-hidden="true"', () => {
    const html = '<html lang="en"><body><h1>T</h1><main><svg aria-hidden="true" width="24" height="24"><path/></svg></main></body></html>';
    const result = checkAccessibility(html);
    const svgFindings = result.findings.filter(f => f.id.startsWith('svg-'));
    expect(svgFindings.length).toBe(0);
  });

  it('does not flag SVG with role="img" and aria-label', () => {
    const html = '<html lang="en"><body><h1>T</h1><main><svg role="img" aria-label="Company logo" width="200" height="100"><text/></svg></main></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'svg-img-alt');
    expect(f).toBeUndefined();
  });

  it('does not flag SVG with <title> element and role="img"', () => {
    const html = '<html lang="en"><body><h1>T</h1><main><svg role="img" width="200" height="100"><title>Company logo</title></svg></main></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'svg-img-alt');
    expect(f).toBeUndefined();
  });
});

// ─── Analytics iframe filtering ───────────────────────────────────────────────

describe('iframe analytics filtering', () => {
  it('does not flag GTM iframes', () => {
    const html = '<html lang="en"><body><h1>T</h1><iframe src="https://www.googletagmanager.com/gtm.js"></iframe></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'frame-title');
    expect(f).toBeUndefined();
  });

  it('does not flag Facebook pixel iframes', () => {
    const html = '<html lang="en"><body><h1>T</h1><iframe src="https://www.facebook.com/plugins/like.php"></iframe></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'frame-title');
    expect(f).toBeUndefined();
  });

  it('does not flag hotjar iframes', () => {
    const html = '<html lang="en"><body><h1>T</h1><iframe src="https://vars.hotjar.com/box-123"></iframe></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'frame-title');
    expect(f).toBeUndefined();
  });

  it('flags visible iframe without title and not analytics', () => {
    const html = '<html lang="en"><body><h1>T</h1><iframe src="https://example.com/embed"></iframe></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'frame-title');
    expect(f).toBeDefined();
    expect(f!.status).toBe('confirmed');
  });

  it('does not flag iframes with a title attribute', () => {
    const html = '<html lang="en"><body><h1>T</h1><iframe src="https://example.com/embed" title="Map"></iframe></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'frame-title');
    expect(f).toBeUndefined();
  });
});

// ─── Colour contrast ──────────────────────────────────────────────────────────

describe('color-contrast rule', () => {
  it('confirms low contrast when real hex pair is present in inline style', () => {
    const html = `<html lang="en"><body><h1>T</h1><p style="color:#cccccc;background-color:#ffffff">Low contrast</p></body></html>`;
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'color-contrast');
    expect(f).toBeDefined();
    expect(f!.status).toBe('confirmed');
    expect(f!.contrastEvidence).toBeDefined();
    expect(f!.contrastEvidence!.ratio).toBeLessThan(4.5);
  });

  it('does not flag high-contrast inline styles', () => {
    const html = `<html lang="en"><body><h1>T</h1><p style="color:#000000;background-color:#ffffff">High contrast</p></body></html>`;
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'color-contrast');
    expect(f).toBeUndefined();
  });

  it('flags light CSS colours as manual-review when no hex pair', () => {
    const html = `<html lang="en"><body><h1>T</h1><style>p { color: #ccc; } span { color: #ddd; } div { color: #eee; }</style></body></html>`;
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'color-contrast');
    if (f) expect(f.status).toBe('manual-review');
  });
});

// ─── Scoring ──────────────────────────────────────────────────────────────────

describe('accessibility score', () => {
  it('perfect page scores near 100', () => {
    const result = checkAccessibility(GOOD_PAGE);
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it('bad page scores lower than good page', () => {
    const goodScore = checkAccessibility(GOOD_PAGE).score;
    const badScore  = checkAccessibility(BAD_PAGE).score;
    expect(badScore).toBeLessThan(goodScore);
  });

  it('score is always between 0 and 100', () => {
    const result = checkAccessibility(BAD_PAGE);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('confirmed critical findings reduce score more than likely ones', () => {
    const confirmedHtml = '<html lang="en"><body><h1>T</h1><img src="x.jpg"><img src="y.jpg"><img src="z.jpg"></body></html>';
    const likelyHtml    = '<html lang="en"><body><h1>T</h1><input type="text" placeholder="Name"></body></html>';
    const confirmedResult = checkAccessibility(confirmedHtml);
    const likelyResult    = checkAccessibility(likelyHtml);
    expect(confirmedResult.score).toBeLessThanOrEqual(likelyResult.score);
  });

  it('manual-review findings do not count towards penalty', () => {
    // Empty alt = manual-review, should not lower score
    const withEmptyAlt = '<html lang="en"><body><nav><a href="/x">Nav</a></nav><main><h1>T</h1><img src="x.jpg" alt=""><a href="#main">Skip</a></main></body></html>';
    const without      = '<html lang="en"><body><nav><a href="/x">Nav</a></nav><main><h1>T</h1><a href="#main">Skip</a></main></body></html>';
    const r1 = checkAccessibility(withEmptyAlt);
    const r2 = checkAccessibility(without);
    // Both scores should be close — manual-review items have 0 weight
    expect(Math.abs(r1.score - r2.score)).toBeLessThanOrEqual(5);
  });
});

// ─── HTML truncation ──────────────────────────────────────────────────────────

describe('HTML truncation', () => {
  it('truncates HTML at 600KB and sets error.partial = true', () => {
    const bigHtml = '<html lang="en"><body>' + '<p>a</p>'.repeat(200_000) + '</body></html>';
    const result = checkAccessibility(bigHtml);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe('HTML_TOO_LARGE');
    expect(result.error!.partial).toBe(true);
  });

  it('does not set error for small HTML', () => {
    const result = checkAccessibility(GOOD_PAGE);
    expect(result.error).toBeUndefined();
  });

  it('truncation disclaimer is appended to main disclaimer', () => {
    const bigHtml = '<html lang="en"><body>' + '<p>a</p>'.repeat(200_000) + '</body></html>';
    const result = checkAccessibility(bigHtml);
    expect(result.disclaimer).toContain('truncated');
  });
});

// ─── Snippet sanitization ─────────────────────────────────────────────────────

describe('snippet sanitization', () => {
  it('redacts token values from evidence snippets', () => {
    const html = '<html lang="en"><body><h1>T</h1><input type="text" data-token="secret123abc456def">value</body></html>';
    const result = checkAccessibility(html);
    const allSnippets = result.findings.flatMap(f => f.nodes);
    for (const snip of allSnippets) {
      expect(snip).not.toMatch(/secret123abc456def/);
    }
  });

  it('snippets are at most MAX_SNIPPET_LEN characters', () => {
    const html = '<html lang="en"><body><h1>T</h1>' +
      `<img src="${'x'.repeat(300)}.jpg">` +
      '</body></html>';
    const result = checkAccessibility(html);
    const allSnippets = result.findings.flatMap(f => f.where.map(w => w.html));
    for (const snip of allSnippets) {
      expect(snip.length).toBeLessThanOrEqual(200);
    }
  });
});

// ─── Link checks ─────────────────────────────────────────────────────────────

describe('link rules', () => {
  it('confirms generic link text', () => {
    const html = '<html lang="en"><body><h1>T</h1><a href="/x">click here</a></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'link-name-generic');
    expect(f).toBeDefined();
    expect(f!.status).toBe('confirmed');
  });

  it('confirms empty links', () => {
    const html = '<html lang="en"><body><h1>T</h1><a href="/x"></a></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'link-name-empty');
    expect(f).toBeDefined();
    expect(f!.status).toBe('confirmed');
  });

  it('flags new-tab links as likely (not confirmed)', () => {
    const html = '<html lang="en"><body><h1>T</h1><a href="/x" target="_blank">External</a></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'link-new-tab-no-warning');
    expect(f).toBeDefined();
    expect(f!.status).toBe('likely');
    expect(f!.severity).toBe('minor');
  });

  it('does not flag new-tab links that warn users', () => {
    const html = '<html lang="en"><body><h1>T</h1><a href="/x" target="_blank" aria-label="Privacy policy (opens in new tab)">Policy</a></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'link-new-tab-no-warning');
    expect(f).toBeUndefined();
  });
});

// ─── Autoplay ─────────────────────────────────────────────────────────────────

describe('no-autoplay-audio rule', () => {
  it('flags autoplay video without muted', () => {
    const html = '<html lang="en"><body><h1>T</h1><video autoplay src="v.mp4"></video></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'no-autoplay-audio');
    expect(f).toBeDefined();
    expect(f!.status).toBe('confirmed');
  });

  it('does not flag autoplay video with muted', () => {
    const html = '<html lang="en"><body><h1>T</h1><video autoplay muted src="v.mp4"></video></body></html>';
    const result = checkAccessibility(html);
    const f = result.findings.find(f => f.id === 'no-autoplay-audio');
    expect(f).toBeUndefined();
  });
});

// ─── Manual review checklist export ─────────────────────────────────────────

describe('MANUAL_REVIEW_CHECKLIST', () => {
  it('has 20 items', () => {
    expect(MANUAL_REVIEW_CHECKLIST.length).toBe(20);
  });

  it('all items are non-empty strings', () => {
    for (const item of MANUAL_REVIEW_CHECKLIST) {
      expect(typeof item).toBe('string');
      expect(item.length).toBeGreaterThan(5);
    }
  });
});

// ─── totalElements inventory ─────────────────────────────────────────────────

describe('totalElements inventory', () => {
  it('counts images, inputs, buttons correctly', () => {
    const html = `
<html lang="en"><body>
  <img src="a.jpg" alt="A"><img src="b.jpg" alt="B">
  <input type="text" id="f"><label for="f">F</label>
  <button>Go</button>
  <h1>T</h1>
</body></html>`;
    const result = checkAccessibility(html);
    expect(result.totalElements.images).toBe(2);
    expect(result.totalElements.inputs).toBe(1);
    expect(result.totalElements.buttons).toBe(1);
  });
});
