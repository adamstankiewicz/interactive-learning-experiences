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

const DEFAULTS = {
  anthropic: 'claude-opus-5',
  openrouter: 'anthropic/claude-opus-5',
  // Bedrock access is granted per model per account, and Opus-tier is commonly
  // not enabled — Sonnet is the safer default. Override with BEDROCK_MODEL_ID.
  bedrock: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
} as const;

export function pathwayModel(): LanguageModel {
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('LLM_PROVIDER=openrouter but OPENROUTER_API_KEY is not set.');
    }

    const openrouter = createOpenRouter({ apiKey });
    return openrouter.chat(process.env.OPENROUTER_MODEL_ID ?? DEFAULTS.openrouter);
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

    return bedrock(process.env.BEDROCK_MODEL_ID ?? DEFAULTS.bedrock);
  }

  return anthropic(process.env.ANTHROPIC_MODEL_ID ?? DEFAULTS.anthropic);
}
