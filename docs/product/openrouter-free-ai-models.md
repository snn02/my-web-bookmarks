# OpenRouter Free AI Model Priority List

This list ranks free OpenRouter models for V1 AI features:

- article summary generation
- article tag suggestions

Ratings are subjective applicability scores from 1 to 5, where 5 is the strongest overall fit for shared summary + tags usage.

| Priority | Model | Shared rating |
|---:|---|---:|
| 1 | `google/gemma-4-31b-it:free` | 5 |
| 2 | `qwen/qwen3-next-80b-a3b-instruct:free` | 5 |
| 3 | `nvidia/nemotron-3-super-120b-a12b:free` | 5 |
| 4 | `inclusionai/ling-2.6-flash:free` | 5 |
| 5 | `google/gemma-4-26b-a4b-it:free` | 5 |
| 6 | `minimax/minimax-m2.5:free` | 4 |
| 7 | `google/gemma-3-27b-it:free` | 4 |
| 8 | `openai/gpt-oss-120b:free` | 4 |
| 9 | `meta-llama/llama-3.3-70b-instruct:free` | 4 |
| 10 | `nousresearch/hermes-3-llama-3.1-405b:free` | 4 |

Recommended default model:

```text
google/gemma-4-31b-it:free
```

Recommended fallback order:

```text
qwen/qwen3-next-80b-a3b-instruct:free
nvidia/nemotron-3-super-120b-a12b:free
inclusionai/ling-2.6-flash:free
```

Notes:

- Prefer models with `response_format` or structured output support for tag suggestions.
- Free OpenRouter model availability and rate limits can change, so the application should keep the model configurable.
- If a configured model fails upstream, the backend can retry with the next fallback model before returning an AI error.
