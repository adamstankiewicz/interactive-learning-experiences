import { z } from 'zod';

/**
 * The scoring contract.
 *
 * A deliberate split: the model returns a single `score` and the qualitative
 * signals behind it, and everything presentational is derived from that score
 * in code. Asking the model for score *and* band *and* label invites the three
 * to disagree — a 22 labelled "strong" — and there is no good way to reconcile
 * that at render time. One number is the judgement; the rest is a lookup.
 */

export const BANDS = ['developing', 'approaching', 'proficient', 'advanced'] as const;
export type Band = (typeof BANDS)[number];

/**
 * The label ladder. Warm, never punitive — and deliberately not about progress.
 *
 * The first version read "just starting" at the bottom, which describes how
 * much someone has written rather than how their argument is doing. A finished
 * four-sentence answer that never cites the source is not "just starting"; it
 * is done, and it needs work. Only the empty box is actually just starting.
 */
const BAND_LABEL: Record<Band, string> = {
  developing: 'needs work',
  approaching: 'getting closer',
  proficient: 'almost there',
  advanced: 'strong',
};

/** Thresholds are stated in the scoring prompt too, so the model aims at them. */
export function bandForScore(score: number): Band {
  if (score >= 85) return 'advanced';
  if (score >= 60) return 'proficient';
  if (score >= 35) return 'approaching';
  return 'developing';
}

export function labelForBand(band: Band): string {
  return BAND_LABEL[band];
}

/*
 * A second approach — labelling by missing criterion ("needs a side" / "needs
 * a why" / "needs a quote") rather than by band — was built and compared side
 * by side, then dropped: the band ladder plus an openable hint carries the
 * same information with less jitter, since a criterion label flips whenever a
 * single boolean does. Written up in CLAUDE_HACKATHON.md.
 */

/**
 * What the model returns. Bounds live in `.describe()` rather than `.min()`/
 * `.max()` for the reason documented in `pathway/schema.ts`: providers drop
 * numeric bounds when serialising to strict JSON Schema, so a hard bound here
 * rejects output the model was never shown the rule for.
 */
export const modelScore = z.object({
  score: z
    .number()
    .describe('0-100. 0-34 developing, 35-59 approaching, 60-84 proficient, 85-100 advanced.'),
  checks: z
    .array(
      z.object({
        id: z.string().describe('The id of the check, copied exactly from the list you were given.'),
        met: z.boolean().describe('Does the response meet this check?'),
      }),
    )
    .describe(
      'One entry per check you were given, same ids, same order. These drive the nudge; they are never shown to the student as scores.',
    ),
  nudge: z
    .string()
    .nullable()
    .describe(
      'At most 90 characters, or null when the response is already strong. One concrete next move, addressed to the student. Never praise-only, never a list.',
    ),
  confidence: z.number().describe('0-1. How sure you are, given how much they have written so far.'),
});

export type ModelScore = z.infer<typeof modelScore>;

/** What `/api/score` returns: the model's judgement plus the derived presentation. */
export type ScoreResult = ModelScore & {
  band: Band;
  /** Band ladder: needs work / getting closer / almost there / strong. */
  label: string;
  /**
   * Every check met. The widget marks the finish line with this rather than
   * letting the hint silently vanish — an empty space is ambiguous, and "you
   * are done" is the whole point of having goalposts.
   */
  criteriaMet: boolean;
  /** The finish-line sentence, built from the spec's own check labels. */
  doneMessage: string;
};

/** The check definitions the widget sends along with the draft. */
export const scoreCheck = z.object({
  id: z.string(),
  label: z.string(),
  lookFor: z.string(),
  essential: z.boolean().default(false),
});

/** What the widget posts. Parsed rather than trusted — it crosses the network. */
export const scoreRequest = z.object({
  response: z.string(),
  question: z.string(),
  standardCode: z.string(),
  standardDescription: z.string(),
  checks: z.array(scoreCheck).default([]),
  /** Present for text-dependent standards; null when the answer comes from the student. */
  passage: z
    .object({ source: z.string(), text: z.string() })
    .nullable()
    .default(null),
});

export type ScoreRequest = z.infer<typeof scoreRequest>;

/**
 * The finish line, in the student's terms: "That's all three — a claim,
 * evidence from the source, and context."
 *
 * Built from the spec's own labels so the sentence names what *this* standard
 * asked for, rather than the argument trio the meter used to assume.
 */
export function doneMessageFor(labels: string[]): string {
  const count = { 2: 'both', 3: 'all three', 4: 'all four' }[labels.length] ?? 'everything';

  const list =
    labels.length <= 1
      ? (labels[0] ?? 'it')
      : `${labels.slice(0, -1).join(', ')}${labels.length > 2 ? ',' : ''} and ${labels[labels.length - 1]}`;

  return `That's ${count} — ${list}.`;
}
