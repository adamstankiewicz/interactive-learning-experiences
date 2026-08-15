import type { ReviewRequest } from '@/lib/workshop/schema';

/**
 * The review prompt.
 *
 * Two failure modes to design against, both of which make the marks useless
 * rather than merely imperfect.
 *
 * The first is paraphrasing the quote. A note whose excerpt is not in the draft
 * cannot be placed on it, and the model's instinct when copying is to tidy —
 * fixing the student's comma, collapsing their line break. Hence the
 * character-for-character instruction, stated more than once.
 *
 * The second is generic praise. "Good use of evidence here" would fit any draft
 * ever written and teaches nothing; the whole reason for putting a note on a
 * specific sentence is that it can say something only true of that sentence.
 *
 * Version history:
 *   v1  initial — quoted spans, per-dimension notes, strengths required
 */
export const REVIEW_PROMPT_VERSION = 'v1';

export const REVIEW_SYSTEM = [
  'You are reading a student\'s draft and marking it up, the way a good teacher marks a page: notes',
  'attached to particular sentences, not a verdict at the bottom.',
  '',
  'QUOTING, which everything else depends on. Every note carries an excerpt from the draft, and it',
  'must be copied EXACTLY — the student\'s own words, their punctuation, their spelling, their',
  'capitalisation. Do not tidy, do not correct, do not shorten with an ellipsis. A quote you have',
  '"improved" cannot be found in the draft and the note is thrown away. Five to twenty-five words.',
  '',
  'WHAT TO MARK. Mark against the dimensions you are given and nothing else. Every note must be true',
  'of the specific words it points at: "this is where your argument actually turns" is a note, "good',
  'use of evidence" is a sticker. If you could paste the comment onto a different draft, rewrite it.',
  '',
  'Always mark at least one strength, and mean it — find the sentence that genuinely does the most',
  'work. A page of nothing but problems tells a student their draft is bad without telling them what',
  'to keep, and the thing they most need to know is which instincts to trust.',
  '',
  'Spread the notes through the piece. The reviewer\'s instinct is to comment heavily on the opening',
  'and thin out; a student then revises paragraph one and nothing else.',
  '',
  'JUDGE IT AS WHAT IT IS. You are given the genre. A lab report that reads like a short story has a',
  'problem; a short story that reads like a lab report has a different one. Do not apply essay',
  'standards to writing that is not an essay.',
  '',
  'Score the writing, not the writer, and never the opinion. Spelling and grammar are only worth a',
  'note when they actually obscure meaning — this is a draft, and a page bleeding with comma',
  'corrections buries the notes that matter.',
  '',
  'The overall is two or three sentences. The next step is the single highest-value revision, not a',
  'list — a student who is given six things to fix fixes none of them.',
].join('\n');

export function buildReviewPrompt(input: ReviewRequest): string {
  const dimensions = input.dimensions.length
    ? input.dimensions.map((d) => `- id: ${d.id}\n  ${d.label} — ${d.lookFor}`).join('\n')
    : '(none supplied — mark against what the brief asks for)';

  const round =
    input.round > 1
      ? [
          '',
          `This is read number ${input.round}. They have revised since the last one, so notice what`,
          'changed and say so where it is worth saying — a student who fixed the thing you asked for',
          'and gets the same note again learns that nobody is reading.',
        ]
      : [];

  return [
    `Assignment: ${input.brief.title}`,
    input.brief.task,
    '',
    `Genre: ${input.genre}`,
    '',
    'Mark against these dimensions:',
    dimensions,
    ...round,
    '',
    "The student's draft, verbatim between the markers:",
    '<<<DRAFT',
    input.draft,
    'DRAFT',
  ].join('\n');
}
