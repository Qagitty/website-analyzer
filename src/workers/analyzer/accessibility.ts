import type {
  AccessibilityFinding,
  AccessibilityAuditResult,
  AccessibilityFindingStatus,
  AccessibilitySeverity,
  AccessibilityNodeEvidence,
  AccessibilityScoreBreakdown,
  ContrastEvidence,
} from '../../types/accessibility';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCESSIBILITY_VERSION = 'accessibility-v2' as const;
const MAX_HTML_BYTES = 600_000;
const MAX_NODES_PER_FINDING = 3;
const MAX_SNIPPET_LEN = 200;
const MAX_IFRAMES = 20;

const DISCLAIMER =
  'This analysis is based on static HTML inspection only. A full WCAG audit requires ' +
  'testing with real browsers, screen readers, and keyboard navigation. Results are ' +
  'heuristic — false positives and false negatives are possible.';

// ─── Manual review checklist ──────────────────────────────────────────────────

export const MANUAL_REVIEW_CHECKLIST: string[] = [
  'Keyboard navigation: every interactive element reachable via Tab key',
  'Focus order: tab order matches visual reading order',
  'Screen reader: all content makes sense when read aloud',
  'Focus trap: modal dialogs trap focus and release it on close',
  'Keyboard shortcuts: no conflicts with assistive technology shortcuts',
  'Colour contrast: all text/background combinations meet 4.5:1 (AA normal text)',
  'Large-text contrast: headings and large UI text meet 3:1 (AA)',
  'Animations: users can pause, stop, or hide moving/flashing content',
  'Session timeout: users warned before session expires with time to extend',
  'Dynamic content: live regions announce dynamically loaded content',
  'Skip links: skip-to-content link is visible on keyboard focus',
  'Form validation: error messages are programmatically associated with their fields',
  'Custom widgets: dropdowns, tabs, modals have correct ARIA roles and states',
  'Images of text: text embedded in images has a text equivalent',
  'Motion: prefers-reduced-motion media query is respected',
  'Touch targets: interactive elements are at least 44×44 CSS pixels',
  'Orientation: content is not locked to portrait or landscape',
  'Language of parts: inline content-language changes are annotated with lang attribute',
  'Error identification: form errors clearly describe what went wrong',
  'Status messages: success/progress messages are announced without moving focus',
];

// ─── Rule metadata ────────────────────────────────────────────────────────────

interface RuleMeta {
  wcag: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  wcagCriteria: string[];
  severity: AccessibilitySeverity;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
}

