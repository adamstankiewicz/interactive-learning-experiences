import type { StandardRef } from '@/lib/standards/types';

/**
 * The listing shapes, on their own so consumers — tests, the coming SDK, the
 * a2learn manifest convergence — can import the wire contract without
 * touching the finder's runtime (which reaches the model layer through
 * `proposeFor`). This module is type-only by design; keep it that way.
 */

/**
 * A compact activity listing: what it teaches, whether it measures, and the
 * exact call that builds it. This file is the only normative source for the
 * shape; it converges on the a2learn manifest format when those docs ship
 * with their producer.
 */
export type ActivityManifest = {
  /** Stable within one response; deterministic from (standard, widget kind). Not a saved-instance id — those arrive with save/freeze. */
  id: string;
  /** Listing category. 'activity' is the only kind today; lesson-sized listings would join as their own kind, not overload this one. */
  kind: 'activity';
  title: string;
  /** One sentence for a model to rank against the learner's need — written for machine readers, not marketing. */
  summary: string;
  /**
   * The marketplace's two-tier trust model: 'content' = open data (activity
   * instances, freely shareable); 'code' = executable widget kinds, which
   * travel a curated/signed path and are never listed here. This registry
   * only ever emits 'content'.
   */
  tier: 'content';
  /**
   * The listing is a capability, not a cached artifact: invoking `delivery`
   * manufactures a fresh activity. Frozen (teacher-reviewed) instances will
   * list as `generative: false` once save/freeze ships.
   */
  generative: true;
  /** Every code here survived graph verification, or is flagged `verified: false` — a listing never launders an unchecked code. */
  standards: { code: string; source: string; verified: boolean }[];
  /**
   * Who the activity is for, as scheme-scoped labels. `scheme` names the
   * system that owns the values, so "4" is unambiguous — grade 4 under
   * `k12-us`, not year 4 or level 4 under something else. Mirrors the
   * `standards[]` shape above: a value plus the authority that named it.
   *
   * Empty means *unstated*, never "suitable for anyone".
   */
  audience: { scheme: string; values: string[] }[];
  /**
   * What an agent needs before assigning: `assesses` mirrors the registry
   * entry's flag (completion without it is not evidence of mastery);
   * `mechanics` are plain words describing what the student does
   * ("drag to order", "write and get scored") for ranking against the need.
   */
  pedagogy: { assesses: boolean; mechanics: string[] };
  /**
   * The exact invocation that builds this activity, keyed by transport so
   * more doors (rest, lti) can join additively. `arguments` pass through to
   * the tool verbatim — consumers forward, never interpret.
   */
  delivery: { mcp: { tool: 'show_widget'; arguments: Record<string, string> } };
  /** Everything here is model-generated and unreviewed until save/freeze adds approved-by records — stated so no listing implies otherwise. */
  provenance: { generated: true };
};

export type FindResult = {
  standard: StandardRef | null;
  /**
   * Which ranker ordered the listings: 'semantic' (embeddings + cosine, when
   * the deployment has an embedding-capable provider) or 'lexical' (the
   * deterministic fallback). Stated so no deployment silently pretends to a
   * capability it lacks — and so callers know whether re-ranking is worth it.
   */
  ranking: 'semantic' | 'lexical';
  rejectedCodes: string[];
  activities: ActivityManifest[];
};
