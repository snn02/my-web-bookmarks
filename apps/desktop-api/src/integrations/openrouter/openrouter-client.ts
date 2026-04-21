export interface OpenRouterClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  model: string;
}

export interface OpenRouterMessage {
  content: string;
  role: 'system' | 'user';
}

interface OpenRouterChoice {
  message?: {
    content?: unknown;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
}

export class OpenRouterRequestError extends Error {
  constructor() {
    super('OpenRouter request failed.');
  }
}

export function createOpenRouterClient({
  apiKey,
  fetchImpl = fetch,
  model
}: OpenRouterClientOptions) {
  async function complete(messages: OpenRouterMessage[]): Promise<string> {
    const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      body: JSON.stringify({
        messages,
        model
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST'
    });

    if (!response.ok) {
      throw new OpenRouterRequestError();
    }

    const body = (await response.json()) as OpenRouterResponse;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new OpenRouterRequestError();
    }

    return content.trim();
  }

  return {
    complete
  };
}