const RULE_META: Record<string, RuleMeta> = {
  'image-alt':                    { wcag: '1.1.1 Non-text Content',                             wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag111'],             severity: 'critical', impact: 'critical' },
  'image-alt-empty':              { wcag: '1.1.1 Non-text Content',                             wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag111'],             severity: 'minor',    impact: 'minor'    },
  'html-has-lang':                { wcag: '3.1.1 Language of Page',                             wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag311'],             severity: 'serious',  impact: 'serious'  },
  'label':                        { wcag: '1.3.1 Info and Relationships / 3.3.2 Labels',        wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131','wcag332'],    severity: 'critical', impact: 'critical' },
  'label-placeholder':            { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'moderate', impact: 'moderate' },
  'select-label':                 { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'critical', impact: 'critical' },
  'textarea-label':               { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'critical', impact: 'critical' },
  'button-name':                  { wcag: '4.1.2 Name, Role, Value',                            wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag412'],             severity: 'critical', impact: 'critical' },
  'link-name-generic':            { wcag: '2.4.4 Link Purpose (In Context)',                    wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag244'],             severity: 'serious',  impact: 'serious'  },
  'link-name-empty':              { wcag: '4.1.2 Name, Role, Value / 2.4.4 Link Purpose',      wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag244','wcag412'],   severity: 'serious',  impact: 'serious'  },
  'link-new-tab-no-warning':      { wcag: '3.2.1 On Focus (best practice G201)',                wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag321'],             severity: 'minor',    impact: 'minor'    },
  'page-has-heading-one':         { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'moderate', impact: 'moderate' },
  'heading-multiple-h1':          { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'moderate', impact: 'moderate' },
  'heading-skipped':              { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'moderate', impact: 'moderate' },
  'landmark-main-missing':        { wcag: '1.3.1 Info and Relationships / 2.4.1 Bypass',       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'moderate', impact: 'moderate' },
  'landmark-nav-missing':         { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'minor',    impact: 'minor'    },
  'skip-link':                    { wcag: '2.4.1 Bypass Blocks',                                wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag241'],             severity: 'moderate', impact: 'moderate' },
  'aria-hidden-focus':            { wcag: '4.1.2 Name, Role, Value',                            wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag412'],             severity: 'serious',  impact: 'serious'  },
  'aria-label-empty':             { wcag: '4.1.2 Name, Role, Value',                            wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag412'],             severity: 'serious',  impact: 'serious'  },
  'tabindex-positive':            { wcag: '2.4.3 Focus Order',                                  wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag243'],             severity: 'serious',  impact: 'serious'  },
  'focus-outline-removed':        { wcag: '2.4.7 Focus Visible / 2.4.11 Focus Appearance',     wcagLevel: 'AA', wcagCriteria: ['wcag2aa','wcag247','wcag2411'], severity: 'serious',  impact: 'serious'  },
  'click-events-have-key-events': { wcag: '2.1.1 Keyboard',                                    wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag211'],             severity: 'serious',  impact: 'serious'  },
  'svg-img-alt':                  { wcag: '1.1.1 Non-text Content',                             wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag111'],             severity: 'moderate', impact: 'moderate' },
  'svg-decorative-aria-hidden':   { wcag: '1.1.1 Non-text Content (best practice)',             wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag111'],             severity: 'minor',    impact: 'minor'    },
  'meta-viewport-user-scalable':  { wcag: '1.4.4 Resize Text',                                 wcagLevel: 'AA', wcagCriteria: ['wcag2aa','wcag144'],            severity: 'critical', impact: 'critical' },
  'color-contrast':               { wcag: '1.4.3 Contrast (Minimum)',                          wcagLevel: 'AA', wcagCriteria: ['wcag2aa','wcag143'],            severity: 'serious',  impact: 'serious'  },
  'video-caption':                { wcag: '1.2.2 Captions (Prerecorded)',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag122'],             severity: 'critical', impact: 'critical' },
  'table-duplicate-name':         { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'serious',  impact: 'serious'  },
  'table-th-no-scope':            { wcag: '1.3.1 Info and Relationships',                       wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag131'],             severity: 'moderate', impact: 'moderate' },
  'frame-title':                  { wcag: '2.4.1 Bypass Blocks / 4.1.2 Name, Role, Value',     wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag241','wcag412'],   severity: 'serious',  impact: 'serious'  },
  'audio-caption':                { wcag: '1.2.1 Audio-only and Video-only (Prerecorded)',      wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag121'],             severity: 'serious',  impact: 'serious'  },
  'no-autoplay-audio':            { wcag: '1.4.2 Audio Control',                                wcagLevel: 'A',  wcagCriteria: ['wcag2a','wcag142'],             severity: 'moderate', impact: 'moderate' },
};

// ─── Finding text (7-point format) ───────────────────────────────────────────

interface FindingText {
  what: string;
  why: string;
  who: string;
  howToFix: string;
  howToVerify: string;
}

const FINDING_TEXT: Record<string, FindingText> = {
  'image-alt': {
    what: 'Images missing alt attribute',
    why: 'Without alt text, screen readers announce the filename or "image" giving users no useful information about what the image shows.',
    who: 'Blind users and users with low vision using screen readers.',
    howToFix: 'Add alt="..." to every <img>. Use a concise description of the image content. Use alt="" for purely decorative images.',
    howToVerify: 'Navigate to each image with a screen reader — it should announce a meaningful description, not a filename.',
  },
  'image-alt-empty': {
    what: 'Images have empty alt text — verify they are purely decorative',
    why: 'Empty alt="" tells screen readers to skip the image. This is correct for decorative images but hides content from blind users if the image carries meaning.',
    who: 'Blind users who need context from informative images.',
    howToFix: 'If the image conveys meaning, add descriptive alt text. If truly decorative, empty alt is correct.',
    howToVerify: 'Visually inspect each affected image. Ask: would a sighted user miss information if this image were replaced by nothing?',
  },
  'html-has-lang': {
    what: '<html> element missing lang attribute',
    why: 'Screen readers select speech synthesizer voices and pronunciation rules based on the lang attribute. Without it, words may be mispronounced.',
    who: 'Screen reader users, particularly non-English speakers.',
    howToFix: 'Add lang="en" (or the appropriate BCP-47 code) to the <html> element.',
    howToVerify: 'Inspect the HTML source — <html lang="en"> should be present.',
  },
  'label': {
    what: 'Form inputs may be missing associated labels',
    why: 'Without a visible label, screen reader users cannot identify what information to enter into a field.',
    who: 'Screen reader users and voice-control users (e.g. "click username field").',
    howToFix: 'Use <label for="id"> paired with the input\'s id, or add aria-label="..." directly to the input.',
    howToVerify: 'Tab to each input with a screen reader — a meaningful label should be announced.',
  },
  'label-placeholder': {
    what: 'Inputs use placeholder text as their only label',
    why: 'Placeholder disappears when users start typing, leaving them without context. Placeholders also have low contrast and are not announced by all screen readers.',
    who: 'Cognitive disability users, elderly users, and some screen reader users.',
    howToFix: 'Add a visible <label> element in addition to the placeholder. Keep the placeholder as a hint, not the primary identifier.',
    howToVerify: 'Start typing in the field — a label should remain visible beside or above it.',
  },
  'select-label': {
    what: '<select> dropdowns missing accessible labels',
    why: 'Screen readers announce the current selection but cannot tell users what the dropdown is for without a label.',
    who: 'Screen reader users and voice-control users.',
    howToFix: 'Use <label for="select-id"> or add aria-label="..." to the <select> element.',
    howToVerify: 'Tab to the dropdown with a screen reader — its purpose should be announced.',
  },
  'textarea-label': {
    what: '<textarea> fields missing accessible labels',
    why: 'Screen readers cannot communicate what text should be entered in an unlabelled textarea.',
    who: 'Screen reader users.',
    howToFix: 'Use <label for="textarea-id"> or add aria-label="..." to the textarea.',
    howToVerify: 'Tab to the textarea with a screen reader — the label should be announced.',
  },
  'button-name': {
    what: 'Buttons have no accessible name',
    why: 'Screen readers announce buttons by name. An unnamed button is read as "button" with no context about what it does.',
    who: 'Screen reader users and voice-control users.',
    howToFix: 'Add visible text inside <button>, or add aria-label="..." to describe its action. For icon-only buttons, aria-label is required.',
    howToVerify: 'Tab to each button with a screen reader — its purpose should be clearly announced.',
  },
  'link-name-generic': {
    what: 'Links use non-descriptive generic text ("click here", "read more", etc.)',
    why: 'Screen readers list all links out of context. "Click here" tells users nothing about the destination.',
    who: 'Screen reader users navigating via the links list.',
    howToFix: 'Rewrite link text to describe the destination: "Read our privacy policy" instead of "click here".',
    howToVerify: 'Open a screen reader\'s links list (e.g. NVDA: Insert+F7) — every link should make sense in isolation.',
  },
  'link-name-empty': {
    what: 'Links have no accessible name — no text and no aria-label',
    why: 'An empty link is read as just "link" with no description of where it goes.',
    who: 'Screen reader users.',
    howToFix: 'Add visible text inside the <a>, or add aria-label="..." to describe the destination.',
    howToVerify: 'Tab to the link with a screen reader — the destination or purpose should be announced.',
  },
  'link-new-tab-no-warning': {
    what: 'Links open in a new tab without warning users',
    why: 'Opening a new tab without warning can disorient users who cannot see the context change, particularly screen reader users.',
    who: 'Screen reader users, keyboard users, and users with cognitive disabilities.',
    howToFix: 'Add visible text like "(opens in new tab)" near the link, or include it in aria-label.',
    howToVerify: 'Check that all target="_blank" links communicate the tab-opening behaviour before activation.',
  },
  'page-has-heading-one': {
    what: 'Page has no <h1> heading',
    why: 'The h1 provides the page\'s main title. Screen reader users navigate by headings; without an h1, they cannot identify the page topic.',
    who: 'Screen reader users who navigate by headings.',
    howToFix: 'Add exactly one <h1> element describing the page\'s main topic at the top of the content.',
    howToVerify: 'View the heading outline with a screen reader\'s headings list — one h1 should appear.',
  },
  'heading-multiple-h1': {
    what: 'Page has multiple <h1> headings',
    why: 'Multiple h1 elements break the document outline and confuse screen reader users about the page structure.',
    who: 'Screen reader users navigating by headings.',
    howToFix: 'Use exactly one <h1> for the main page title. Use <h2>–<h6> for subsections.',
    howToVerify: 'Check the heading outline — only one H1 should appear.',
  },
  'heading-skipped': {
    what: 'Heading levels are skipped (e.g. h1 → h3 without h2)',
    why: 'Sequential heading levels create a logical document outline. Skipped levels suggest missing content and confuse users navigating by headings.',
    who: 'Screen reader users who navigate by headings.',
    howToFix: 'Ensure heading levels are sequential. Adjust visual styling with CSS rather than skipping levels.',
    howToVerify: 'Use a headings outline tool — no levels should be skipped.',
  },
  'landmark-main-missing': {
    what: 'Page has no <main> landmark region',
    why: 'The <main> landmark lets screen reader users jump directly to the main content, bypassing repeated navigation.',
    who: 'Screen reader users and keyboard-only users.',
    howToFix: 'Wrap the main page content in a <main> element, or add role="main" to the appropriate container.',
    howToVerify: 'Navigate by landmarks with a screen reader — a "main" region should be reachable.',
  },
  'landmark-nav-missing': {
    what: 'Page has no <nav> landmark',
    why: 'The <nav> landmark identifies navigation regions, allowing screen reader users to navigate to or skip past them efficiently.',
    who: 'Screen reader users.',
    howToFix: 'Wrap navigation links in a <nav> element.',
    howToVerify: 'Navigate by landmarks — a "navigation" region should be announced.',
  },
  'skip-link': {
    what: 'No "skip to main content" link found',
    why: 'Without a skip link, keyboard users must tab through all navigation on every page load — which can be dozens of keystrokes.',
    who: 'Keyboard-only users and users with motor disabilities.',
    howToFix: 'Add <a href="#main" class="sr-only focus:not-sr-only">Skip to main content</a> as the first element in <body>. Make it visible on focus.',
    howToVerify: 'Press Tab on page load — a skip link should appear. Activating it should move focus to the main content.',
  },
  'aria-hidden-focus': {
    what: 'Interactive elements marked aria-hidden="true" can still receive keyboard focus',
    why: 'Keyboard focus can land on an element hidden from screen readers, creating a "focus black hole" — the user cannot tell where they are.',
    who: 'Keyboard and screen reader users.',
    howToFix: 'Remove aria-hidden="true" from focusable elements, add tabindex="-1" to exclude them from tab order, or use the inert attribute.',
    howToVerify: 'Tab through the page with a screen reader — focus should never disappear without announcement.',
  },
  'aria-label-empty': {
    what: 'Elements have empty aria-label="" which removes their accessible name',
    why: 'An empty aria-label="" overrides all other accessible names, making the element completely unnamed for screen readers.',
    who: 'Screen reader users.',
    howToFix: 'Either remove the aria-label attribute, or provide a meaningful value.',
    howToVerify: 'Inspect affected elements with a screen reader — they should have meaningful names.',
  },
  'tabindex-positive': {
    what: 'Elements use positive tabindex values, disrupting natural focus order',
    why: 'Positive tabindex creates a separate focus sequence that overrides the document\'s natural reading order, causing keyboard users to jump unexpectedly.',
    who: 'Keyboard users and screen reader users.',
    howToFix: 'Remove positive tabindex. Use tabindex="0" to include elements in the natural order, or restructure the DOM.',
    howToVerify: 'Tab through the page — focus should move in a logical reading order.',
  },
  'focus-outline-removed': {
    what: 'CSS removes the visible focus indicator from interactive elements',
    why: 'The focus ring shows keyboard users which element is active. Removing it without replacement makes keyboard navigation impossible to track.',
    who: 'Keyboard users, users with low vision, and users with attention or motor disabilities.',
    howToFix: 'Replace the removed outline with a custom focus style: .element:focus-visible { outline: 2px solid #4f46e5; outline-offset: 2px; }',
    howToVerify: 'Tab through all interactive elements — a visible focus indicator should always be present.',
  },
  'click-events-have-key-events': {
    what: 'Non-interactive elements (div/span) handle clicks without keyboard support',
    why: 'div and span are not keyboard-focusable by default. Onclick without tabindex and keyboard handlers makes functionality completely inaccessible.',
    who: 'Keyboard-only users and screen reader users.',
    howToFix: 'Replace with <button> or <a>. If you must use div/span, add tabindex="0", role="button", and keydown/keyup handlers for Enter/Space.',
    howToVerify: 'Tab to the element — it should receive focus. Press Enter or Space — it should activate.',
  },
  'svg-img-alt': {
    what: 'Meaningful SVG images have no accessible label',
    why: 'SVGs used as illustrations or diagrams are invisible to screen readers unless labelled.',
    who: 'Screen reader users.',
    howToFix: 'Add role="img" aria-label="Description" to meaningful SVGs. For decorative SVGs, add aria-hidden="true".',
    howToVerify: 'Navigate to the SVG with a screen reader — meaningful SVGs should be announced with their purpose.',
  },
  'svg-decorative-aria-hidden': {
    what: 'Small SVG icons appear decorative but are missing aria-hidden="true"',
    why: 'When an icon-only SVG is inside a button that already has text, the SVG may be announced separately, creating redundant announcements.',
    who: 'Screen reader users.',
    howToFix: 'Add aria-hidden="true" to SVG icons that are purely decorative (the parent button/link already has an accessible name).',
    howToVerify: 'Activate the button with a screen reader — the icon should not be announced separately from the button name.',
  },
  'meta-viewport-user-scalable': {
    what: 'Viewport configuration prevents users from zooming',
    why: 'Low-vision users rely on browser zoom to read content. Blocking zoom forces them to use the page at a size they may not be able to read.',
    who: 'Users with low vision, elderly users, and users in bright lighting.',
    howToFix: 'Remove user-scalable=no and maximum-scale=1 from the viewport meta tag. Use content="width=device-width, initial-scale=1" only.',
    howToVerify: 'Pinch-zoom on mobile — zooming should work. Zoom to 200% on desktop — content should be readable.',
  },
  'color-contrast': {
    what: 'Text colour may not have sufficient contrast against its background',
    why: 'Low contrast makes text difficult or impossible to read for users with low vision or colour blindness.',
    who: 'Users with low vision, colour-blind users, and users in poor lighting.',
    howToFix: 'Ensure normal text has at least 4.5:1 contrast ratio and large text (18pt+ or 14pt+ bold) has at least 3:1.',
    howToVerify: 'Use a browser extension (Colour Contrast Analyser, axe DevTools) to measure contrast ratios on all text.',
  },
  'video-caption': {
    what: '<video> elements are missing caption tracks',
    why: 'Without captions, deaf and hard-of-hearing users cannot access spoken content in videos.',
    who: 'Deaf and hard-of-hearing users, and users in sound-sensitive environments.',
    howToFix: 'Add <track kind="captions" src="captions.vtt" srclang="en" label="English"> inside each <video> element.',
    howToVerify: 'Enable captions in the video player — captions should appear and be accurate.',
  },
  'table-duplicate-name': {
    what: 'Data tables have no <th> header cells',
    why: 'Without header cells, screen readers cannot announce which column or row each cell belongs to.',
    who: 'Screen reader users navigating data tables.',
    howToFix: 'Add <th scope="col"> or <th scope="row"> elements for all column and row headers.',
    howToVerify: 'Navigate cell-by-cell with a screen reader — the header should be announced with each data cell.',
  },
  'table-th-no-scope': {
    what: '<th> header cells are missing scope attribute',
    why: 'Without scope, screen readers cannot reliably associate headers with their cells in complex tables.',
    who: 'Screen reader users navigating complex tables.',
    howToFix: 'Add scope="col" to column headers and scope="row" to row headers.',
    howToVerify: 'Navigate the table with a screen reader — headers should be announced in the correct direction.',
  },
  'frame-title': {
    what: '<iframe> elements are missing a title attribute',
    why: 'Screen readers use the title to identify embedded content. Without it, users cannot know what the iframe contains.',
    who: 'Screen reader users.',
    howToFix: 'Add title="..." to every visible <iframe>.',
    howToVerify: 'Navigate to each iframe with a screen reader — its purpose should be announced.',
  },
  'audio-caption': {
    what: '<audio> elements detected — verify text transcripts are provided',
    why: 'Deaf and hard-of-hearing users cannot access audio-only content without a text transcript.',
    who: 'Deaf and hard-of-hearing users.',
    howToFix: 'Provide a text transcript adjacent to each <audio> element capturing all spoken content.',
    howToVerify: 'Locate the transcript near the audio and verify it captures all speech and relevant sounds.',
  },
  'no-autoplay-audio': {
    what: 'Media elements autoplay with audio',
    why: 'Autoplaying audio interferes with screen reader speech, disorienting users before they can stop it.',
    who: 'Screen reader users and users with cognitive disabilities.',
    howToFix: 'Remove the autoplay attribute, or add muted and provide a play button.',
    howToVerify: 'Load the page — no audio should play automatically without user interaction.',
  },
};

// ─── Analytics iframe pattern — these do not need visible titles ──────────────

const ANALYTICS_IFRAME_SRC_RE = /gtm\.js|googletagmanager|google-analytics|facebook\.com\/plugins|pixel\.facebook|doubleclick|hotjar|clarity\.ms|analytics/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET_ATTR_RE = /\b(token|secret|password|api[_-]?key|auth|credential|bearer|session|jwt)\s*=\s*["'][^"']{8,}["']/gi;

function sanitizeSnippet(html: string): string {
  return html
    .slice(0, MAX_SNIPPET_LEN)
    .replace(SECRET_ATTR_RE, (_, attr: string) => `${attr}="[redacted]"`);
}

function makeEvidence(snippet: string, selector = ''): AccessibilityNodeEvidence {
  return { selector, html: sanitizeSnippet(snippet) };
}

function isHiddenElement(tag: string): boolean {
  if (/style\s*=\s*["'][^"']*display\s*:\s*none/i.test(tag)) return true;
  if (/style\s*=\s*["'][^"']*visibility\s*:\s*hidden/i.test(tag)) return true;
  if (/\bhidden\b/i.test(tag)) return true;
  if (/aria-hidden\s*=\s*["']true["']/i.test(tag)) return true;
  if (/width\s*=\s*["']0["']/i.test(tag) && /height\s*=\s*["']0["']/i.test(tag)) return true;
  return false;
}

function buildFinding(
  id: string,
  status: AccessibilityFindingStatus,
  count: number,
  nodeEvidences: AccessibilityNodeEvidence[],
  textOverrides?: Partial<FindingText>,
  contrastEvidence?: ContrastEvidence,
): AccessibilityFinding {
  const meta = RULE_META[id] ?? {
    wcag: 'Unknown criterion',
    wcagLevel: 'A' as const,
    wcagCriteria: [] as string[],
    severity: 'moderate' as AccessibilitySeverity,
    impact: 'moderate' as 'critical' | 'serious' | 'moderate' | 'minor',
  };
  const text = FINDING_TEXT[id];
  const what      = textOverrides?.what      ?? text?.what      ?? id;
  const why       = textOverrides?.why       ?? text?.why       ?? '';
  const who       = textOverrides?.who       ?? text?.who       ?? '';
  const howToFix  = textOverrides?.howToFix  ?? text?.howToFix  ?? '';
  const howToVerify = textOverrides?.howToVerify ?? text?.howToVerify ?? '';

  return {
    id,
    severity: meta.severity,
    status,
    what,
    why,
    who,
    wcag: meta.wcag,
    wcagLevel: meta.wcagLevel,
    where: nodeEvidences.slice(0, MAX_NODES_PER_FINDING),
    howToFix,
    howToVerify,
    count,
    contrastEvidence,
    // Legacy aliases
    impact: meta.impact,
    description: what,
    nodes: nodeEvidences.slice(0, MAX_NODES_PER_FINDING).map(e => e.html),
    wcagCriteria: meta.wcagCriteria,
  };
}

// ─── Colour contrast ──────────────────────────────────────────────────────────

function hexToLuminance(hex: string): number | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 3 && clean.length !== 6) return null;
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lo = Math.min(l1, l2);
  const hi = Math.max(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function detectContrastIssues(html: string): AccessibilityFinding[] {
  const inlineStyleRe = /style\s*=\s*["']([^"']*)["']/gi;
  let confirmedViolations = 0;
  let firstEvidence: ContrastEvidence | undefined;

  let m: RegExpExecArray | null;
  while ((m = inlineStyleRe.exec(html)) !== null) {
    const style = m[1];
    const fgMatch = /\bcolor\s*:\s*(#[0-9a-f]{3,6})/i.exec(style);
    const bgMatch = /background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})/i.exec(style);
    if (fgMatch && bgMatch) {
      const fgL = hexToLuminance(fgMatch[1]);
      const bgL = hexToLuminance(bgMatch[1]);
      if (fgL !== null && bgL !== null) {
        const ratio = contrastRatio(fgL, bgL);
        if (ratio < 4.5) {
          confirmedViolations++;
          if (!firstEvidence) {
            firstEvidence = {
              fgColor: fgMatch[1],
              bgColor: bgMatch[1],
              ratio: Math.round(ratio * 100) / 100,
              requiredRatio: 4.5,
              isLargeText: false,
              source: 'inline-style',
            };
          }
        }
      }
    }
  }

  if (confirmedViolations > 0 && firstEvidence) {
    return [buildFinding(
      'color-contrast',
      'confirmed',
      confirmedViolations,
      [],
      { what: `${confirmedViolations} inline style(s) have insufficient colour contrast (ratio: ${firstEvidence.ratio}:1, required ≥ 4.5:1)` },
      firstEvidence,
    )];
  }

  // Heuristic fallback — light colour values that may not contrast well
  const lightColours = (html.match(/color\s*:\s*(#(?:[89a-fA-F][0-9a-fA-F]{5}|[cCdDeEfF][0-9a-fA-F]{2})|lightgr[ae]y|silver|#ccc|#ddd|#eee|#aaa|#bbb)/gi) || []).length;
  if (lightColours >= 3) {
    return [buildFinding(
      'color-contrast',
      'manual-review',
      lightColours,
      [],
      { what: `${lightColours} instance(s) of potentially light text colour detected — manual contrast check required` },
    )];
  }

  return [];
}

// ─── Focus indicator ──────────────────────────────────────────────────────────

function checkFocusIndicator(html: string): AccessibilityFinding | null {
  const inFocusSelector = /\:focus(?:-visible)?\s*\{[^}]*\boutline\s*:\s*(?:none|0)\b/i.test(html);
  const inGeneral       = /\boutline\s*:\s*(?:none|0)\b/i.test(html);

  if (!inFocusSelector && !inGeneral) return null;

  const hasCompensation = /\:focus(?:-visible)?\s*\{[^}]*(box-shadow|border\s*:|background)/i.test(html);

  if (inFocusSelector) {
    if (hasCompensation) {
      return buildFinding('focus-outline-removed', 'manual-review', 1, [],
        { what: 'CSS removes focus outline but compensating focus styles detected — verify the focus indicator is visible' });
    }
    return buildFinding('focus-outline-removed', 'confirmed', 1, []);
  }

  return buildFinding('focus-outline-removed', 'likely', 1, [],
    { what: 'CSS contains outline:none — verify this does not remove the keyboard focus indicator' });
}

// ─── SVG accessibility ────────────────────────────────────────────────────────

function checkSvgAccessibility(html: string): AccessibilityFinding[] {
  const results: AccessibilityFinding[] = [];
  const svgBlocks = html.match(/<svg[\s\S]*?<\/svg>/gi) || [];

  let meaningfulUnlabelled = 0;
  let decorativeNoAriaHidden = 0;
  const meaningfulNodes: AccessibilityNodeEvidence[] = [];
  const decorativeNodes: AccessibilityNodeEvidence[] = [];

  for (const svg of svgBlocks) {
    const openTag = svg.match(/^<svg[^>]*/i)?.[0] ?? '';

    if (/aria-hidden\s*=\s*["']true["']/i.test(openTag)) continue;
    if (/role\s*=\s*["'](presentation|none)["']/i.test(openTag)) continue;
    if (isHiddenElement(openTag)) continue;

    const hasAriaLabel      = /aria-label\s*=\s*["'][^"']+["']/i.test(openTag);
    const hasAriaLabelledBy = /aria-labelledby\s*=/i.test(openTag);
    const hasTitleAndRoleImg = /<title[^>]*>[^<]+<\/title>/i.test(svg) && /role\s*=\s*["']img["']/i.test(openTag);

    if (hasAriaLabel || hasAriaLabelledBy || hasTitleAndRoleImg) continue;

    // Icon-sized SVG (explicit width/height ≤ 32) → likely decorative
    const isIconSized = /(?:width|height)\s*=\s*["'](?:[1-9]|[12]\d|3[0-2])["']/i.test(openTag);

    if (isIconSized) {
      decorativeNoAriaHidden++;
      if (decorativeNodes.length < MAX_NODES_PER_FINDING) decorativeNodes.push(makeEvidence(openTag + '...'));
    } else {
      meaningfulUnlabelled++;
      if (meaningfulNodes.length < MAX_NODES_PER_FINDING) meaningfulNodes.push(makeEvidence(openTag + '...'));
    }
  }

  if (meaningfulUnlabelled > 0) {
    results.push(buildFinding('svg-img-alt', 'likely', meaningfulUnlabelled, meaningfulNodes,
      { what: `${meaningfulUnlabelled} SVG element(s) appear meaningful but have no accessible label` }));
  }
  if (decorativeNoAriaHidden > 0) {
    results.push(buildFinding('svg-decorative-aria-hidden', 'likely', decorativeNoAriaHidden, decorativeNodes,
      { what: `${decorativeNoAriaHidden} small SVG icon(s) appear decorative but are missing aria-hidden="true"` }));
  }
  return results;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeScoreBreakdown(findings: AccessibilityFinding[]): AccessibilityScoreBreakdown {
  let cCrit = 0, cSer = 0, cMod = 0, cMin = 0;
  let lCrit = 0, lSer = 0, lMod = 0, lMin = 0;
  let manualItems = 0;

  for (const f of findings) {
    if (f.status === 'manual-review' || f.status === 'passed' || f.status === 'not-applicable') {
      if (f.status === 'manual-review') manualItems++;
      continue;
    }
    const likely = f.status === 'likely';
    const sev = f.severity === 'manual-review' ? 'minor' : f.severity;
    if (likely) {
      if (sev === 'critical') lCrit++;
      else if (sev === 'serious') lSer++;
      else if (sev === 'moderate') lMod++;
      else lMin++;
    } else {
      if (sev === 'critical') cCrit++;
      else if (sev === 'serious') cSer++;
      else if (sev === 'moderate') cMod++;
      else cMin++;
    }
  }

  // Penalty caps prevent a single rule from dominating the score
  const penalty =
    Math.min(cCrit * 12, 36) + Math.min(cSer * 7, 28) + Math.min(cMod * 4, 16) + Math.min(cMin * 2, 8) +
    Math.min(lCrit * 7, 21) + Math.min(lSer * 4, 16) + Math.min(lMod * 2, 8)   + Math.min(lMin * 1, 4);

  return {
    confirmedCritical: cCrit, confirmedSerious: cSer, confirmedModerate: cMod, confirmedMinor: cMin,
    likelyCritical: lCrit, likelySerious: lSer, likelyModerate: lMod, likelyMinor: lMin,
    manualReviewItems: manualItems,
    totalConfirmedAndLikely: cCrit + cSer + cMod + cMin + lCrit + lSer + lMod + lMin,
    weightedPenalty: penalty,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function checkAccessibility(html: string): AccessibilityAuditResult {
  let truncated = false;
  if (html.length > MAX_HTML_BYTES) {
    html = html.slice(0, MAX_HTML_BYTES);
    truncated = true;
  }

  const findings: AccessibilityFinding[] = [];

  // ── Element inventory ──────────────────────────────────────────────────────
  const imgs        = html.match(/<img[^>]*>/gi)                       || [];
  const inputs      = html.match(/<input[^>]*>/gi)                     || [];
  const buttonTags  = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi)  || [];
  const anchors     = html.match(/<a[^>]*>[\s\S]*?<\/a>/gi)            || [];
  const iframes     = html.match(/<iframe[^>]*>/gi)                    || [];
  const tableBlocks = html.match(/<table[\s\S]*?<\/table>/gi)          || [];
  const videoBlocks = html.match(/<video[\s\S]*?<\/video>/gi)          || [];
  const audioBlocks = html.match(/<audio[\s\S]*?<\/audio>/gi)          || [];
  const selects     = html.match(/<select[^>]*>/gi)                    || [];
  const textareas   = html.match(/<textarea[^>]*>/gi)                  || [];
  const svgBlocks   = html.match(/<svg[\s\S]*?<\/svg>/gi)              || [];

  // ── 1. Images ──────────────────────────────────────────────────────────────
  const visibleImgs = imgs.filter(img => {
    if (isHiddenElement(img)) return false;
    if (/role\s*=\s*["'](presentation|none)["']/i.test(img)) return false;
    return true;
  });

  const missingAlt = visibleImgs.filter(img =>
    !/\balt\s*=/i.test(img) &&
    !/\baria-label\s*=\s*["'][^"']+["']/i.test(img) &&
    !/\baria-labelledby\s*=/i.test(img) &&
    !/\btitle\s*=\s*["'][^"']+["']/i.test(img)
  );
  if (missingAlt.length > 0) {
    findings.push(buildFinding('image-alt', 'confirmed', missingAlt.length,
      missingAlt.slice(0, MAX_NODES_PER_FINDING).map(i => makeEvidence(i)),
      { what: `${missingAlt.length} image(s) missing alt attribute` }));
  }

  const emptyAlt = visibleImgs.filter(img => /\balt\s*=\s*["']\s*["']/i.test(img));
  if (emptyAlt.length > 0) {
    findings.push(buildFinding('image-alt-empty', 'manual-review', emptyAlt.length,
      emptyAlt.slice(0, MAX_NODES_PER_FINDING).map(i => makeEvidence(i)),
      { what: `${emptyAlt.length} image(s) have empty alt="" — verify they are purely decorative` }));
  }

  // ── 2. Language ────────────────────────────────────────────────────────────
  if (!/html[^>]+lang\s*=\s*["'][a-z]/i.test(html)) {
    findings.push(buildFinding('html-has-lang', 'confirmed', 1, [{ selector: 'html', html: '<html>' }]));
  }

  // ── 3. Form labels ────────────────────────────────────────────────────────
  const nonHiddenInputs = inputs.filter(i =>
    !isHiddenElement(i) &&
    !/type\s*=\s*["'](hidden|submit|button|reset|image)["']/i.test(i)
  );

  const unlabelled = nonHiddenInputs.filter(i =>
    !/\baria-label\s*=\s*["'][^"']+["']/i.test(i) &&
    !/\baria-labelledby\s*=/i.test(i) &&
    !/\bid\s*=/i.test(i) &&
    !/\btitle\s*=\s*["'][^"']+["']/i.test(i)
  );
  if (unlabelled.length > 0) {
    findings.push(buildFinding('label', 'likely', unlabelled.length,
      unlabelled.slice(0, MAX_NODES_PER_FINDING).map(i => makeEvidence(i)),
      { what: `${unlabelled.length} form input(s) may be missing accessible labels` }));
  }

  const placeholderOnly = nonHiddenInputs.filter(i =>
    /\bplaceholder\s*=/i.test(i) &&
    !/\baria-label\s*=\s*["'][^"']+["']/i.test(i) &&
    !/\baria-labelledby\s*=/i.test(i) &&
    !/\bid\s*=/i.test(i) &&
    !/\btitle\s*=\s*["'][^"']+["']/i.test(i)
  );
  if (placeholderOnly.length > 0) {
    findings.push(buildFinding('label-placeholder', 'likely', placeholderOnly.length,
      placeholderOnly.slice(0, MAX_NODES_PER_FINDING).map(i => makeEvidence(i)),
      { what: `${placeholderOnly.length} input(s) appear to use placeholder as their only label` }));
  }

  const unlabelledSelects = selects.filter(s =>
    !isHiddenElement(s) &&
    !/\baria-label\s*=\s*["'][^"']+["']/i.test(s) &&
    !/\baria-labelledby\s*=/i.test(s) &&
    !/\bid\s*=/i.test(s) &&
    !/\btitle\s*=\s*["'][^"']+["']/i.test(s)
  );
  if (unlabelledSelects.length > 0) {
    findings.push(buildFinding('select-label', 'likely', unlabelledSelects.length,
      unlabelledSelects.slice(0, MAX_NODES_PER_FINDING).map(s => makeEvidence(s)),
      { what: `${unlabelledSelects.length} <select> dropdown(s) may be missing accessible labels` }));
  }

  const unlabelledTextareas = textareas.filter(t =>
    !isHiddenElement(t) &&
    !/\baria-label\s*=\s*["'][^"']+["']/i.test(t) &&
    !/\baria-labelledby\s*=/i.test(t) &&
    !/\bid\s*=/i.test(t) &&
    !/\btitle\s*=\s*["'][^"']+["']/i.test(t)
  );
  if (unlabelledTextareas.length > 0) {
    findings.push(buildFinding('textarea-label', 'likely', unlabelledTextareas.length,
      unlabelledTextareas.slice(0, MAX_NODES_PER_FINDING).map(t => makeEvidence(t)),
      { what: `${unlabelledTextareas.length} <textarea> field(s) may be missing accessible labels` }));
  }

  // ── 4. Button names ────────────────────────────────────────────────────────
  const emptyButtons = buttonTags.filter(btn => {
    const openTag = btn.match(/^<button[^>]*/i)?.[0] ?? '';
    if (isHiddenElement(openTag)) return false;
    if (/\baria-label\s*=\s*["'][^"']+["']/i.test(btn)) return false;
    if (/\baria-labelledby\s*=/i.test(btn)) return false;
    if (/\btitle\s*=\s*["'][^"']+["']/i.test(openTag)) return false;
    return btn.replace(/<[^>]+>/g, '').trim().length === 0;
  });
  if (emptyButtons.length > 0) {
    findings.push(buildFinding('button-name', 'confirmed', emptyButtons.length,
      emptyButtons.slice(0, MAX_NODES_PER_FINDING).map(b => makeEvidence(b)),
      { what: `${emptyButtons.length} button(s) have no accessible name` }));
  }

  // ── 5. Links ───────────────────────────────────────────────────────────────
  const visibleAnchors = anchors.filter(a => {
    const tag = a.match(/^<a[^>]*/i)?.[0] ?? '';
    return !isHiddenElement(tag) && /\bhref\s*=/i.test(tag);
  });

  const GENERIC_LINK_TEXT = /^(click here|here|read more|more|link|this|learn more|details|info|see more|continue|go|view)$/i;
  const genericLinks = visibleAnchors.filter(a => {
    const openTag = a.match(/^<a[^>]*/i)?.[0] ?? '';
    const ariaLabel = (openTag.match(/\baria-label\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').trim();
    const titleAttr = (openTag.match(/\btitle\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').trim();
    const innerText = a.replace(/<[^>]+>/g, '').trim();
    const labels = [innerText, ariaLabel, titleAttr].filter(l => l.length > 0);
    return labels.length > 0 && labels.every(l => GENERIC_LINK_TEXT.test(l));
  });
  if (genericLinks.length > 0) {
    findings.push(buildFinding('link-name-generic', 'confirmed', genericLinks.length,
      genericLinks.slice(0, MAX_NODES_PER_FINDING).map(a => makeEvidence(a)),
      { what: `${genericLinks.length} link(s) use generic non-descriptive text` }));
  }

  const emptyLinks = visibleAnchors.filter(a => {
    const openTag = a.match(/^<a[^>]*/i)?.[0] ?? '';
    if (/\baria-label\s*=\s*["'][^"']+["']/i.test(openTag)) return false;
    if (/\btitle\s*=\s*["'][^"']+["']/i.test(openTag)) return false;
    if (/\baria-labelledby\s*=/i.test(openTag)) return false;
    return a.replace(/<[^>]+>/g, '').trim().length === 0;
  });
  if (emptyLinks.length > 0) {
    findings.push(buildFinding('link-name-empty', 'confirmed', emptyLinks.length,
      emptyLinks.slice(0, MAX_NODES_PER_FINDING).map(a => makeEvidence(a)),
      { what: `${emptyLinks.length} link(s) have no accessible name` }));
  }

  const newTabLinks = visibleAnchors.filter(a => {
    if (!/\btarget\s*=\s*["']_blank["']/i.test(a)) return false;
    const openTag = a.match(/^<a[^>]*/i)?.[0] ?? '';
    const ariaLabel = (openTag.match(/\baria-label\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').toLowerCase();
    const titleAttr = (openTag.match(/\btitle\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').toLowerCase();
    const inner = a.toLowerCase();
    return (
      !/opens?.{0,20}(new|external)|(new|external).{0,20}(tab|window)|external.{0,10}link/i.test(inner) &&
      !/opens?.{0,20}(new|external)/i.test(ariaLabel) &&
      !/opens?.{0,20}(new|external)/i.test(titleAttr) &&
      !/sr-only|visually.?hidden/i.test(a)
    );
  });
  if (newTabLinks.length > 0) {
    findings.push(buildFinding('link-new-tab-no-warning', 'likely', newTabLinks.length,
      newTabLinks.slice(0, MAX_NODES_PER_FINDING).map(a => makeEvidence(a)),
      { what: `${newTabLinks.length} link(s) open in a new tab without warning users` }));
  }

  // ── 6. Headings ────────────────────────────────────────────────────────────
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count === 0) {
    findings.push(buildFinding('page-has-heading-one', 'confirmed', 1, []));
  } else if (h1Count > 1) {
    findings.push(buildFinding('heading-multiple-h1', 'confirmed', h1Count, [],
      { what: `Page has ${h1Count} <h1> elements — should be exactly one` }));
  }

  const usedLevels = ([1, 2, 3, 4, 5, 6] as const)
    .map(n => ((html.match(new RegExp(`<h${n}[\\s>]`, 'gi')) || []).length > 0 ? n : null))
    .filter((n): n is number => n !== null);
  for (let i = 1; i < usedLevels.length; i++) {
    if (usedLevels[i] - usedLevels[i - 1] > 1) {
      findings.push(buildFinding('heading-skipped', 'confirmed', 1, [],
        { what: `Heading level skipped: <h${usedLevels[i - 1]}> jumps to <h${usedLevels[i]}>` }));
      break;
    }
  }

  // ── 7. Landmarks ───────────────────────────────────────────────────────────
  if (!/<main[\s>]/i.test(html) && !/role\s*=\s*["']main["']/i.test(html)) {
    findings.push(buildFinding('landmark-main-missing', 'confirmed', 1, []));
  }
  if (!/<nav[\s>]/i.test(html) && !/role\s*=\s*["']navigation["']/i.test(html)) {
    findings.push(buildFinding('landmark-nav-missing', 'confirmed', 1, []));
  }

  // ── 8. Skip link ───────────────────────────────────────────────────────────
  if (!/skip.{0,20}(nav|content)|href\s*=\s*["']#(main|content)/i.test(html)) {
    findings.push(buildFinding('skip-link', 'confirmed', 1, []));
  }

  // ── 9. ARIA misuse ────────────────────────────────────────────────────────
  const ariaHiddenFocusable = (html.match(/<(?:a|button|input|select|textarea)[^>]*aria-hidden\s*=\s*["']true["'][^>]*>/gi) || [])
    .filter(e => !isHiddenElement(e));
  if (ariaHiddenFocusable.length > 0) {
    findings.push(buildFinding('aria-hidden-focus', 'confirmed', ariaHiddenFocusable.length,
      ariaHiddenFocusable.slice(0, MAX_NODES_PER_FINDING).map(e => makeEvidence(e)),
      { what: `${ariaHiddenFocusable.length} interactive element(s) marked aria-hidden="true" while still focusable` }));
  }

  const emptyAriaCount = (html.match(/aria-label\s*=\s*["']\s*["']/gi) || []).length;
  if (emptyAriaCount > 0) {
    findings.push(buildFinding('aria-label-empty', 'confirmed', emptyAriaCount, [],
      { what: `${emptyAriaCount} element(s) have empty aria-label="" which removes their accessible name` }));
  }

  const posTabCount = (html.match(/\btabindex\s*=\s*["'][1-9]\d*["']/gi) || []).length;
  if (posTabCount > 0) {
    findings.push(buildFinding('tabindex-positive', 'confirmed', posTabCount, [],
      { what: `${posTabCount} element(s) use positive tabindex values` }));
  }

  // ── 10. Focus indicator ───────────────────────────────────────────────────
  const focusFinding = checkFocusIndicator(html);
  if (focusFinding) findings.push(focusFinding);

  // ── 11. Clickable non-interactive elements ────────────────────────────────
  const badDivs  = (html.match(/<div[^>]*onclick[^>]*>/gi) || [])
    .filter(d => !isHiddenElement(d) && !/role\s*=\s*["'](button|link|menuitem|tab|option)["']/i.test(d) && !/tabindex\s*=/i.test(d));
  const badSpans = (html.match(/<span[^>]*onclick[^>]*>/gi) || [])
    .filter(s => !isHiddenElement(s) && !/role\s*=\s*["'](button|link|menuitem|tab|option)["']/i.test(s) && !/tabindex\s*=/i.test(s));
  const badClickCount = badDivs.length + badSpans.length;
  if (badClickCount > 0) {
    findings.push(buildFinding('click-events-have-key-events', 'confirmed', badClickCount,
      [...badDivs, ...badSpans].slice(0, MAX_NODES_PER_FINDING).map(e => makeEvidence(e)),
      { what: `${badClickCount} div/span element(s) handle clicks without keyboard support` }));
  }

  // ── 12. SVG ───────────────────────────────────────────────────────────────
  findings.push(...checkSvgAccessibility(html));

  // ── 13. Viewport zoom ─────────────────────────────────────────────────────
  if (/user-scalable\s*=\s*no/i.test(html) || /maximum-scale\s*=\s*1[^.\d]/i.test(html)) {
    const vp = (html.match(/<meta[^>]*viewport[^>]*>/i) || [''])[0];
    findings.push(buildFinding('meta-viewport-user-scalable', 'confirmed', 1, [makeEvidence(vp)]));
  }

  // ── 14. Colour contrast ───────────────────────────────────────────────────
  findings.push(...detectContrastIssues(html));

  // ── 15. Video captions ────────────────────────────────────────────────────
  const videosNoTrack = videoBlocks.filter(v => !/<track/i.test(v));
  if (videosNoTrack.length > 0) {
    findings.push(buildFinding('video-caption', 'confirmed', videosNoTrack.length, [],
      { what: `${videosNoTrack.length} <video> element(s) missing caption track` }));
  }

  // ── 16. Tables ────────────────────────────────────────────────────────────
  const dataTables = tableBlocks.filter(t => /<td/i.test(t) && !/<th/i.test(t));
  if (dataTables.length > 0) {
    findings.push(buildFinding('table-duplicate-name', 'likely', dataTables.length, [],
      { what: `${dataTables.length} data table(s) appear to have no <th> header cells` }));
  }

  const thNoScope = (html.match(/<th[^>]*>/gi) || []).filter(t => !/scope\s*=/i.test(t));
  if (thNoScope.length > 0) {
    findings.push(buildFinding('table-th-no-scope', 'confirmed', thNoScope.length,
      thNoScope.slice(0, MAX_NODES_PER_FINDING).map(t => makeEvidence(t)),
      { what: `${thNoScope.length} <th> element(s) missing scope attribute` }));
  }

  // ── 17. Iframes ───────────────────────────────────────────────────────────
  const visibleIframes = iframes.slice(0, MAX_IFRAMES)
    .filter(f => !isHiddenElement(f) && !ANALYTICS_IFRAME_SRC_RE.test(f));

  const iframesNoTitle = visibleIframes.filter(f =>
    !/\btitle\s*=\s*["'][^"']+["']/i.test(f) &&
    !/\baria-label\s*=\s*["'][^"']+["']/i.test(f)
  );
  if (iframesNoTitle.length > 0) {
    findings.push(buildFinding('frame-title', 'confirmed', iframesNoTitle.length,
      iframesNoTitle.slice(0, MAX_NODES_PER_FINDING).map(f => makeEvidence(f)),
      { what: `${iframesNoTitle.length} visible <iframe> element(s) missing title attribute` }));
  }

  // ── 18. Audio ─────────────────────────────────────────────────────────────
  if (audioBlocks.length > 0) {
    findings.push(buildFinding('audio-caption', 'manual-review', audioBlocks.length, [],
      { what: `${audioBlocks.length} <audio> element(s) detected — verify text transcripts are provided` }));
  }

  // ── 19. Autoplay ──────────────────────────────────────────────────────────
  const autoplay = (html.match(/<(?:video|audio)[^>]*autoplay[^>]*>/gi) || [])
    .filter(m => !/\bmuted\b/i.test(m));
  if (autoplay.length > 0) {
    findings.push(buildFinding('no-autoplay-audio', 'confirmed', autoplay.length,
      autoplay.slice(0, MAX_NODES_PER_FINDING).map(m => makeEvidence(m)),
      { what: `${autoplay.length} media element(s) autoplay with audio` }));
  }

  // ── Score ──────────────────────────────────────────────────────────────────
  const scoreBreakdown = computeScoreBreakdown(findings);
  const score = Math.max(0, Math.round(100 - scoreBreakdown.weightedPenalty));

  return {
    version: ACCESSIBILITY_VERSION,
    mode: 'static-html-only',
    disclaimer: truncated
      ? DISCLAIMER + ' Note: HTML was truncated to 600 KB — some elements near the end may not have been analysed.'
      : DISCLAIMER,
    findings,
    score,
    scoreBreakdown,
    manualReviewItems: MANUAL_REVIEW_CHECKLIST,
    totalElements: {
      images:  imgs.length,
      inputs:  inputs.length,
      buttons: buttonTags.length,
      links:   anchors.length,
      iframes: iframes.length,
      svgs:    svgBlocks.length,
      tables:  tableBlocks.length,
      videos:  videoBlocks.length,
      audios:  audioBlocks.length,
    },
    error: truncated
      ? { code: 'HTML_TOO_LARGE', message: `HTML truncated at ${MAX_HTML_BYTES} bytes`, partial: true }
      : undefined,
  };
}
