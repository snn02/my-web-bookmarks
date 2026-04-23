import type { createItemRepository } from '../items/item-repository';
import type { createSettingsRepository } from '../settings/settings-repository';
import type { createSummaryRepository } from '../summaries/summary-repository';
import { isIP } from 'node:net';
import {
  createOpenRouterClient,
  OpenRouterRequestError,
  type OpenRouterErrorDetails
} from '../../integrations/openrouter/openrouter-client';

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-5-mini';
const EXTRACTION_TIMEOUT_MS = 15_000;
const EXTRACTION_MAX_BYTES = 1_500_000;
const EXTRACTION_MAX_REDIRECTS = 5;

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

export function createAiService({
  fetchImpl,
  items,
  settings,
  summaries
}: AiServiceDependencies) {
  async function generateSummary(itemId: string) {
    const item = items.getItem(itemId);
    if (!item) {
      return null;
    }

    if (!settings.getOpenRouterApiKey()) {
      throw new AiNotConfiguredError();
    }

    const extractedContent = await extractPageContent(item.url, fetchImpl ?? fetch);
    const model =
      settings.getPublicSettings().openRouter.summaryModel || DEFAULT_OPENROUTER_MODEL;
    const content = await completeWithOpenRouter(
      [
      {
        role: 'system',
        content:
          'Summarize a bookmarked web page for a personal reading inbox. Use only the provided extracted content. Do not invent missing facts. If content is insufficient, state that briefly. Write the summary in Russian. Return only the summary text.'
      },
      {
        role: 'user',
        content: buildSummaryContext(item, extractedContent)
      }
      ],
      model
    );

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
        : buildTagContextFromExtractedContent(
            item,
            await extractPageContent(item.url, fetchImpl ?? fetch)
          );

    const model = settings.getPublicSettings().openRouter.tagsModel || DEFAULT_OPENROUTER_MODEL;
    const content = await completeWithOpenRouter(
      [
      {
        role: 'system',
        content:
          'Suggest 3 to 5 short lowercase tags for a bookmarked web page. Use only the provided context and do not invent missing facts. Return one tag per line. Use Russian when it fits the page topic.'
      },
      {
        role: 'user',
        content: tagContext
      }
      ],
      model
    );

    return parseTagSuggestions(content);
  }

  async function completeWithOpenRouter(
    messages: Parameters<ReturnType<typeof createOpenRouterClient>['complete']>[0],
    model: string
  ) {
    const apiKey = settings.getOpenRouterApiKey();
    if (!apiKey) {
      throw new AiNotConfiguredError();
    }

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

async function extractPageContent(
  url: string,
  fetchImpl: typeof fetch
): Promise<string> {
  return extractPageContentWithRedirects({
    fetchImpl,
    redirectCount: 0,
    url
  });
}

async function extractPageContentWithRedirects({
  fetchImpl,
  redirectCount,
  url
}: {
  fetchImpl: typeof fetch;
  redirectCount: number;
  url: string;
}): Promise<string> {
  if (redirectCount > EXTRACTION_MAX_REDIRECTS) {
    throw new ContentUnavailableError();
  }

  const parsed = safeParseUrl(url);
  if (!parsed || !isAllowedProtocol(parsed.protocol) || isBlockedHost(parsed.hostname)) {
    throw new ContentUnavailableError();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(parsed.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal
    });
  } catch {
    clearTimeout(timeoutId);
    throw new ContentUnavailableError();
  } finally {
    clearTimeout(timeoutId);
  }

  if (isRedirectStatus(response.status)) {
    const location = response.headers.get('location');
    if (!location) {
      throw new ContentUnavailableError();
    }

    const nextUrl = safeResolveRedirectUrl(parsed, location);
    if (!nextUrl) {
      throw new ContentUnavailableError();
    }

    return extractPageContentWithRedirects({
      fetchImpl,
      redirectCount: redirectCount + 1,
      url: nextUrl
    });
  }

  if (!response.ok) {
    throw new ContentUnavailableError();
  }

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await readResponseTextWithLimit(response, EXTRACTION_MAX_BYTES);
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

function isBlockedHost(hostname: string): boolean {
  if (isBlockedHostnameLiteral(hostname)) {
    return true;
  }

  if (isIP(hostname) > 0) {
    return isBlockedIpAddress(hostname);
  }

  return false;
}

function isBlockedHostnameLiteral(hostname: string): boolean {
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

function isBlockedIpAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  const ipType = isIP(normalized);
  if (ipType === 4) {
    return (
      normalized.startsWith('127.') ||
      normalized.startsWith('10.') ||
      normalized.startsWith('192.168.') ||
      normalized.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    );
  }

  if (ipType === 6) {
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    );
  }

  return false;
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function safeResolveRedirectUrl(current: URL, location: string): string | null {
  try {
    return new URL(location, current).toString();
  } catch {
    return null;
  }
}

async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const headerLength = response.headers.get('content-length');
  if (headerLength) {
    const declared = Number.parseInt(headerLength, 10);
    if (!Number.isNaN(declared) && declared > maxBytes) {
      throw new ContentUnavailableError();
    }
  }

  if (!response.body) {
    const fallbackText = await response.text();
    if (Buffer.byteLength(fallbackText, 'utf8') > maxBytes) {
      throw new ContentUnavailableError();
    }
    return fallbackText;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new ContentUnavailableError();
      }
      chunks.push(value);
    }
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
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
