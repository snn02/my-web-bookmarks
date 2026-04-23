import type { createItemRepository } from '../items/item-repository';
import type { createSettingsRepository } from '../settings/settings-repository';
import type { createSummaryRepository } from '../summaries/summary-repository';
import {
  createOpenRouterClient,
  OpenRouterRequestError,
  type OpenRouterErrorDetails
} from '../../integrations/openrouter/openrouter-client';

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-5-mini';

export interface AiServiceDependencies {
  fetchImpl?: typeof fetch;
  items: ReturnType<typeof createItemRepository>;
  settings: ReturnType<typeof createSettingsRepository>;
  summaries: ReturnType<typeof createSummaryRepository>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('OpenRouter is not configured.');
  }
}

export class AiUpstreamError extends Error {
  public readonly details?: OpenRouterErrorDetails;

  constructor(details?: OpenRouterErrorDetails) {
    super('OpenRouter request failed.');
    this.details = details;
  }
}

export class ContentUnavailableError extends Error {
  constructor() {
    super('Page content is unavailable for AI processing.');
  }
}

export interface TagSuggestion {
  name: string;
}

export function createAiService({ fetchImpl, items, settings, summaries }: AiServiceDependencies) {
  async function generateSummary(itemId: string) {
    const item = items.getItem(itemId);
    if (!item) {
      return null;
    }

    if (!settings.getOpenRouterApiKey()) {
      throw new AiNotConfiguredError();
    }

    const extractedContent = await extractPageContent(item.url, fetchImpl ?? fetch);
    const model = settings.getPublicSettings().openRouter.model ?? DEFAULT_OPENROUTER_MODEL;
    const content = await completeWithOpenRouter([
      {
        role: 'system',
        content:
          'Summarize a bookmarked web page for a personal reading inbox. Use only the provided extracted content. Do not invent missing facts. If content is insufficient, state that briefly. Write the summary in Russian. Return only the summary text.'
      },
      {
        role: 'user',
        content: buildSummaryContext(item, extractedContent)
      }
    ]);

    return summaries.upsertSummary(item.id, content, model, 'openrouter', 'ai');
  }

  async function suggestTags(itemId: string): Promise<TagSuggestion[] | null> {
    const item = items.getItem(itemId);
    if (!item) {
      return null;
    }

    if (!settings.getOpenRouterApiKey()) {
      throw new AiNotConfiguredError();
    }

    const tagContext =
      item.summary?.content?.trim()
        ? buildTagContextFromSummary(item)
        : buildTagContextFromExtractedContent(item, await extractPageContent(item.url, fetchImpl ?? fetch));

    const content = await completeWithOpenRouter([
      {
        role: 'system',
        content:
          'Suggest 3 to 5 short lowercase tags for a bookmarked web page. Return one tag per line. Use Russian when it fits the page topic.'
      },
      {
        role: 'user',
        content: tagContext
      }
    ]);

    return parseTagSuggestions(content);
  }

  async function completeWithOpenRouter(messages: Parameters<ReturnType<typeof createOpenRouterClient>['complete']>[0]) {
    const apiKey = settings.getOpenRouterApiKey();
    if (!apiKey) {
      throw new AiNotConfiguredError();
    }

    const model = settings.getPublicSettings().openRouter.model ?? DEFAULT_OPENROUTER_MODEL;
    const client = createOpenRouterClient({ apiKey, fetchImpl, model });
    try {
      return await client.complete(messages);
    } catch (error) {
      if (error instanceof OpenRouterRequestError) {
        throw new AiUpstreamError(error.details);
      }
      throw error;
    }
  }

  return {
    generateSummary,
    suggestTags
  };
}

function buildItemContext(item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>): string {
  return [
    `Title: ${item.title}`,
    `URL: ${item.url}`,
    `Domain: ${item.domain}`,
    `Current summary: ${item.summary?.content ?? 'none'}`
  ].join('\n');
}

function buildSummaryContext(
  item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>,
  extractedContent: string
): string {
  return [
    `Title: ${item.title}`,
    `URL: ${item.url}`,
    `Domain: ${item.domain}`,
    'Extracted content (authoritative source):',
    '"""',
    extractedContent,
    '"""'
  ].join('\n');
}

function buildTagContextFromSummary(
  item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>
): string {
  return [
    `Title: ${item.title}`,
    `URL: ${item.url}`,
    `Domain: ${item.domain}`,
    'Summary context:',
    item.summary?.content ?? ''
  ].join('\n');
}

function buildTagContextFromExtractedContent(
  item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>,
  extractedContent: string
): string {
  return [
    `Title: ${item.title}`,
    `URL: ${item.url}`,
    `Domain: ${item.domain}`,
    'Extracted content context:',
    extractedContent
  ].join('\n');
}

async function extractPageContent(url: string, fetchImpl: typeof fetch): Promise<string> {
  const parsed = safeParseUrl(url);
  if (!parsed || !isAllowedProtocol(parsed.protocol) || isBlockedHostname(parsed.hostname)) {
    throw new ContentUnavailableError();
  }

  let response: Response;
  try {
    response = await fetchImpl(parsed.toString(), {
      method: 'GET',
      redirect: 'follow'
    });
  } catch {
    throw new ContentUnavailableError();
  }

  if (!response.ok) {
    throw new ContentUnavailableError();
  }

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  const normalized = preprocessExtractedContent(
    contentType.includes('html') ? extractTextFromHtml(raw) : raw
  );
  if (!normalized) {
    throw new ContentUnavailableError();
  }
  return normalized;
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAllowedProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '::1') {
    return true;
  }

  if (host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')) {
    return true;
  }

  const private172 = /^172\.(1[6-9]|2\d|3[0-1])\./;
  return private172.test(host);
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function preprocessExtractedContent(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.slice(0, 12000);
}

function parseTagSuggestions(content: string): TagSuggestion[] {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((value): value is string => typeof value === 'string')
        .map((name) => ({ name: name.trim().toLowerCase() }))
        .filter((suggestion) => suggestion.name.length > 0)
        .slice(0, 5);
    }
  } catch {
    // Fall back to comma/newline parsing for less strict model output.
  }

  return content
    .split(/[,\n]/)
    .map((name) => ({ name: name.trim().toLowerCase() }))
    .filter((suggestion) => suggestion.name.length > 0)
    .slice(0, 5);
}
