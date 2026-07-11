/**
 * Centralized crawler registry.
 *
 * Single source of truth for all known search-engine and AI crawler identifiers.
 * Do not hardcode crawler user-agents scattered throughout the codebase.
 *
 * Each entry defines:
 *   - id:          stable identifier used in DB and diagnostic keys
 *   - name:        human-readable name
 *   - family:      grouping (search_engine | ai_bot | social | other)
 *   - userAgents:  token substrings used in User-Agent matching (lowercase)
 *   - robotsName:  the robots.txt agent name (for allow/disallow matching)
 *   - intentional: whether being blocked is a recognized intentional choice
 *     (e.g. blocking GPTBot is a valid configuration, not a problem)
 */

export type CrawlerFamily = 'search_engine' | 'ai_bot' | 'social' | 'other';

export interface CrawlerDefinition {
  id:          string;
  name:        string;
  family:      CrawlerFamily;
  /** Lowercase substrings that identify this crawler in a User-Agent string */
  userAgents:  string[];
  /** The robots.txt `User-agent:` name used by this crawler */
  robotsName:  string;
  /** Additional common alternative robots.txt names */
  robotsAliases?: string[];
  /** If true, operators commonly block this crawler intentionally */
  commonlyBlocked?: boolean;
  /** Informational URL for crawler docs */
  docsUrl?: string;
}

export const CRAWLER_REGISTRY: CrawlerDefinition[] = [
  // ── Search engines ──────────────────────────────────────────────────────────
  {
    id:         'googlebot',
    name:       'Googlebot',
    family:     'search_engine',
    userAgents: ['googlebot'],
    robotsName: 'Googlebot',
    robotsAliases: ['Googlebot-Image', 'Googlebot-Video', 'Googlebot-News'],
    docsUrl:    'https://developers.google.com/search/docs/crawling-indexing/googlebot',
  },
  {
    id:         'bingbot',
    name:       'Bingbot',
    family:     'search_engine',
    userAgents: ['bingbot'],
    robotsName: 'Bingbot',
    robotsAliases: ['msnbot'],
    docsUrl:    'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0',
  },
  {
    id:         'yandexbot',
    name:       'YandexBot',
    family:     'search_engine',
    userAgents: ['yandexbot'],
    robotsName: 'YandexBot',
    docsUrl:    'https://yandex.com/support/webmaster/robot-workings/intro.html',
  },
  {
    id:         'applebot',
    name:       'Applebot',
    family:     'search_engine',
    userAgents: ['applebot'],
    robotsName: 'Applebot',
    docsUrl:    'https://support.apple.com/en-us/111900',
  },
  {
    id:         'duckduckbot',
    name:       'DuckDuckBot',
    family:     'search_engine',
    userAgents: ['duckduckbot'],
    robotsName: 'DuckDuckBot',
    docsUrl:    'https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot/',
  },
  // ── AI bots ─────────────────────────────────────────────────────────────────
  {
    id:             'gptbot',
    name:           'GPTBot (OpenAI)',
    family:         'ai_bot',
    userAgents:     ['gptbot'],
    robotsName:     'GPTBot',
    commonlyBlocked: true,
    docsUrl:        'https://platform.openai.com/docs/gptbot',
  },
  {
    id:             'chatgpt-user',
    name:           'ChatGPT-User (OpenAI browsing)',
    family:         'ai_bot',
    userAgents:     ['chatgpt-user'],
    robotsName:     'ChatGPT-User',
    commonlyBlocked: true,
    docsUrl:        'https://platform.openai.com/docs/gptbot',
  },
  {
    id:         'claudebot',
    name:       'ClaudeBot (Anthropic)',
    family:     'ai_bot',
    userAgents: ['claudebot', 'claude-web'],
    robotsName: 'ClaudeBot',
    docsUrl:    'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id:             'perplexitybot',
    name:           'PerplexityBot',
    family:         'ai_bot',
    userAgents:     ['perplexitybot'],
    robotsName:     'PerplexityBot',
    commonlyBlocked: true,
    docsUrl:        'https://docs.perplexity.ai/docs/perplexitybot',
  },
  {
    id:             'ccbot',
    name:           'CCBot (Common Crawl)',
    family:         'ai_bot',
    userAgents:     ['ccbot'],
    robotsName:     'CCBot',
    commonlyBlocked: true,
    docsUrl:        'https://commoncrawl.org/ccbot',
  },
  {
    id:             'cohere-ai',
    name:           'Cohere AI Trainer',
    family:         'ai_bot',
    userAgents:     ['cohere-ai'],
    robotsName:     'cohere-ai',
    commonlyBlocked: true,
  },
  {
    id:             'google-extended',
    name:           'Google Extended (AI training)',
    family:         'ai_bot',
    userAgents:     ['google-extended'],
    robotsName:     'Google-Extended',
    commonlyBlocked: true,
    docsUrl:        'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
  },
  // ── Social ──────────────────────────────────────────────────────────────────
  {
    id:         'twitterbot',
    name:       'Twitterbot (X)',
    family:     'social',
    userAgents: ['twitterbot'],
    robotsName: 'Twitterbot',
  },
  {
    id:         'facebookexternalhit',
    name:       'Facebook External Hit',
    family:     'social',
    userAgents: ['facebookexternalhit'],
    robotsName: 'facebookexternalhit',
  },
  {
    id:         'linkedinbot',
    name:       'LinkedInBot',
    family:     'social',
    userAgents: ['linkedinbot'],
    robotsName: 'LinkedInBot',
  },
];

