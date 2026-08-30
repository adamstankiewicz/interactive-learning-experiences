import { describe, expect, it } from 'vitest';

import { buildStepStrip } from '@/lib/storage/types';

const cell = (right: boolean, wrong: boolean) => ({ right, wrong });

describe('buildStepStrip', () => {
  it('maps the four outcomes: first try, needed attempts, still wrong, unreached', () => {
    const perStep = new Map([
      [0, cell(true, false)], // right, never wrong
      [1, cell(true, true)], // eventually right
      [2, cell(false, true)], // never got it
      // 3 absent — never reached
    ]);
    expect(buildStepStrip(4, perStep)).toEqual(['first-try', 'attempts', 'wrong', 'unreached']);
  });

  it('never guesses: events recorded before stepIndex existed read as unreached', () => {
    // Pre-fix rows aggregate to an empty map — the honest answer is a full
    // unreached strip, not fabricated outcomes.
    expect(buildStepStrip(3, new Map())).toEqual(['unreached', 'unreached', 'unreached']);
  });

  it('a zero-step plan yields an empty strip', () => {
    expect(buildStepStrip(0, new Map())).toEqual([]);
  });

  it('ignores evidence beyond the plan length rather than inventing steps', () => {
    const perStep = new Map([[7, cell(true, false)]]);
    expect(buildStepStrip(2, perStep)).toEqual(['unreached', 'unreached']);
  });
});
