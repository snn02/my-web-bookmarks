export interface OpenRouterClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  model: string;
}

export interface OpenRouterMessage {
  content: string;
  role: 'system' | 'user';
}

export interface OpenRouterErrorDetails {
  contentType?: string;
  reason: 'empty_content' | 'invalid_json' | 'network_error' | 'non_ok_response';
  status?: number;
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
  public readonly details: OpenRouterErrorDetails;

  constructor(details: OpenRouterErrorDetails) {
    super('OpenRouter request failed.');
    this.details = details;
  }
}

export function createOpenRouterClient({
  apiKey,
  fetchImpl = fetch,
  model
}: OpenRouterClientOptions) {
  async function complete(messages: OpenRouterMessage[]): Promise<string> {
    let response: Response;
    try {
      response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
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
    } catch {
      throw new OpenRouterRequestError({ reason: 'network_error' });
    }

    if (!response.ok) {
      throw new OpenRouterRequestError({
        contentType: response.headers.get('content-type') ?? undefined,
        reason: 'non_ok_response',
        status: response.status
      });
    }

    let body: OpenRouterResponse;
    try {
      body = (await response.json()) as OpenRouterResponse;
    } catch {
      throw new OpenRouterRequestError({
        contentType: response.headers.get('content-type') ?? undefined,
        reason: 'invalid_json',
        status: response.status
      });
    }
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new OpenRouterRequestError({
        contentType: response.headers.get('content-type') ?? undefined,
        reason: 'empty_content',
        status: response.status
      });
    }

    return content.trim();
  }

  return {
    complete
  };
}