/** Fast lookup by ID */
export const CRAWLERS_BY_ID: Record<string, CrawlerDefinition> = Object.fromEntries(
  CRAWLER_REGISTRY.map((c) => [c.id, c]),
);

/** All crawler IDs */
export const ALL_CRAWLER_IDS = CRAWLER_REGISTRY.map((c) => c.id);

/** Search-engine crawlers only */
export const SEARCH_ENGINE_CRAWLERS = CRAWLER_REGISTRY.filter(
  (c) => c.family === 'search_engine',
);

/** AI training crawlers only */
export const AI_BOT_CRAWLERS = CRAWLER_REGISTRY.filter(
  (c) => c.family === 'ai_bot',
);

/**
 * Parse a robots.txt string and determine whether a specific crawler agent
 * is allowed to access a given path.
 *
 * Returns: 'allowed' | 'disallowed' | 'unknown'
 */
export function checkRobotsAccess(
  robotsTxt: string | null | undefined,
  crawlerDef: CrawlerDefinition,
  path: string,
): 'allowed' | 'disallowed' | 'unknown' {
  if (!robotsTxt) return 'unknown';
  const allAgents = [crawlerDef.robotsName, ...(crawlerDef.robotsAliases ?? [])].map(
    (a) => a.toLowerCase(),
  );

  const lines = robotsTxt.split('\n').map((l) => l.trim());

  // Build relevant rule blocks (matching agent or *)
  type Block = { specificity: number; rules: Array<{ allow: boolean; path: string }> };
  const blocks: Block[] = [];
  let current: Block | null = null;
  let inBlock = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('user-agent:')) {
      const agent = lower.replace('user-agent:', '').trim();
      const matched =
        agent === '*' ||
        allAgents.some((a) => a === agent);
      if (matched) {
        if (!current) {
          current = { specificity: agent === '*' ? 0 : 1, rules: [] };
          inBlock = true;
        }
      } else {
        if (current) { blocks.push(current); current = null; }
        inBlock = false;
      }
    } else if (inBlock && current) {
      if (lower.startsWith('disallow:')) {
        const p = line.replace(/^disallow:\s*/i, '');
        if (p) current.rules.push({ allow: false, path: p });
      } else if (lower.startsWith('allow:')) {
        const p = line.replace(/^allow:\s*/i, '');
        if (p) current.rules.push({ allow: true, path: p });
      } else if (line === '') {
        blocks.push(current);
        current = null;
        inBlock = false;
      }
    }
  }
  if (current) blocks.push(current);

  if (blocks.length === 0) return 'unknown';

  // Prefer the most specific block; within a block, longest match wins
  const best = [...blocks].sort((a, b) => b.specificity - a.specificity)[0];

  let bestMatchLen = -1;
  let bestAllow    = true; // default allow if no match

  for (const rule of best.rules) {
    if (path.startsWith(rule.path) && rule.path.length > bestMatchLen) {
      bestMatchLen = rule.path.length;
      bestAllow    = rule.allow;
    }
  }

  if (bestMatchLen === -1) {
    // Explicit Disallow: (empty) means allow all
    const hasEmptyDisallow = best.rules.some((r) => !r.allow && r.path === '');
    return hasEmptyDisallow ? 'allowed' : 'unknown';
  }

  return bestAllow ? 'allowed' : 'disallowed';
}
