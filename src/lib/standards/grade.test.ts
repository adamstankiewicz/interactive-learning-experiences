import { describe, expect, it } from 'vitest';

import { reachesGrade } from '@/lib/standards/grade';

describe('reachesGrade', () => {
  it('parses K as grade 0', () => {
    expect(reachesGrade(['K'], 1)).toBe(false);
    expect(reachesGrade(['K'], 0)).toBe(true);
  });

  it('clears the bar when any grade in the range reaches it', () => {
    expect(reachesGrade(['K', '2'], 1)).toBe(true);
    expect(reachesGrade(['3', '4', '5'], 4)).toBe(true);
  });

  it('gates when the whole range sits below the floor', () => {
    expect(reachesGrade(['3'], 4)).toBe(false);
  });

  it('meets an exact floor', () => {
    expect(reachesGrade(['4'], 4)).toBe(true);
  });

  it('never gates on missing or unparseable grade data', () => {
    expect(reachesGrade([], 7)).toBe(true);
    expect(reachesGrade(['9-12', 'HS'], 7)).toBe(true);
  });
});
