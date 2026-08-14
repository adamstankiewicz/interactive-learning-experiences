import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

/**
 * One place to resolve which Claude to talk to.
 *
 * LLM_PROVIDER=anthropic  (default) — first-party Anthropic API.
 * LLM_PROVIDER=openrouter           — OpenRouter gateway. One key, no cloud setup.
 * LLM_PROVIDER=bedrock              — Claude on Amazon Bedrock.
 *
 * Each provider names the same model differently, hence the three defaults:
 *   anthropic   claude-opus-5
 *   openrouter  anthropic/claude-opus-5
 *   bedrock     us.anthropic.claude-opus-5
 */

/**
 * Two roles, so the scoring model can be changed without touching the pathway.
 *
 * Both default to the same model. Scoring was moved to Haiku and moved back:
 * it was roughly 1.3s faster, but graded a shade harsher on borderline drafts
 * (58 where Sonnet gave 68 on the same response), and the wait turned out not
 * to be the cost it looked like — a couple of seconds is thinking time for
 * someone mid-sentence, not dead air. Speed was the wrong thing to optimise.
 *
 * The seam stays because the knob is worth having; only the default changed.
 */
type Role = 'pathway' | 'scoring';

const DEFAULTS: Record<string, Record<Role, string>> = {
  anthropic: {
    pathway: 'claude-opus-5',
    scoring: 'claude-opus-5',
  },
  openrouter: {
    pathway: 'anthropic/claude-opus-5',
    scoring: 'anthropic/claude-opus-5',
  },
  bedrock: {
    // Bedrock access is granted per model per account, and Opus-tier is
    // commonly not enabled — Sonnet is the safer default. Override with
    // BEDROCK_MODEL_ID / BEDROCK_SCORING_MODEL_ID.
    pathway: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    scoring: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
};

const OVERRIDE: Record<string, Record<Role, string>> = {
  anthropic: { pathway: 'ANTHROPIC_MODEL_ID', scoring: 'ANTHROPIC_SCORING_MODEL_ID' },
  openrouter: { pathway: 'OPENROUTER_MODEL_ID', scoring: 'OPENROUTER_SCORING_MODEL_ID' },
  bedrock: { pathway: 'BEDROCK_MODEL_ID', scoring: 'BEDROCK_SCORING_MODEL_ID' },
};

function modelId(provider: string, role: Role): string {
  const fromEnv = process.env[OVERRIDE[provider][role]];
  if (fromEnv) return fromEnv;

  // Set *_SCORING_MODEL_ID to try a faster tier for scoring. On Bedrock,
  // model access is per account and per region, so an id that isn't enabled
  // 403s on every keystroke rather than degrading.
  return DEFAULTS[provider][role];
}

function resolve(role: Role): LanguageModel {
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('LLM_PROVIDER=openrouter but OPENROUTER_API_KEY is not set.');
    }

    const openrouter = createOpenRouter({ apiKey });
    return openrouter.chat(modelId('openrouter', role));
  }

  if (provider === 'bedrock') {
    // Bedrock model ids carry an `anthropic.` prefix, and most newer models are
    // served on-demand only through a cross-region inference profile, which adds
    // a geography prefix on top (`us.anthropic....`). An "on-demand throughput
    // isn't supported" error means the bare id needs that `us.` prefix.
    //
    // apiKey maps to a Bedrock API key (bearer token). Omit it and the provider
    // falls back to standard SigV4 credential resolution.
    const bedrock = createAmazonBedrock({
      region: process.env.AWS_REGION ?? 'us-west-2',
      ...(process.env.AWS_BEARER_TOKEN_BEDROCK
        ? { apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK }
        : {}),
    });

    return bedrock(modelId('bedrock', role));
  }

  return anthropic(modelId('anthropic', role));
}

/** The big model: standards proposal, pathway authoring, widget configuration. */
export function pathwayModel(): LanguageModel {
  return resolve('pathway');
}

/** The fast model: one small structured judgement, on a debounce, per student. */
export function scoringModel(): LanguageModel {
  return resolve('scoring');
}
