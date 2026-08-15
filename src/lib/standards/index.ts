import { exampleSource } from '@/lib/standards/example';
import { learningCommonsSource } from '@/lib/standards/learning-commons';
import type { StandardRef, StandardsSource } from '@/lib/standards/types';

export type { LearningComponentRef, StandardRef, StandardsSource } from '@/lib/standards/types';

/**
 * Every known `StandardsSource`, keyed by id. `STANDARDS_SOURCE` picks which
 * of these are *active* — one id, or several comma-separated, tried in
 * priority order.
 *
 * Multiple active sources matter for real: Learning Commons is CCSS-Math-
 * heavy in practice, so a cross-subject or off-the-beaten-path topic it
 * rejects outright can still resolve against a second source that actually
 * covers it, each with its own notation and subject coverage — this is the
 * concrete fix for a topic like "boomerangs" having no single graph that
 * owns it, but a real standard (forces and motion; a cultural-studies
 * standard) somewhere across the active set.
 *
 * STANDARDS_SOURCE=learning-commons                (default) — single source, today's behavior.
 * STANDARDS_SOURCE=learning-commons,example         — try Learning Commons first, then the example set.
 */
const REGISTRY: Record<string, StandardsSource> = {
  'learning-commons': learningCommonsSource,
  example: exampleSource,
};

let cachedActive: StandardsSource[] | null = null;

/** The sources this deployment actually queries, in priority order. */
export function activeSources(): StandardsSource[] {
  if (cachedActive) return cachedActive;

  const ids = (process.env.STANDARDS_SOURCE ?? 'learning-commons')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  const sources = ids.map((id) => {
    const source = REGISTRY[id];
    if (!source) {
      throw new Error(`Unknown STANDARDS_SOURCE "${id}". Known sources: ${Object.keys(REGISTRY).join(', ')}.`);
    }
    return source;
  });

  if (sources.length === 0) {
    throw new Error('STANDARDS_SOURCE resolved to no sources.');
  }

  cachedActive = sources;
  return cachedActive;
}

/**
 * Look up a source by the id it stamps onto every `StandardRef` it produces.
 * `decompose`/`progression` must route back to the *same* source that
 * verified a code — asking a different source to decompose a standard it's
 * never seen would silently return nothing.
 */
export function sourceById(id: string): StandardsSource {
  const source = REGISTRY[id];
  if (!source) throw new Error(`Unknown standards source id "${id}".`);
  return source;
}

/** Combined notation guidance from every active source, so the proposal model can use any of them. */
export function proposalPromptFragment(): string {
  const sources = activeSources();
  if (sources.length === 1) return sources[0].proposalPromptFragment;
  return sources.map((source) => `From ${source.label}: ${source.proposalPromptFragment}`).join(' ');
}

/** Comma-joined labels of every active source, for error/status copy. */
export function activeSourceLabels(): string {
  return activeSources()
    .map((source) => source.label)
    .join(', ');
}

/** Try each active source in priority order; the first match wins. */
export async function verifyAcrossSources(code: string, jurisdiction?: string): Promise<StandardRef | null> {
  for (const source of activeSources()) {
    const match = await source.verify(code, jurisdiction);
    if (match) return match;
  }
  return null;
}
