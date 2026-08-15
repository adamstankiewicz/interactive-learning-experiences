import { layoutCrossword, sanitizeAnswer } from '@/lib/pathway/crossword';
import { crosswordSpec, type CrosswordSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_ENTRIES = 5;
const MAX_ENTRIES = 18;

/**
 * A crossword is only a crossword if the words interlock. `layoutCrossword`
 * decides which terms earn a square; anything that cannot cross what's
 * already on the grid is dropped rather than shipped as a clue pointing at
 * nothing.
 */
function normalize(spec: CrosswordSpec): { widget: CrosswordSpec | null; note: string | null } {
  const requested = spec.entries.slice(0, MAX_ENTRIES);
  const layout = layoutCrossword(requested);

  if (layout.entries.length < MIN_ENTRIES) {
    return {
      widget: null,
      note: `Only ${layout.entries.length} of ${requested.length} generated terms interlocked into a grid — too few for a crossword, so none is shown.`,
    };
  }

  const placed = new Set(layout.entries.map((entry) => entry.answer));
  const kept: CrosswordSpec['entries'] = [];
  const seen = new Set<string>();

  for (const entry of requested) {
    const answer = sanitizeAnswer(entry.answer);
    if (!placed.has(answer) || seen.has(answer)) continue;
    seen.add(answer);
    kept.push({ ...entry, answer });
  }

  return {
    widget: { ...spec, entries: kept },
    note: layout.unplaced.length
      ? `${layout.unplaced.length} generated term${layout.unplaced.length === 1 ? '' : 's'} could not interlock and was dropped from the crossword: ${layout.unplaced.join(', ')}.`
      : null,
  };
}

registerWidgetGenerator({
  kind: 'crossword',
  async generate(ctx) {
    const prerequisiteBlock = ctx.anchor.prerequisites.length
      ? ctx.anchor.prerequisites.map((p) => `- ${p.code} (grade ${p.gradeLevels.join('/')}): ${p.description}`).join('\n')
      : '(no prerequisite standards published — draw the supporting terms from the anchor standard instead)';

    const spec = await generateStructured({
      schema: crosswordSpec,
      system: [
        'You write the terms and clues for a vocabulary crossword. You do not lay out a grid:',
        'the words are interlocked by an algorithm afterwards, and any word that cannot cross',
        'another is thrown away — so supply words that share letters, and plenty of short ones.',
        'Terms are the vocabulary this standard makes students read, say and write — words that',
        'would earn a place on the classroom word wall. Never lift incidental words out of the',
        'phrasing of a standard: in "the quantity formed by 1 part", the term being taught is',
        '"unit fraction", not "quantity" or "formed". Draw the central terms from the anchor',
        'standard, its learning components and the learning outcomes; mark those source',
        '"anchor". Fill the rest from the prerequisite standards, marked source "prerequisite",',
        'so solving the puzzle rehearses the prior knowledge the lesson depends on.',
        'Set sourceCode to the statement code the term came from.',
        'A clue defines or exemplifies the term in the plainest language the grade band allows.',
        'Never put the answer, its plural, or a word sharing its root inside its own clue.',
        'Write clues in words, never in LaTeX or symbols. Where a known misconception has a',
        'name, clue the correct term precisely enough to rule the misconception out.',
        'No proper nouns, no abbreviations, no two entries meaning the same thing.',
      ].join(' '),
      prompt: [ctx.prompt, '', 'Prerequisite standards (source of the supporting terms):', prerequisiteBlock].join('\n'),
    });

    return normalize(spec);
  },
});
