import type { createItemRepository } from '../items/item-repository';
import type { createSettingsRepository } from '../settings/settings-repository';
import type { createSummaryRepository } from '../summaries/summary-repository';
import { createOpenRouterClient, OpenRouterRequestError } from '../../integrations/openrouter/openrouter-client';

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
  constructor() {
    super('OpenRouter request failed.');
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

    const model = settings.getPublicSettings().openRouter.model ?? DEFAULT_OPENROUTER_MODEL;
    const content = await completeWithOpenRouter([
      {
        role: 'system',
        content:
          'Summarize a bookmarked web page for a personal reading inbox. Return only the summary text.'
      },
      {
        role: 'user',
        content: buildItemContext(item)
      }
    ]);

    return summaries.upsertSummary(item.id, content, model, 'openrouter', 'ai');
  }

  async function suggestTags(itemId: string): Promise<TagSuggestion[] | null> {
    const item = items.getItem(itemId);
    if (!item) {
      return null;
    }

    const content = await completeWithOpenRouter([
      {
        role: 'system',
        content:
          'Suggest 3 to 5 short lowercase tags for a bookmarked web page. Return a JSON array of strings only.'
      },
      {
        role: 'user',
        content: buildItemContext(item)
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
        throw new AiUpstreamError();
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
