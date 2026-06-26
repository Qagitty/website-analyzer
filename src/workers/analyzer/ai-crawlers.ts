import type { AiCrawlerCategory } from '../../types/llm-readiness';

export const AI_CRAWLER_CONFIG_VERSION = '2025-06-25';

export interface AiCrawlerDefinition {
  name: string;
  userAgent: string;
  category: AiCrawlerCategory;
  description: string;
  provider: string;
}

// Versioned registry of known AI-related crawlers.
// Crawler names and behaviors change over time. This list reflects the
// configured user-agent list at the time of the audit.
// Access status does not guarantee use, indexing, or inclusion by any provider.
export const AI_CRAWLERS: AiCrawlerDefinition[] = [
  { name: 'GPTBot',              userAgent: 'GPTBot',              category: 'model-training',   provider: 'OpenAI',        description: 'OpenAI model training crawler' },
  { name: 'ChatGPT-User',        userAgent: 'ChatGPT-User',        category: 'user-browsing',    provider: 'OpenAI',        description: 'ChatGPT browsing agent' },
  { name: 'OAI-SearchBot',       userAgent: 'OAI-SearchBot',       category: 'search-retrieval', provider: 'OpenAI',        description: 'OpenAI search and retrieval bot' },
  { name: 'ClaudeBot',           userAgent: 'ClaudeBot',           category: 'model-training',   provider: 'Anthropic',     description: 'Anthropic model training crawler' },
  { name: 'Claude-Web',          userAgent: 'Claude-Web',          category: 'user-browsing',    provider: 'Anthropic',     description: 'Anthropic Claude web access agent' },
  { name: 'anthropic-ai',        userAgent: 'anthropic-ai',        category: 'model-training',   provider: 'Anthropic',     description: 'Anthropic AI crawler' },
  { name: 'PerplexityBot',       userAgent: 'PerplexityBot',       category: 'search-retrieval', provider: 'Perplexity',    description: 'Perplexity AI search crawler' },
  { name: 'cohere-ai',           userAgent: 'cohere-ai',           category: 'model-training',   provider: 'Cohere',        description: 'Cohere AI training crawler' },
  { name: 'meta-externalagent',  userAgent: 'meta-externalagent',  category: 'model-training',   provider: 'Meta',          description: 'Meta external AI agent' },
  { name: 'Applebot-Extended',   userAgent: 'Applebot-Extended',   category: 'model-training',   provider: 'Apple',         description: 'Apple Intelligence training crawler' },
  { name: 'YouBot',              userAgent: 'YouBot',              category: 'search-retrieval', provider: 'You.com',       description: 'You.com search crawler' },
  { name: 'CCBot',               userAgent: 'CCBot',               category: 'model-training',   provider: 'Common Crawl',  description: 'Common Crawl bot (used in LLM training datasets)' },
  { name: 'Bytespider',          userAgent: 'Bytespider',          category: 'model-training',   provider: 'ByteDance',     description: 'ByteDance AI training crawler' },
  { name: 'Diffbot',             userAgent: 'Diffbot',             category: 'general-indexing', provider: 'Diffbot',       description: 'Diffbot knowledge graph crawler' },
];

export interface ParsedRobotsGroup {
  userAgents: string[];
  rules: Array<{ type: 'allow' | 'disallow'; path: string }>;
}

export function parseRobotsTxt(text: string): ParsedRobotsGroup[] {
  const groups: ParsedRobotsGroup[] = [];
  let current: ParsedRobotsGroup | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) {
      if (current) { groups.push(current); current = null; }
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { userAgents: [], rules: [] };
      }
      current.userAgents.push(value.toLowerCase());
    } else if (field === 'allow' && current) {
      current.rules.push({ type: 'allow', path: value });
    } else if (field === 'disallow' && current) {
      current.rules.push({ type: 'disallow', path: value });
    }
  }
  if (current) groups.push(current);
  return groups;
}

export function checkRobotsAccess(
  groups: ParsedRobotsGroup[],
  userAgent: string,
  path: string,
): { allowed: boolean; matchedGroup: string; matchedRule: string | null } {
  const uaLower = userAgent.toLowerCase();

  // Find the most specific matching group (exact match beats wildcard)
  const exactGroup = groups.find(g => g.userAgents.includes(uaLower));
  const wildcardGroup = groups.find(g => g.userAgents.includes('*'));
  const matchedGroup = exactGroup ?? wildcardGroup ?? null;

  if (!matchedGroup) {
    return { allowed: true, matchedGroup: '*', matchedRule: null };
  }

  const groupLabel = matchedGroup.userAgents.join(', ');

  // Find the longest matching rule for the given path
  let bestRule: { type: 'allow' | 'disallow'; path: string } | null = null;
  let bestLength = -1;

  for (const rule of matchedGroup.rules) {
    if (!rule.path) {
      // Disallow: (empty) means allow all
      if (rule.type === 'disallow' && bestLength < 0) {
        bestRule = null;
        bestLength = 0;
      }
      continue;
    }
    if (path.startsWith(rule.path) && rule.path.length > bestLength) {
      bestRule = rule;
      bestLength = rule.path.length;
    }
  }

  if (!bestRule) return { allowed: true, matchedGroup: groupLabel, matchedRule: null };
  return {
    allowed: bestRule.type === 'allow',
    matchedGroup: groupLabel,
    matchedRule: `${bestRule.type === 'allow' ? 'Allow' : 'Disallow'}: ${bestRule.path}`,
  };
}
