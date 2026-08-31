# Configuration reference

Every environment variable the server reads. One secret is required (an LLM
key); everything else has a working default — no database, no accounts.

| Variable | Default | What it does |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | Which provider builds activities: `anthropic`, `openai`, `bedrock`, or `openrouter` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` | — | The key for the chosen provider |
| `AWS_REGION`, `AWS_BEARER_TOKEN_BEDROCK` | `us-west-2`, — | Bedrock configuration when `LLM_PROVIDER=bedrock` |
| `OPENAI_FALLBACK_API_KEY`, `OPENAI_FALLBACK_MODEL_ID` | —, `gpt-4o-mini` | Optional second provider used when the primary fails |
| `OPENROUTER_EMBED_MODEL_ID` / `BEDROCK_EMBED_MODEL_ID` | `openai/text-embedding-3-small` / `amazon.titan-embed-text-v2:0` | Embedding model for semantic activity discovery. Discovery ranks semantically when the provider can embed (OpenRouter, Bedrock, or an armed OpenAI fallback key) and falls back to lexical ranking otherwise — the result says which ran |
| `STANDARDS_SOURCE` | `learning-commons` | Which standards graph verifies codes; `example` is the built-in keyless source |
| `LEARNING_COMMONS_API_KEY`, `LEARNING_COMMONS_MCP_URL` | — | Credentials for the default standards source |
| `STORAGE_ADAPTER` | auto | `memory` (nothing persists across restarts) or `supabase`; unset picks Supabase only when its vars are configured |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | — | Only when using the Supabase adapter; `pnpm db:start` runs a local stack |
| `SEED_DEMO_ROSTER` | off | Seeds demo students in the reference app |

Two operational notes:

- Model calls run under **your** keys, inside **your** deployment — scoring
  a student's work never leaves the instance you control.
- **Public instances:** anyone who has your URL can spend your LLM budget.
  Keep instances private until token auth (`MCP_ACCESS_TOKEN`, planned for
  v0.1) lands, or put your own gateway in front.
