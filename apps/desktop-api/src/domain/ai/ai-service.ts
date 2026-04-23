import type { createItemRepository } from '../items/item-repository';
import type { createSettingsRepository } from '../settings/settings-repository';
import type { createSummaryRepository } from '../summaries/summary-repository';
import {
  createOpenRouterClient,
  OpenRouterRequestError,
  type OpenRouterErrorDetails
} from '../../integrations/openrouter/openrouter-client';
import { DEFAULT_SUMMARY_PROMPT, DEFAULT_TAGS_PROMPT } from './ai-prompts';

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-5-mini';
const METADATA_MAX_CHARS = 1200;
const SIGNAL_FETCH_TIMEOUT_MS = 8_000;
const SIGNAL_MAX_HTML_BYTES = 350_000;

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

export interface TagSuggestion {
  name: string;
}

interface PageSignals {
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  keywords?: string;
  author?: string;
  publishedTime?: string;
  h1: string[];
  h2: string[];
}

interface ParsedMetaTag {
  attrs: Record<string, string>;
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

    const pageSignals = await fetchPageSignals(item.url, fetchImpl ?? fetch);
    const openRouterSettings = settings.getPublicSettings().openRouter;
    const model = openRouterSettings.model || DEFAULT_OPENROUTER_MODEL;
    const summaryPrompt = openRouterSettings.summaryPrompt || DEFAULT_SUMMARY_PROMPT;
    const content = await completeWithOpenRouter(
      [
        {
          role: 'system',
          content: summaryPrompt
        },
        {
          role: 'user',
          content: buildSummaryContextFromMetadata(item, pageSignals)
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

    const pageSignals = item.summary?.content?.trim()
      ? null
      : await fetchPageSignals(item.url, fetchImpl ?? fetch);

    const tagContext = item.summary?.content?.trim()
      ? buildTagContextFromSummary(item)
      : buildTagContextFromMetadata(item, pageSignals);

    const openRouterSettings = settings.getPublicSettings().openRouter;
    const model = openRouterSettings.model || DEFAULT_OPENROUTER_MODEL;
    const tagsPrompt = openRouterSettings.tagsPrompt || DEFAULT_TAGS_PROMPT;
    const content = await completeWithOpenRouter(
      [
        {
          role: 'system',
          content: tagsPrompt
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

function buildSummaryContextFromMetadata(
  item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>,
  pageSignals: PageSignals | null
): string {
  const lines = [
    `Title: ${sanitizeMetadata(item.title)}`,
    `URL: ${sanitizeMetadata(item.url)}`,
    `Domain: ${sanitizeMetadata(item.domain)}`
  ];

  const existingSummary = sanitizeMetadata(item.summary?.content ?? '');
  if (existingSummary) {
    lines.push('Existing summary context:');
    lines.push(existingSummary);
  }

  appendSignalLines(lines, pageSignals);
  return lines.join('\n');
}

function buildTagContextFromSummary(
  item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>
): string {
  return [
    `Title: ${sanitizeMetadata(item.title)}`,
    `URL: ${sanitizeMetadata(item.url)}`,
    `Domain: ${sanitizeMetadata(item.domain)}`,
    'Summary context:',
    sanitizeMetadata(item.summary?.content ?? '')
  ].join('\n');
}

function buildTagContextFromMetadata(
  item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>,
  pageSignals: PageSignals | null
): string {
  const lines = [
    `Title: ${sanitizeMetadata(item.title)}`,
    `URL: ${sanitizeMetadata(item.url)}`,
    `Domain: ${sanitizeMetadata(item.domain)}`
  ];

  appendSignalLines(lines, pageSignals);
  return lines.join('\n');
}

function appendSignalLines(lines: string[], signals: PageSignals | null): void {
  if (!signals) {
    return;
  }

  const metaDescription = sanitizeMetadata(signals.metaDescription ?? '');
  if (metaDescription) {
    lines.push(`Meta description: ${metaDescription}`);
  }

  const ogTitle = sanitizeMetadata(signals.ogTitle ?? '');
  if (ogTitle) {
    lines.push(`OG title: ${ogTitle}`);
  }

  const ogDescription = sanitizeMetadata(signals.ogDescription ?? '');
  if (ogDescription) {
    lines.push(`OG description: ${ogDescription}`);
  }

  const keywords = sanitizeMetadata(signals.keywords ?? '');
  if (keywords) {
    lines.push(`Keywords: ${keywords}`);
  }

  const author = sanitizeMetadata(signals.author ?? '');
  if (author) {
    lines.push(`Author: ${author}`);
  }

  const publishedTime = sanitizeMetadata(signals.publishedTime ?? '');
  if (publishedTime) {
    lines.push(`Published time: ${publishedTime}`);
  }

  if (signals.h1.length > 0) {
    lines.push(`H1 headings: ${signals.h1.map(sanitizeMetadata).filter(Boolean).join(' | ')}`);
  }

  if (signals.h2.length > 0) {
    lines.push(`H2 headings: ${signals.h2.map(sanitizeMetadata).filter(Boolean).join(' | ')}`);
  }
}

async function fetchPageSignals(url: string, fetchImpl: typeof fetch): Promise<PageSignals | null> {
  const parsed = safeParseHttpUrl(url);
  if (!parsed) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SIGNAL_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(parsed.toString(), {
      method: 'GET',
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.includes('html')) {
      return null;
    }

    const html = await readResponseTextWithLimit(response, SIGNAL_MAX_HTML_BYTES);
    return extractSignalsFromHtml(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function safeParseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const headerLength = response.headers.get('content-length');
  if (headerLength) {
    const declared = Number.parseInt(headerLength, 10);
    if (!Number.isNaN(declared) && declared > maxBytes) {
      throw new Error('response_too_large');
    }
  }

  if (!response.body) {
    const fallbackText = await response.text();
    if (Buffer.byteLength(fallbackText, 'utf8') > maxBytes) {
      throw new Error('response_too_large');
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
        throw new Error('response_too_large');
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

function extractSignalsFromHtml(html: string): PageSignals {
  const metaTags = parseMetaTags(html);

  return {
    metaDescription: getMetaSignal(metaTags, ['description']),
    ogTitle: getMetaSignal(metaTags, ['og:title']),
    ogDescription: getMetaSignal(metaTags, ['og:description']),
    keywords: getMetaSignal(metaTags, ['keywords']),
    author: getMetaSignal(metaTags, ['author']),
    publishedTime: getMetaSignal(metaTags, [
      'article:published_time',
      'og:published_time',
      'published_time',
      'pubdate',
      'date'
    ]),
    h1: extractHeadingTexts(html, 'h1', 3),
    h2: extractHeadingTexts(html, 'h2', 10)
  };
}

function parseMetaTags(html: string): ParsedMetaTag[] {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return tags.map((tag) => ({ attrs: parseAttributes(tag) }));
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z_:.\-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(regex)) {
    const key = (match[1] ?? '').toLowerCase();
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (key) {
      attrs[key] = decodeHtmlEntities(value);
    }
  }
  return attrs;
}

function getMetaSignal(metaTags: ParsedMetaTag[], keys: string[]): string | undefined {
  const searchKeys = new Set(keys.map((key) => key.toLowerCase()));

  for (const tag of metaTags) {
    const name = (tag.attrs.name ?? '').toLowerCase();
    const property = (tag.attrs.property ?? '').toLowerCase();
    if (!searchKeys.has(name) && !searchKeys.has(property)) {
      continue;
    }

    const content = sanitizeMetadata(tag.attrs.content ?? '');
    if (content) {
      return content;
    }
  }

  return undefined;
}

function extractHeadingTexts(html: string, tagName: 'h1' | 'h2', maxItems: number): string[] {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const result: string[] = [];

  for (const match of html.matchAll(regex)) {
    const text = stripHtmlTags(match[1] ?? '');
    const normalized = sanitizeMetadata(decodeHtmlEntities(text));
    if (!normalized) {
      continue;
    }

    if (!result.includes(normalized)) {
      result.push(normalized);
    }

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isNaN(code) ? _ : String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (_, num: string) => {
      const code = Number.parseInt(num, 10);
      return Number.isNaN(code) ? _ : String.fromCodePoint(code);
    });
}

function sanitizeMetadata(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, METADATA_MAX_CHARS);
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
