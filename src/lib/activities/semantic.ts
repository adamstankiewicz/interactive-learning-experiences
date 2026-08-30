import { embedMany } from 'ai';

/**
 * Semantic ranking for discovery — the proper IR answer, in this repo's
 * idiom: embeddings + cosine, provider-resolved like every other model
 * call, cached where the corpus is static, and *honestly absent* when the
 * deployment has no embedding-capable provider (the result says which
 * ranking ran; nothing pretends).
 *
 * Two design facts shape this file:
 *
 * - The corpus is tiny and static — one planner description per registry
 *   kind — so registry-side vectors are computed once per process and
 *   memoized by exact text. Only the caller's `need` is embedded per query:
 *   one small request, comparable to the standards-graph lookup discovery
 *   already makes.
 * - Anthropic ships no embeddings endpoint, so the default deployment falls
 *   back to lexical ranking. Embeddings light up from an armed OpenAI
 *   fallback key (already the repo's emergency-exit pattern), an OpenRouter
 *   deployment, or a Bedrock deployment.
 */

export type Embedder = (texts: string[]) => Promise<number[][]>;

/**
 * Intent anchors, compared against the need by cosine — replacing keyword
 * lists entirely. A need closer to the assess anchor than the explore
 * anchor boosts kinds whose registry entry actually measures (`assesses`);
 * the anchor text says what the boost means, in words a reader can argue
 * with.
 */
export const ASSESS_ANCHOR = 'check, quiz, or assess what the student has learned';
export const EXPLORE_ANCHOR = 'introduce, explain, or explore a new idea';

/** How much measured-ness matters when the need sounds like assessment — in cosine units, deliberately a nudge, not a veto. */
const ASSESS_BOOST = 0.08;

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

export function getEmbedder(): Embedder | null {
  const openAiKey = process.env.OPENAI_FALLBACK_API_KEY;
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();

  if (openAiKey) {
    return async (texts) => {
      const { createOpenAI } = await import('@ai-sdk/openai');
      const openai = createOpenAI({ apiKey: openAiKey });
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: texts,
      });
      return embeddings;
    };
  }

  if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    return async (texts) => {
      const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
      const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
      const { embeddings } = await embedMany({
        model: openrouter.embedding(process.env.OPENROUTER_EMBED_MODEL_ID ?? 'openai/text-embedding-3-small'),
        values: texts,
      });
      return embeddings;
    };
  }

  if (provider === 'bedrock') {
    return async (texts) => {
      const { createAmazonBedrock } = await import('@ai-sdk/amazon-bedrock');
      const bedrock = createAmazonBedrock({
        region: process.env.AWS_REGION ?? 'us-west-2',
        ...(process.env.AWS_BEARER_TOKEN_BEDROCK
          ? { apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK }
          : {}),
      });
      const { embeddings } = await embedMany({
        // Bedrock model access is per account and per region — override when
        // Titan v2 isn't enabled (mirrors BEDROCK_MODEL_ID for generation).
        model: bedrock.embedding(process.env.BEDROCK_EMBED_MODEL_ID ?? 'amazon.titan-embed-text-v2:0'),
        values: texts,
      });
      return embeddings;
    };
  }

  return null;
}

/** Registry descriptions never change within a process — embed each exact text once. */
const vectorCache = new Map<string, number[]>();

async function embedCached(texts: string[], embedder: Embedder): Promise<number[][]> {
  const missing = texts.filter((text) => !vectorCache.has(text));
  if (missing.length > 0) {
    const vectors = await embedder(missing);
    missing.forEach((text, i) => vectorCache.set(text, vectors[i]));
  }
  return texts.map((text) => vectorCache.get(text)!);
}

export type RankedEntry = { index: number; score: number };

/**
 * Rank candidate entries against the need. Returns indices into `entries`,
 * best first, with the score that put them there — deterministic given the
 * same embedding model, and pure once vectors exist.
 */
export async function rankSemantically(
  need: string,
  entries: { plannerDescription: string; assesses: boolean }[],
  embedder: Embedder,
): Promise<RankedEntry[]> {
  const [needVector, assessVector, exploreVector] = await embedCached(
    [need, ASSESS_ANCHOR, EXPLORE_ANCHOR],
    embedder,
  );
  const descriptionVectors = await embedCached(
    entries.map((entry) => entry.plannerDescription),
    embedder,
  );

  const wantsAssessment = cosine(needVector, assessVector) > cosine(needVector, exploreVector);

  return entries
    .map((entry, index) => ({
      index,
      score:
        cosine(needVector, descriptionVectors[index]) +
        (wantsAssessment && entry.assesses ? ASSESS_BOOST : 0),
    }))
    .sort((a, b) => b.score - a.score);
}
