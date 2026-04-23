export interface OpenRouterModelProfile {
  id: string;
  priority: number;
  summaryRating: number;
  tagsRating: number;
}

export const OPENROUTER_MODEL_PROFILES: OpenRouterModelProfile[] = [
  { id: 'google/gemma-4-31b-it:free', priority: 1, summaryRating: 5, tagsRating: 5 },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', priority: 2, summaryRating: 5, tagsRating: 5 },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', priority: 3, summaryRating: 5, tagsRating: 5 },
  { id: 'inclusionai/ling-2.6-flash:free', priority: 4, summaryRating: 4, tagsRating: 5 },
  { id: 'google/gemma-4-26b-a4b-it:free', priority: 5, summaryRating: 5, tagsRating: 4 },
  { id: 'minimax/minimax-m2.5:free', priority: 6, summaryRating: 4, tagsRating: 4 },
  { id: 'google/gemma-3-27b-it:free', priority: 7, summaryRating: 4, tagsRating: 4 },
  { id: 'openai/gpt-oss-120b:free', priority: 8, summaryRating: 4, tagsRating: 3 },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', priority: 9, summaryRating: 4, tagsRating: 3 },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', priority: 10, summaryRating: 4, tagsRating: 3 }
];

function sortProfiles(
  profiles: OpenRouterModelProfile[],
  key: 'summaryRating' | 'tagsRating'
): OpenRouterModelProfile[] {
  return [...profiles].sort((left, right) => {
    const ratingDiff = right[key] - left[key];
    if (ratingDiff !== 0) {
      return ratingDiff;
    }

    const priorityDiff = left.priority - right.priority;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

export function getSortedSummaryModelProfiles(): OpenRouterModelProfile[] {
  return sortProfiles(OPENROUTER_MODEL_PROFILES, 'summaryRating');
}

export function getSortedTagModelProfiles(): OpenRouterModelProfile[] {
  return sortProfiles(OPENROUTER_MODEL_PROFILES, 'tagsRating');
}

export function getDefaultSummaryModelId(): string {
  return getSortedSummaryModelProfiles()[0]?.id ?? 'google/gemma-4-31b-it:free';
}

export function getDefaultTagModelId(): string {
  return getSortedTagModelProfiles()[0]?.id ?? 'google/gemma-4-31b-it:free';
}
