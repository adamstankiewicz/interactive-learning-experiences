import { describe, expect, it } from 'vitest';

import {
  composedSpec,
  composedSpecStrict,
  compositionProblems,
  type ComposedSpec,
} from '@/lib/pathway/schema';

/**
 * The composed kind's structural gate. This is what stands between a
 * model-emitted tree and a student's screen, so every rule proves it can
 * reject — a vacuously green validator here would render holes at children.
 */

const sound: ComposedSpec = {
  kind: 'composed',
  learningComponentId: null,
  title: 'Comparing fractions, step by step',
  components: [
    {
      type: 'Sequence',
      id: 'root',
      policy: { order: 'linear', disclosure: 'gated', revealed: 'accumulate' },
      children: ['s1', 's2'],
    },
    { type: 'Group', id: 's1', children: ['s1-text', 's1-why'] },
    { type: 'Text', id: 's1-text', text: 'Same denominator means same-size pieces.', variant: null },
    { type: 'Callout', id: 's1-why', intent: 'why', label: 'Why?', text: 'Comparing only works when pieces match.', },
    { type: 'Reveal', id: 's2', faces: [{ title: 'Front', child: 's2-q' }, { title: 'Back', child: 's2-a' }] },
    { type: 'Text', id: 's2-q', text: 'Which is bigger: 2/6 or 5/6?', variant: null },
    { type: 'Text', id: 's2-a', text: '**5/6** — more same-size pieces.', variant: null },
  ],
};

describe('compositionProblems', () => {
  it('accepts a sound composition', () => {
    expect(compositionProblems(sound)).toEqual([]);
    expect(composedSpecStrict.safeParse(sound).success).toBe(true);
  });

  it('rejects a missing root', () => {
    const spec = {
      ...sound,
      components: sound.components.map((c) => (c.id === 'root' ? { ...c, id: 'not-root' } : c)),
    } as ComposedSpec;
    expect(compositionProblems(spec)).toContainEqual(expect.stringContaining('root'));
  });

  it('rejects a dangling reference', () => {
    const spec = {
      ...sound,
      components: sound.components.filter((c) => c.id !== 's1-why'),
    } as ComposedSpec;
    expect(compositionProblems(spec)).toContainEqual(expect.stringContaining('missing component: s1-why'));
    expect(composedSpecStrict.safeParse(spec).success).toBe(false);
  });

  it('rejects duplicate ids', () => {
    const spec = {
      ...sound,
      components: [...sound.components, { type: 'Text', id: 's1-text', text: 'again', variant: null }],
    } as ComposedSpec;
    expect(compositionProblems(spec)).toContainEqual(expect.stringContaining('duplicate'));
  });

  it('rejects a reference cycle', () => {
    const spec = {
      ...sound,
      components: [
        ...sound.components.filter((c) => c.id !== 's1'),
        { type: 'Group', id: 's1', children: ['s1-text', 'loop'] },
        { type: 'Group', id: 'loop', children: ['s1'] },
      ],
    } as ComposedSpec;
    expect(compositionProblems(spec)).toContainEqual(expect.stringContaining('cycle'));
  });

  it('rejects a one-faced Reveal', () => {
    const spec = {
      ...sound,
      components: sound.components.map((c) =>
        c.type === 'Reveal' ? { ...c, faces: c.faces.slice(0, 1) } : c,
      ),
    } as ComposedSpec;
    expect(compositionProblems(spec)).toContainEqual(expect.stringContaining('exactly 2 faces'));
  });

  it('the base schema stays refinement-free for generation, and rejects unknown components', () => {
    // Providers serialize the base schema; refinements only run at parse
    // time. An unknown component name must still fail the union itself.
    const spec = {
      ...sound,
      components: [...sound.components, { type: 'Quiz', id: 'q', text: 'nope' }],
    };
    expect(composedSpec.safeParse(spec).success).toBe(false);
  });
});

describe('canonicalizeNode', () => {
  it('maps the field-name synonyms models actually produce', async () => {
    const { canonicalizeNode } = await import('@/lib/widgets/definitions/composed.generate');
    // body → text, observed live
    expect(canonicalizeNode({ id: 't', type: 'Text', body: '# Hi' })).toMatchObject({ text: '# Hi', variant: null });
    // flat policy fields → nested policy, observed live
    expect(
      canonicalizeNode({ id: 's', type: 'Sequence', order: 'linear', disclosure: 'gated', revealed: 'accumulate', children: ['a'] }),
    ).toMatchObject({ policy: { order: 'linear', disclosure: 'gated', revealed: 'accumulate' } });
    // front/back shorthand → faces
    expect(canonicalizeNode({ id: 'r', type: 'Reveal', front: 'q', back: 'a' })).toMatchObject({
      faces: [{ title: 'Front', child: 'q' }, { title: 'Back', child: 'a' }],
    });
    // unknown intent coerces to note; unknown type passes through for the strict parse to reject
    expect(canonicalizeNode({ id: 'c', type: 'Callout', intent: 'warning', label: 'L', text: 'x' })).toMatchObject({ intent: 'note' });
    expect(canonicalizeNode({ id: 'q', type: 'Quiz' })).toMatchObject({ type: 'Quiz' });
  });
});

describe('Check structural rules', () => {
  const withCheck = (options: { text: string; feedback: string }[], answer: number): ComposedSpec => ({
    kind: 'composed',
    learningComponentId: null,
    title: 'Check test',
    components: [
      { type: 'Group', id: 'root', children: ['q'] },
      { type: 'Check', id: 'q', prompt: 'Which sphere is water?', options, answer },
    ],
  });
  const two = [
    { text: 'hydrosphere', feedback: 'water is the hydro- part' },
    { text: 'geosphere', feedback: 'that is land and rock' },
  ];

  it('accepts a sound check', () => {
    expect(compositionProblems(withCheck(two, 0))).toEqual([]);
  });

  it('rejects an out-of-range answer and a one-option check', () => {
    expect(compositionProblems(withCheck(two, 5))).toContainEqual(expect.stringContaining('answer index'));
    expect(compositionProblems(withCheck(two.slice(0, 1), 0))).toContainEqual(expect.stringContaining('2+ options'));
  });
});

