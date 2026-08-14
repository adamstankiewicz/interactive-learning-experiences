import { generateText, streamText, Output } from 'ai';
import type { FlexibleSchema, LanguageModel } from 'ai';

import { pathwayModel } from '@/lib/model';

/**
 * Every model call in this project is the same shape: a schema, a system
 * prompt, and a user prompt in — a validated object out. `generateObject` is
 * deprecated in AI SDK v7 in favour of `generateText` with an `output` spec, so
 * that lives here rather than being repeated at each call site.
 *
 * The model is resolved lazily and memoised: `pathwayModel()` throws when its
 * provider env vars are missing, and doing that at module scope would fail the
 * import rather than the request that actually needed a model.
 */

let cached: ReturnType<typeof pathwayModel> | null = null;

function model() {
  return (cached ??= pathwayModel());
}

export async function generateStructured<T>(options: {
  schema: FlexibleSchema<T>;
  system: string;
  prompt: string;
  /**
   * Omitted for authoring calls, where some variety is welcome. Scoring sets
   * it to 0: a student retyping the same sentence and watching the verdict
   * change is worse than any amount of sampling diversity.
   */
  temperature?: number;
  /** Defaults to the pathway model; scoring passes the fast one. */
  model?: LanguageModel;
}): Promise<T> {
  const result = await generateText({
    model: options.model ?? model(),
    output: Output.object({ schema: options.schema }),
    system: options.system,
    prompt: options.prompt,
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
  });

  return result.output;
}

/** Local rather than imported from `pathway/events` — this module is domain-agnostic. */
type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * The same call, surfaced incrementally. Only worth it for the slowest,
 * highest-value calls — the plan authoring stage is the one that streams
 * today — so this stays a separate export rather than the default shape.
 */
export async function* streamStructured<T>(options: {
  schema: FlexibleSchema<T>;
  system: string;
  prompt: string;
  model?: LanguageModel;
}): AsyncGenerator<DeepPartial<T>, T> {
  const result = streamText({
    model: options.model ?? model(),
    output: Output.object({ schema: options.schema }),
    system: options.system,
    prompt: options.prompt,
  });

  for await (const partial of result.partialOutputStream) {
    yield partial as DeepPartial<T>;
  }

  return (await result.output) as T;
}
