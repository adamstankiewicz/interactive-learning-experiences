import { describe, expect, it } from 'vitest';

import { ASSESS_ANCHOR, EXPLORE_ANCHOR, cosine, rankSemantically, type Embedder } from '@/lib/activities/semantic';

describe('cosine', () => {
  it('behaves like cosine similarity', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosine([0, 0], [1, 0])).toBe(0); // zero vector: defined, not NaN
  });
});

/**
 * A deterministic toy embedding space: three axes (writing, sorting,
 * assessing). Real models put related texts near each other; this fake does
 * the same, so the ranking logic is exercised without a network.
 */
const SPACE: Record<string, number[]> = {
  'the student writes a short argument': [1, 0, 0.2],
  'the student drags items into order': [0, 1, 0],
  'a scored quiz over the standard': [0.2, 0, 1],
  'something they write': [1, 0.1, 0],
  'a quick check of what they learned': [0.1, 0, 1],
  [ASSESS_ANCHOR]: [0, 0, 1],
  [EXPLORE_ANCHOR]: [0.6, 0.6, 0],
};
const fakeEmbedder: Embedder = async (texts) => texts.map((text) => SPACE[text] ?? [0.1, 0.1, 0.1]);

const entries = [
  { plannerDescription: 'the student writes a short argument', assesses: true },
  { plannerDescription: 'the student drags items into order', assesses: false },
  { plannerDescription: 'a scored quiz over the standard', assesses: true },
];

describe('rankSemantically', () => {
  it('orders by similarity to the need', async () => {
    const ranked = await rankSemantically('something they write', entries, fakeEmbedder);
    expect(ranked[0].index).toBe(0); // the writing activity wins for a writing need
  });

  it('reads assessment intent from anchors, not keywords', async () => {
    // No lexical overlap with any assessment word list — the anchor geometry decides.
    const ranked = await rankSemantically('a quick check of what they learned', entries, fakeEmbedder);
    expect(ranked[0].index).toBe(2);
    expect(entries[ranked[0].index].assesses).toBe(true);
  });

  it('is deterministic for identical inputs', async () => {
    const a = await rankSemantically('something they write', entries, fakeEmbedder);
    const b = await rankSemantically('something they write', entries, fakeEmbedder);
    expect(a).toEqual(b);
  });
});
