/**
 * a2learn interaction primitives: *generic, parameterized* pedagogy
 * components — behavior and emphasis as data, so activity shapes compose at
 * generation time without new component code. The product source of truth
 * for the composable alphabet is `composedSpec` in `src/lib/pathway/schema.ts`
 * (the `composed` widget kind); this module owns the catalog identity and the
 * shared policy vocabulary the renderer speaks.
 *
 * Vocabulary, grounding, and the build plan live in issue #100; the catalog
 * direction in #98. Draft means draft: the id is a URN, not a fetchable
 * schema — the versioned catalog contract is #98 phase-6 work, and nothing
 * outside this repo should program against these shapes yet.
 *
 * The v1 alphabet (Sequence, Reveal, Callout + basic-catalog content) is
 * deliberately verdict-free. Verdict-carrying primitives (Check/Response)
 * join only with the #99 evidence contract, and `assesses` on a composed
 * activity stays *derived from the alphabet* — never asserted.
 */

/** The draft a2learn catalog: Google A2UI's basic catalog ∪ these primitives. */
export const A2LEARN_CATALOG_DRAFT = 'urn:a2learn:catalog:draft';

export type SequencePolicy = {
  /** May the reader jump around, or only move to what's next? */
  order: 'linear' | 'free';
  /** Is the next item held back until the reader advances? */
  disclosure: 'gated' | 'all';
  /** Do passed items stay visible, or does the next replace them? */
  revealed: 'accumulate' | 'replace';
};

export const SEQUENCE = 'a2learn:Sequence';
export const REVEAL = 'a2learn:Reveal';
export const CALLOUT = 'a2learn:Callout';
/** Local self-check: options + instant feedback, nothing recorded — retrieval
 *  practice for the learner, never measurement (that is Response, gated on #99). */
export const CHECK = 'a2learn:Check';
/** Stateful local mini-games — selection state and progress live entirely
 *  renderer-side; nothing is recorded. Match = paired-associate retrieval,
 *  Hunt = discrimination (find every target among near-miss decoys). */
export const MATCH = 'a2learn:Match';
export const HUNT = 'a2learn:Hunt';
