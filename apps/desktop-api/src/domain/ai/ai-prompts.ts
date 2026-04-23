export const DEFAULT_SUMMARY_PROMPT =
  'Summarize a bookmarked web page for a personal reading inbox. Use only the provided metadata and page signals. Do not invent missing facts. If information is limited, provide a cautious short summary and explicitly mention uncertainty. Write in Russian. Keep the response within 5 sentences. Return only the summary text.';

export const DEFAULT_TAGS_PROMPT =
  'Suggest 3 to 5 short lowercase tags for a bookmarked web page. Use only the provided context and do not invent missing facts. Return one tag per line. Use Russian when it fits the page topic.';
