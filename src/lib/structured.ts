import { generateText, streamText, Output } from 'ai';
import type { FlexibleSchema, LanguageModel } from 'ai';

import { fallbackModel, pathwayModel } from '@/lib/model';

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

type StructuredOptions<T> = {
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
};

function callModel<T>(target: LanguageModel, options: StructuredOptions<T>) {
  return generateText({
    model: target,
    output: Output.object({ schema: options.schema }),
    system: options.system,
    prompt: options.prompt,
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
  });
}

/**
 * One retry, against a different vendor, before giving up.
 *
 * A hackathon prototype runs on borrowed or personal keys with nobody on call
 * — a Bedrock bearer token expiring mid-demo, or an OpenRouter rate limit
 * during a room full of people trying it at once, is the ordinary failure
 * mode here, not the rare one. `fallbackModel()` is null unless
 * `OPENAI_FALLBACK_API_KEY` is set, so this is a no-op everywhere that hasn't
 * opted in.
 */
export async function generateStructured<T>(options: StructuredOptions<T>): Promise<T> {
  const primary = options.model ?? model();

  try {
    return (await callModel(primary, options)).output;
  } catch (error) {
    const fallback = fallbackModel();
    if (!fallback) throw error;

    console.error('[model] primary provider failed, retrying once on the OpenAI fallback:', error);
    return (await callModel(fallback, options)).output;
  }
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
export async function* streamStructured<T>(
  options: Omit<StructuredOptions<T>, 'temperature'>,
): AsyncGenerator<DeepPartial<T>, T> {
  function stream(target: LanguageModel) {
    return streamText({
      model: target,
      output: Output.object({ schema: options.schema }),
      system: options.system,
      prompt: options.prompt,
    });
  }

  let result = stream(options.model ?? model());

  // Falling back mid-stream would mean un-yielding partials a caller has
  // already rendered, so the retry only applies before the first partial
  // arrives — exactly the window a dead credential or a 429 fails in anyway.
  let startedStreaming = false;

  try {
    for await (const partial of result.partialOutputStream) {
      startedStreaming = true;
      yield partial as DeepPartial<T>;
    }
    return (await result.output) as T;
  } catch (error) {
    if (startedStreaming) throw error;

    const fallback = fallbackModel();
    if (!fallback) throw error;

    console.error('[model] primary provider failed before first output, retrying once on the OpenAI fallback:', error);
    result = stream(fallback);

    for await (const partial of result.partialOutputStream) {
      yield partial as DeepPartial<T>;
    }
    return (await result.output) as T;
  }
}