describe('Match and Hunt structural rules', () => {
  const base = (extra: ComposedSpec['components'][number]): ComposedSpec => ({
    kind: 'composed',
    learningComponentId: null,
    title: 'Games',
    components: [{ type: 'Group', id: 'root', children: ['g'] }, extra],
  });

  it('accepts sound games and rejects degenerate ones', () => {
    expect(compositionProblems(base({ type: 'Match', id: 'g', prompt: 'p', pairs: [
      { left: '1/2', right: '2/4' }, { left: '1/3', right: '2/6' }] }))).toEqual([]);
    expect(compositionProblems(base({ type: 'Match', id: 'g', prompt: 'p', pairs: [
      { left: 'a', right: 'b' }] }))).toContainEqual(expect.stringContaining('2+ pairs'));
    expect(compositionProblems(base({ type: 'Hunt', id: 'g', prompt: 'p', items: [
      { text: 'a', target: true, feedback: 'f' }, { text: 'b', target: false, feedback: 'f' },
      { text: 'c', target: false, feedback: 'f' }] }))).toEqual([]);
    expect(compositionProblems(base({ type: 'Hunt', id: 'g', prompt: 'p', items: [
      { text: 'a', target: true, feedback: 'f' }, { text: 'b', target: true, feedback: 'f' },
      { text: 'c', target: true, feedback: 'f' }] }))).toContainEqual(expect.stringContaining('decoy'));
  });
});

describe('Estimate and Model structural rules', () => {
  const base = (extra: ComposedSpec['components'][number]): ComposedSpec => ({
    kind: 'composed',
    learningComponentId: null,
    title: 'Inputs',
    components: [{ type: 'Group', id: 'root', children: ['x'] }, extra],
  });

  it('accepts sound inputs and rejects broken ones', () => {
    expect(compositionProblems(base({ type: 'Estimate', id: 'x', prompt: 'p', min: 0, max: 100, unit: '%', actual: 71, feedback: 'f' }))).toEqual([]);
    expect(compositionProblems(base({ type: 'Estimate', id: 'x', prompt: 'p', min: 0, max: 100, unit: null, actual: 150, feedback: 'f' }))).toContainEqual(expect.stringContaining('inside the range'));
    expect(compositionProblems(base({ type: 'Estimate', id: 'x', prompt: 'p', min: 5, max: 5, unit: null, actual: 5, feedback: 'f' }))).toContainEqual(expect.stringContaining('min < max'));

    const model = (options: string[], outcomeKeys: string[]) =>
      base({
        type: 'Model', id: 'x', prompt: 'p',
        variable: { name: 'denominator', options },
        outcomes: outcomeKeys.map((o) => ({ option: o, text: `with ${o} parts` })),
      });
    expect(compositionProblems(model(['2', '4', '8'], ['2', '4', '8']))).toEqual([]);
    expect(compositionProblems(model(['2', '4'], ['2']))).toContainEqual(expect.stringContaining('one authored outcome per option'));
    expect(compositionProblems(model(['2', '4'], ['2', '8']))).toContainEqual(expect.stringContaining('one authored outcome per option'));
  });
});

describe('free-form state layer structural rules', () => {
  const machine = (over: Partial<ComposedSpec>): ComposedSpec => ({
    kind: 'composed',
    learningComponentId: null,
    title: 'Machine',
    state: { pieces: { values: ['0', '1', '2'], initial: '0' } },
    components: [
      { type: 'Group', id: 'root', children: ['count', 'add', 'done-note'] },
      { type: 'Text', id: 'count', text: 'You have {pieces} pieces.', variant: null },
      { type: 'Action', id: 'add', label: 'Add a piece', onTap: [{ var: 'pieces', cycle: true }] },
      { type: 'Callout', id: 'done-note', intent: 'tip', label: 'Nice!', text: 'All there.', showWhen: { var: 'pieces', equals: '2' } },
    ],
    ...over,
  });

  it('accepts a sound machine', () => {
    expect(compositionProblems(machine({}))).toEqual([]);
  });

  it('rejects undeclared variables wherever referenced', () => {
    expect(compositionProblems(machine({ state: { other: { values: ['a', 'b'], initial: 'a' } } })))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('interpolates undeclared state variable "pieces"'),
        expect.stringContaining('showWhen: undeclared state variable "pieces"'),
        expect.stringContaining('onTap: undeclared state variable "pieces"'),
      ]));
  });

  it('rejects a bad initial, an out-of-set value, and a set+cycle op', () => {
    expect(compositionProblems(machine({ state: { pieces: { values: ['0', '1', '2'], initial: '9' } } })))
      .toContainEqual(expect.stringContaining('initial'));
    const bad = machine({});
    (bad.components[3] as { showWhen: { var: string; equals: string } }).showWhen = { var: 'pieces', equals: '99' };
    expect(compositionProblems(bad)).toContainEqual(expect.stringContaining('not a declared value'));
    const dual = machine({});
    (dual.components[2] as { onTap: { var: string; set?: string; cycle?: boolean }[] }).onTap = [{ var: 'pieces', set: '1', cycle: true }];
    expect(compositionProblems(dual)).toContainEqual(expect.stringContaining('exactly one of set or cycle'));
  });
});
