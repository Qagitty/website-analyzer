export function checkAccessibility(html: string): object[] {
  const issues: object[] = [];

  // ── 1. IMAGES ──────────────────────────────────────────────────────────────
  const imgs = html.match(/<img[^>]*>/gi) || [];
  const missingAlt = imgs.filter(img => !/alt=/i.test(img));
  if (missingAlt.length > 0) {
    issues.push({
      id: 'image-alt',
      impact: 'critical',
      description: `${missingAlt.length} image(s) missing alt attribute`,
      nodes: missingAlt.slice(0, 3).map(img => img.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag111'],
    });
  }

  const emptyAlt = imgs.filter(img => /alt=["']\s*["']/i.test(img));
  if (emptyAlt.length > 0) {
    issues.push({
      id: 'image-alt-empty',
      impact: 'minor',
      description: `${emptyAlt.length} image(s) have empty alt text — verify they are purely decorative`,
      nodes: emptyAlt.slice(0, 3).map(img => img.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag111'],
    });
  }

  // ── 2. HTML LANG ───────────────────────────────────────────────────────────
  if (!/html[^>]+lang=["'][a-z]/i.test(html)) {
    issues.push({
      id: 'html-has-lang',
      impact: 'serious',
      description: 'The <html> element must have a lang attribute',
      nodes: ['<html>'],
      wcagCriteria: ['wcag2a', 'wcag311'],
    });
  }

  // ── 3. FORM LABELS & SEMANTICS ─────────────────────────────────────────────
  const inputs = html.match(/<input[^>]*>/gi) || [];

  const unlabeled = inputs.filter(input =>
    !/type=["'](hidden|submit|button|reset|image)["']/i.test(input) &&
    !/aria-label/i.test(input) && !/aria-labelledby/i.test(input) && !/id=/i.test(input)
  );
  if (unlabeled.length > 0) {
    issues.push({
      id: 'label',
      impact: 'critical',
      description: `${unlabeled.length} form input(s) may be missing associated <label> elements`,
      nodes: unlabeled.slice(0, 3).map(i => i.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131', 'wcag332'],
    });
  }

  const placeholderOnly = inputs.filter(input =>
    /placeholder=/i.test(input) &&
    !/aria-label=/i.test(input) && !/aria-labelledby=/i.test(input) &&
    !/type=["'](hidden|submit|button|reset)["']/i.test(input)
  );
  if (placeholderOnly.length > 0) {
    issues.push({
      id: 'label-placeholder',
      impact: 'moderate',
      description: `${placeholderOnly.length} input(s) use placeholder as a label substitute — placeholder text disappears on typing and has poor contrast`,
      nodes: placeholderOnly.slice(0, 3).map(i => i.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  const selects = html.match(/<select[^>]*>/gi) || [];
  const unlabeledSelects = selects.filter(s =>
    !/aria-label=/i.test(s) && !/aria-labelledby=/i.test(s) && !/id=/i.test(s)
  );
  if (unlabeledSelects.length > 0) {
    issues.push({
      id: 'select-label',
      impact: 'critical',
      description: `${unlabeledSelects.length} <select> element(s) missing accessible labels`,
      nodes: unlabeledSelects.slice(0, 3).map(s => s.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  const textareas = html.match(/<textarea[^>]*>/gi) || [];
  const unlabeledTextareas = textareas.filter(t =>
    !/aria-label=/i.test(t) && !/aria-labelledby=/i.test(t) && !/id=/i.test(t)
  );
  if (unlabeledTextareas.length > 0) {
    issues.push({
      id: 'textarea-label',
      impact: 'critical',
      description: `${unlabeledTextareas.length} <textarea> element(s) missing accessible labels`,
      nodes: unlabeledTextareas.slice(0, 3).map(t => t.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // ── 4. BUTTON NAMES ────────────────────────────────────────────────────────
  const buttonTags = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || [];
  const emptyButtons = buttonTags.filter(btn => {
    const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(btn);
    const hasAriaLabelledby = /aria-labelledby=/i.test(btn);
    const innerText = btn.replace(/<[^>]+>/g, '').trim();
    return !hasAriaLabel && !hasAriaLabelledby && innerText.length === 0;
  });
  if (emptyButtons.length > 0) {
    issues.push({
      id: 'button-name',
      impact: 'critical',
      description: `${emptyButtons.length} button(s) have no accessible name — no visible text, aria-label, or aria-labelledby`,
      nodes: emptyButtons.slice(0, 3).map(b => b.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag412'],
    });
  }

  // ── 5. LINKS ───────────────────────────────────────────────────────────────
  const anchors = html.match(/<a[^>]*>[\s\S]*?<\/a>/gi) || [];

  const genericLinks = anchors.filter(a => {
    const text = a.replace(/<[^>]+>/g, '').trim().toLowerCase();
    return /^(click here|here|read more|more|link|this|learn more|details|info|see more|continue|go|view)$/.test(text);
  });
  if (genericLinks.length > 0) {
    issues.push({
      id: 'link-name-generic',
      impact: 'serious',
      description: `${genericLinks.length} link(s) use generic non-descriptive text ("click here", "read more", etc.) — screen readers list all links out of context`,
      nodes: genericLinks.slice(0, 3).map(a => a.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag244'],
    });
  }

  const emptyLinks = anchors.filter(a => {
    const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(a);
    const innerText = a.replace(/<[^>]+>/g, '').trim();
    return !hasAriaLabel && innerText.length === 0;
  });
  if (emptyLinks.length > 0) {
    issues.push({
      id: 'link-name-empty',
      impact: 'serious',
      description: `${emptyLinks.length} link(s) have no accessible name (no text and no aria-label)`,
      nodes: emptyLinks.slice(0, 3).map(a => a.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag244'],
    });
  }

  const newTabLinks = anchors.filter(a =>
    /target=["']_blank["']/i.test(a) &&
    !/opens.{0,20}new|new.{0,10}(window|tab)/i.test(a) &&
    !/aria-label.*new/i.test(a)
  );
  if (newTabLinks.length > 0) {
    issues.push({
      id: 'link-new-tab-no-warning',
      impact: 'minor',
      description: `${newTabLinks.length} link(s) open in a new tab/window without warning users — add "(opens in new tab)" text or aria-label`,
      nodes: newTabLinks.slice(0, 3).map(a => a.slice(0, 100)),
      wcagCriteria: ['wcag2aaa', 'wcag321'],
    });
  }

  // ── 6. HEADINGS ────────────────────────────────────────────────────────────
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;

  if (h1Count === 0) {
    issues.push({
      id: 'page-has-heading-one',
      impact: 'moderate',
      description: 'Page has no <h1> heading — every page should have exactly one main heading',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  } else if (h1Count > 1) {
    issues.push({
      id: 'heading-multiple-h1',
      impact: 'moderate',
      description: `Page has ${h1Count} <h1> elements — there should be exactly one`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  const headingLevels = ([1,2,3,4,5,6] as const)
    .map(n => ((html.match(new RegExp(`<h${n}[\\s>]`, 'gi')) || []).length > 0 ? n : null))
    .filter((n): n is number => n !== null);
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      issues.push({
        id: 'heading-skipped',
        impact: 'moderate',
        description: `Heading level skipped: <h${headingLevels[i - 1]}> jumps to <h${headingLevels[i]}> — assistive technologies rely on sequential heading structure`,
        nodes: [],
        wcagCriteria: ['wcag2a', 'wcag131'],
      });
      break;
    }
  }

  // ── 7. LANDMARK REGIONS ───────────────────────────────────────────────────
  if (!/<main[\s>]/i.test(html) && !/role=["']main["']/i.test(html)) {
    issues.push({
      id: 'landmark-main-missing',
      impact: 'moderate',
      description: 'Page has no <main> landmark — screen reader users cannot jump directly to main content',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  if (!/<nav[\s>]/i.test(html) && !/role=["']navigation["']/i.test(html)) {
    issues.push({
      id: 'landmark-nav-missing',
      impact: 'minor',
      description: 'Page has no <nav> landmark — navigation is not identifiable by assistive technologies',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // ── 8. SKIP LINK ───────────────────────────────────────────────────────────
  if (!/skip.*nav|skip.*content|href=["']#main|href=["']#content/i.test(html)) {
    issues.push({
      id: 'skip-link',
      impact: 'moderate',
      description: 'No "skip to main content" link — keyboard users must tab through all navigation on every page load',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag241'],
    });
  }

  // ── 9. ARIA MISUSE ────────────────────────────────────────────────────────
  const ariaHiddenFocusable = html.match(/<(?:a|button|input|select|textarea)[^>]*aria-hidden=["']true["'][^>]*>/gi) || [];
  if (ariaHiddenFocusable.length > 0) {
    issues.push({
      id: 'aria-hidden-focus',
      impact: 'serious',
      description: `${ariaHiddenFocusable.length} interactive element(s) marked aria-hidden="true" while still focusable — screen readers will skip them but keyboard focus can still land there`,
      nodes: ariaHiddenFocusable.slice(0, 3).map(e => e.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag412'],
    });
  }

  const emptyAriaLabels = (html.match(/aria-label=["']\s*["']/gi) || []).length;
  if (emptyAriaLabels > 0) {
    issues.push({
      id: 'aria-label-empty',
      impact: 'serious',
      description: `${emptyAriaLabels} element(s) have empty aria-label="" — this overrides any other accessible name with nothing`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag412'],
    });
  }

  const positiveTabindex = (html.match(/tabindex=["'][1-9]\d*["']/gi) || []).length;
  if (positiveTabindex > 0) {
    issues.push({
      id: 'tabindex-positive',
      impact: 'serious',
      description: `${positiveTabindex} element(s) use positive tabindex values — this overrides natural tab order and creates unpredictable keyboard navigation`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag243'],
    });
  }

  // ── 10. KEYBOARD / FOCUS ──────────────────────────────────────────────────
  if (/outline\s*:\s*(?:none|0)\b/i.test(html)) {
    issues.push({
      id: 'focus-outline-removed',
      impact: 'serious',
      description: 'CSS contains `outline: none` or `outline: 0` — this removes the visible keyboard focus indicator for users who navigate without a mouse',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag241', 'wcag2411'],
    });
  }

  // ── 11. CLICKABLE NON-INTERACTIVE ELEMENTS ────────────────────────────────
  const clickableDivs = (html.match(/<div[^>]*onclick[^>]*>/gi) || [])
    .filter(d => !/role=["'](button|link|menuitem|tab|option)["']/i.test(d) && !/tabindex=/i.test(d));
  const clickableSpans = (html.match(/<span[^>]*onclick[^>]*>/gi) || [])
    .filter(s => !/role=["'](button|link|menuitem|tab|option)["']/i.test(s) && !/tabindex=/i.test(s));
  const nonInteractiveClicks = clickableDivs.length + clickableSpans.length;
  if (nonInteractiveClicks > 0) {
    issues.push({
      id: 'click-events-have-key-events',
      impact: 'serious',
      description: `${nonInteractiveClicks} div/span element(s) have onclick handlers but no role or tabindex — they are completely inaccessible to keyboard and screen reader users`,
      nodes: [...clickableDivs, ...clickableSpans].slice(0, 3).map(e => e.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag211'],
    });
  }

  // ── 12. SVG ACCESSIBILITY ─────────────────────────────────────────────────
  const svgs = html.match(/<svg[^>]*>/gi) || [];
  const svgsUnlabeled = svgs.filter(svg =>
    !/aria-label=/i.test(svg) &&
    !/aria-labelledby=/i.test(svg) &&
    !/aria-hidden=["']true["']/i.test(svg) &&
    !/role=["']img["']/i.test(svg)
  );
  if (svgsUnlabeled.length > 0) {
    issues.push({
      id: 'svg-img-alt',
      impact: 'moderate',
      description: `${svgsUnlabeled.length} SVG element(s) have no accessible label and are not hidden from screen readers — add role="img" aria-label="..." or aria-hidden="true" if decorative`,
      nodes: svgsUnlabeled.slice(0, 3).map(s => s.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag111'],
    });
  }

  // ── 13. META VIEWPORT SCALING ─────────────────────────────────────────────
  if (/user-scalable\s*=\s*no/i.test(html) || /maximum-scale\s*=\s*1[^.\d]/i.test(html)) {
    issues.push({
      id: 'meta-viewport-user-scalable',
      impact: 'critical',
      description: 'Viewport is configured to prevent user zooming (user-scalable=no or maximum-scale=1) — this blocks the ability to zoom for low-vision users',
      nodes: [(html.match(/<meta[^>]*viewport[^>]*>/i) || [''])[0].slice(0, 120)],
      wcagCriteria: ['wcag2aa', 'wcag144'],
    });
  }

  // ── 14. COLOR CONTRAST INDICATORS ────────────────────────────────────────
  const lightColorMatches = (html.match(/color\s*:\s*(#(?:[89a-fA-F][0-9a-fA-F]{5}|[cCdDeEfF][0-9a-fA-F]{2})|lightgray|lightgrey|silver|#ccc|#ddd|#eee|#aaa|#bbb)/gi) || []).length;
  if (lightColorMatches >= 3) {
    issues.push({
      id: 'color-contrast',
      impact: 'serious',
      description: `Potential low color contrast: ${lightColorMatches} instance(s) of light text color values detected in inline styles (e.g. #ccc, silver, lightgray) — verify contrast ratios meet WCAG AA (4.5:1 for normal text, 3:1 for large text)`,
      nodes: [],
      wcagCriteria: ['wcag2aa', 'wcag143'],
    });
  }

  // ── 15. VIDEO CAPTIONS ────────────────────────────────────────────────────
  const videoBlocks = html.match(/<video[\s\S]*?<\/video>/gi) || [];
  const videosWithoutTrack = videoBlocks.filter(v => !/<track/i.test(v));
  if (videosWithoutTrack.length > 0) {
    issues.push({
      id: 'video-caption',
      impact: 'critical',
      description: `${videosWithoutTrack.length} <video> element(s) have no <track kind="captions"> — deaf and hard-of-hearing users cannot access audio content`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag122'],
    });
  }

  // ── 16. TABLE HEADERS ─────────────────────────────────────────────────────
  const tableBlocks = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const tablesNoTh = tableBlocks.filter(t => !/<th[\s>]/i.test(t));
  if (tablesNoTh.length > 0) {
    issues.push({
      id: 'table-duplicate-name',
      impact: 'serious',
      description: `${tablesNoTh.length} data table(s) have no <th> header cells — screen readers cannot convey row/column context to users`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  const thTags = html.match(/<th[^>]*>/gi) || [];
  const thNoScope = thTags.filter(th => !/scope=/i.test(th));
  if (thNoScope.length > 0) {
    issues.push({
      id: 'table-th-no-scope',
      impact: 'moderate',
      description: `${thNoScope.length} <th> element(s) missing scope attribute — add scope="col" or scope="row" to clarify header direction`,
      nodes: thNoScope.slice(0, 3).map(t => t.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // ── 17. IFRAMES ───────────────────────────────────────────────────────────
  const iframes = html.match(/<iframe[^>]*>/gi) || [];
  const iframesNoTitle = iframes.filter(f => !/title=["'][^"']+["']/i.test(f) && !/aria-label=/i.test(f));
  if (iframesNoTitle.length > 0) {
    issues.push({
      id: 'frame-title',
      impact: 'serious',
      description: `${iframesNoTitle.length} <iframe> element(s) missing title attribute — screen readers cannot identify the purpose of embedded content`,
      nodes: iframesNoTitle.slice(0, 3).map(f => f.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag241'],
    });
  }

  // ── 18. AUDIO ─────────────────────────────────────────────────────────────
  const audioBlocks = html.match(/<audio[\s\S]*?<\/audio>/gi) || [];
  if (audioBlocks.length > 0) {
    issues.push({
      id: 'audio-caption',
      impact: 'serious',
      description: `${audioBlocks.length} <audio> element(s) detected — ensure a text transcript is provided nearby for deaf and hard-of-hearing users`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag121'],
    });
  }

  // ── 19. AUTOPLAY MEDIA ────────────────────────────────────────────────────
  const autoplayMedia = (html.match(/<(?:video|audio)[^>]*autoplay[^>]*>/gi) || [])
    .filter(m => !/muted/i.test(m));
  if (autoplayMedia.length > 0) {
    issues.push({
      id: 'no-autoplay-audio',
      impact: 'moderate',
      description: `${autoplayMedia.length} media element(s) autoplay with audio — this can disorient screen reader users and violates WCAG 1.4.2`,
      nodes: autoplayMedia.slice(0, 3).map(m => m.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag142'],
    });
  }

  return issues;
}
