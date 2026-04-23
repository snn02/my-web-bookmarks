import type { createItemRepository } from '../items/item-repository';
import type { createSettingsRepository } from '../settings/settings-repository';
import type { createSummaryRepository } from '../summaries/summary-repository';
import {
  createOpenRouterClient,
  OpenRouterRequestError,
  type OpenRouterErrorDetails
} from '../../integrations/openrouter/openrouter-client';

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-5-mini';
const METADATA_MAX_CHARS = 1200;
const SUMMARY_MAX_SENTENCES = 5;

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

    const model = settings.getPublicSettings().openRouter.model || DEFAULT_OPENROUTER_MODEL;
    const content = await completeWithOpenRouter(
      [
        {
          role: 'system',
          content:
            `Summarize a bookmarked web page for a personal reading inbox. Use only the provided metadata context. ` +
            `Do not invent missing facts. If context is insufficient, state that briefly. ` +
            `Write in Russian. Keep the response within ${SUMMARY_MAX_SENTENCES} sentences. Return only the summary text.`
        },
        {
          role: 'user',
          content: buildSummaryContextFromMetadata(item)
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

    const tagContext = item.summary?.content?.trim()
      ? buildTagContextFromSummary(item)
      : buildTagContextFromMetadata(item);

    const model = settings.getPublicSettings().openRouter.model || DEFAULT_OPENROUTER_MODEL;
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

function buildSummaryContextFromMetadata(
  item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>
): string {
  const baseLines = [
    `Title: ${sanitizeMetadata(item.title)}`,
    `URL: ${sanitizeMetadata(item.url)}`,
    `Domain: ${sanitizeMetadata(item.domain)}`
  ];

  const existingSummary = sanitizeMetadata(item.summary?.content ?? '');
  if (existingSummary) {
    baseLines.push('Existing summary context:');
    baseLines.push(existingSummary);
  }

  return baseLines.join('\n');
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
  item: NonNullable<ReturnType<ReturnType<typeof createItemRepository>['getItem']>>
): string {
  return [
    `Title: ${sanitizeMetadata(item.title)}`,
    `URL: ${sanitizeMetadata(item.url)}`,
    `Domain: ${sanitizeMetadata(item.domain)}`
  ].join('\n');
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
