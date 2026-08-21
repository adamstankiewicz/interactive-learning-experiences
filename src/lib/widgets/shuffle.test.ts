import { describe, expect, it } from 'vitest';

import { seededShuffle } from '@/lib/widgets/shuffle';

const bank = [
  { id: 'a', label: 'first' },
  { id: 'b', label: 'second' },
  { id: 'c', label: 'third' },
  { id: 'd', label: 'fourth' },
  { id: 'e', label: 'fifth' },
];
const keyOf = (item: { id: string }) => item.id;
const order = (items: { id: string }[]) => items.map(keyOf).join('');

describe('seededShuffle', () => {
  it('is deterministic: the same bank shuffles identically on every call', () => {
    expect(order(seededShuffle(bank, keyOf))).toBe(order(seededShuffle(bank, keyOf)));
  });

  it('returns a permutation — every item exactly once', () => {
    const shuffled = seededShuffle(bank, keyOf);
    expect(shuffled.map(keyOf).sort()).toEqual(bank.map(keyOf).sort());
  });

  it('never returns the authored order (the answer key for ordering tasks)', () => {
    expect(order(seededShuffle(bank, keyOf))).not.toBe(order(bank));
  });

  it('avoids an explicitly forbidden order', () => {
    const shuffled = seededShuffle(bank, keyOf);
    const reshuffled = seededShuffle(bank, keyOf, shuffled.map(keyOf));
    expect(order(reshuffled)).not.toBe(order(shuffled));
  });

  it('passes short banks through untouched', () => {
    expect(seededShuffle([], keyOf)).toEqual([]);
    expect(seededShuffle([bank[0]], keyOf)).toEqual([bank[0]]);
  });
});
