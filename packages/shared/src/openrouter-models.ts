export interface OpenRouterModelProfile {
  id: string;
  priority: number;
  rating: number;
}

export const OPENROUTER_MODEL_PROFILES: OpenRouterModelProfile[] = [
  { id: 'google/gemma-4-31b-it:free', priority: 1, rating: 5 },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', priority: 2, rating: 5 },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', priority: 3, rating: 5 },
  { id: 'inclusionai/ling-2.6-flash:free', priority: 4, rating: 5 },
  { id: 'google/gemma-4-26b-a4b-it:free', priority: 5, rating: 5 },
  { id: 'minimax/minimax-m2.5:free', priority: 6, rating: 4 },
  { id: 'google/gemma-3-27b-it:free', priority: 7, rating: 4 },
  { id: 'openai/gpt-oss-120b:free', priority: 8, rating: 4 },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', priority: 9, rating: 4 },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', priority: 10, rating: 4 }
];

function sortProfiles(profiles: OpenRouterModelProfile[]): OpenRouterModelProfile[] {
  return [...profiles].sort((left, right) => {
    const ratingDiff = right.rating - left.rating;
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

export function getSortedModelProfiles(): OpenRouterModelProfile[] {
  return sortProfiles(OPENROUTER_MODEL_PROFILES);
}

export function getDefaultModelId(): string {
  return getSortedModelProfiles()[0]?.id ?? 'google/gemma-4-31b-it:free';
}
