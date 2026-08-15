import type { LearningComponentRef, StandardRef, StandardsSource } from '@/lib/standards/types';

/**
 * A second, deliberately tiny `StandardsSource` — proof that the interface
 * is genuinely pluggable, not just a relabeled Learning Commons client.
 *
 * This is the file to copy when wiring in a real second source (a state
 * standards API, NGSS, IB, a district's own curriculum graph): implement
 * `verify`/`decompose`/`progression` against your own data instead of this
 * hardcoded array, keep your own code notation in `proposalPromptFragment`,
 * and pick your own `tags` vocabulary — nothing else in the pipeline cares
 * how a standard is coded, only what tags it carries.
 *
 * Deliberately cross-subject (math, science, ELA) and non-CCSS-shaped codes,
 * to prove `generate.ts` never assumes CCSS notation anywhere once a source
 * is behind this interface.
 */

const SOURCE_ID = 'example';
const SOURCE_LABEL = 'Example Standards Set';

type ExampleStandard = StandardRef & {
  components: LearningComponentRef[];
  before: string[];
  after: string[];
};

const STANDARDS: Record<string, ExampleStandard> = {
  'MATH.4.NF.EQUIV': {
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    verified: true,
    code: 'MATH.4.NF.EQUIV',
    id: 'ex-math-4-nf-equiv',
    description: 'Explain why a fraction a/b is equivalent to a fraction (n × a)/(n × b) by using visual models.',
    jurisdiction: 'Example',
    gradeLevels: ['4'],
    subject: 'Mathematics',
    tags: ['fractions'],
    components: [
      { id: 'ex-comp-equiv-partition', description: 'Partitions a whole into equal-sized parts' },
      { id: 'ex-comp-equiv-scale', description: 'Scales numerator and denominator by the same factor' },
    ],
    before: ['MATH.3.NF.UNIT'],
    after: ['MATH.5.NF.ADD'],
  },
  'MATH.3.NF.UNIT': {
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    verified: true,
    code: 'MATH.3.NF.UNIT',
    id: 'ex-math-3-nf-unit',
    description: 'Understand a unit fraction 1/b as the quantity formed by one part when a whole is partitioned into b equal parts.',
    jurisdiction: 'Example',
    gradeLevels: ['3'],
    subject: 'Mathematics',
    tags: ['fractions'],
    components: [{ id: 'ex-comp-unit-partition', description: 'Names one part of an equally-partitioned whole' }],
    before: [],
    after: ['MATH.4.NF.EQUIV'],
  },
  'SCI.5.PS.FORCES': {
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    verified: true,
    code: 'SCI.5.PS.FORCES',
    id: 'ex-sci-5-ps-forces',
    description: 'Support an argument that the gravitational force exerted by Earth on objects is directed down, and explain how shape affects an object’s motion through air.',
    jurisdiction: 'Example',
    gradeLevels: ['5'],
    subject: 'Physical Science',
    tags: ['forces-and-motion'],
    components: [
      { id: 'ex-comp-forces-gravity', description: 'Identifies gravity as a downward force on all objects' },
      { id: 'ex-comp-forces-aero', description: 'Relates an object’s shape to lift and drag' },
    ],
    before: [],
    after: [],
  },
  'ELA.5.RI.EVIDENCE': {
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    verified: true,
    code: 'ELA.5.RI.EVIDENCE',
    id: 'ex-ela-5-ri-evidence',
    description: 'Quote accurately from an informational text when explaining what the text says and when drawing inferences from it.',
    jurisdiction: 'Example',
    gradeLevels: ['5'],
    subject: 'English Language Arts',
    tags: ['reading-evidence'],
    components: [{ id: 'ex-comp-evidence-quote', description: 'Cites a specific passage to support a claim' }],
    before: [],
    after: [],
  },
  'HIST.8.US.RECONSTRUCTION': {
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    verified: true,
    code: 'HIST.8.US.RECONSTRUCTION',
    id: 'ex-hist-8-us-reconstruction',
    description:
      'Evaluate competing explanations for the end of Reconstruction, using primary sources to support a position.',
    jurisdiction: 'Example',
    gradeLevels: ['8'],
    subject: 'Social Studies',
    // The `history` tag is what makes `defend-claim` eligible; the grade floor
    // in its coverageRule does the rest. Tagged here rather than derived from
    // the code, since this source's notation is its own — which is the point
    // of tags living on the ref instead of in a shared regex.
    tags: ['history'],
    components: [
      { id: 'ex-comp-hist-claim', description: 'States a defensible position on a contested historical question' },
      { id: 'ex-comp-hist-source', description: 'Cites a primary source to support a historical claim' },
    ],
    before: [],
    after: [],
  },
  'ELA.8.W.ARGUMENT': {
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    verified: true,
    code: 'ELA.8.W.ARGUMENT',
    id: 'ex-ela-8-w-argument',
    description: 'Write an argument to support a claim with clear reasons and relevant evidence.',
    jurisdiction: 'Example',
    gradeLevels: ['8'],
    subject: 'English Language Arts',
    tags: ['writing-argument'],
    components: [{ id: 'ex-comp-argument-claim', description: 'States a claim and supports it with reasons' }],
    before: [],
    after: [],
  },
};

function bareRef({ components: _components, before: _before, after: _after, ...ref }: ExampleStandard): StandardRef {
  return ref;
}

export const exampleSource: StandardsSource = {
  id: SOURCE_ID,
  label: SOURCE_LABEL,

  proposalPromptFragment: [
    'Propose codes in this notation only: "MATH.4.NF.EQUIV", "SCI.5.PS.FORCES", "ELA.5.RI.EVIDENCE",',
    '"ELA.8.W.ARGUMENT", "HIST.8.US.RECONSTRUCTION" — subject prefix, grade, strand, short topic slug,',
    'all upper case, dot-separated.',
  ].join(' '),

  async verify(code) {
    return STANDARDS[code] ? bareRef(STANDARDS[code]) : null;
  },

  async decompose(standard) {
    return STANDARDS[standard.code]?.components ?? [];
  },

  async progression(standard, direction) {
    const entry = STANDARDS[standard.code];
    if (!entry) return [];
    const codes = direction === 'backward' ? entry.before : entry.after;
    return codes.map((code) => bareRef(STANDARDS[code])).filter((ref): ref is StandardRef => Boolean(ref));
  },
};
