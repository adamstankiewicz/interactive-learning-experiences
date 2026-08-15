import { z } from 'zod';

/**
 * The feedback contract.
 *
 * Same split as `draft-meter/schema.ts`, for the same reason: the model returns
 * only judgements, and everything presentational is derived from them in code.
 * Asking for the verdict *and* the label *and* whether the student is finished
 * invites the three to disagree, and there is no honest way to reconcile "all
 * three criteria met" with "keep going" at render time.
 *
 * What is different here is that the judgement is *requested*. Draft Meter
 * scores on a debounce and the student never asks; this one only ever runs when
 * a student decides they are ready, which changes what the output has to be. A
 * meter can afford to say nothing. A response to a request cannot — being asked
 * "how is this?" and answered with silence is worse than any nudge.
 */

/**
 * The three criteria, fixed rather than model-authored.
 *
 * These keys are the same ones `defendClaimSpec.checklist` carries wording for,
 * so the pre-submission list and the ticks against it cannot drift apart. The
 * spec names them for *this* claim ("A quote from Douglass or the editorial");
 * the model decides only whether each is present.
 */
export const defenseChecks = z.object({
  position: z
    .boolean()
    .describe('Did they commit to a side of the claim, rather than surveying both and landing nowhere?'),
  reasoning: z
    .boolean()
    .describe('Did they say why — a because that holds up, not a restatement of the claim?'),
  evidence: z
    .boolean()
    .describe('Did they point at one of the supplied sources — quoted, paraphrased, or named specifically?'),
});

export type DefenseChecks = z.infer<typeof defenseChecks>;

export const STANCES = ['agree', 'disagree'] as const;
export type Stance = (typeof STANCES)[number];

/**
 * What the model returns.
 *
 * `challenge` is the widget. A student who has written a competent paragraph
 * and been told it is competent has not defended anything — they have submitted.
 * The objection is what turns a submission into a defense, so it is required on
 * every round including the last one, and it is deliberately *not* phrased as a
 * revision request. `revise` is the revision request, and it goes quiet once the
 * criteria are met.
 */
export const modelFeedback = z.object({
  checks: defenseChecks,
  /**
   * A genuinely checkable thing, and the reason stance is a spec field rather
   * than something inferred from the prose: a student who ticks Agree and then
   * argues the other way has made a specific, nameable mistake, and pointing at
   * it is more useful than any amount of general advice.
   */
  stanceMatchesWriting: z
    .boolean()
    .describe(
      'Does the defense actually argue for the side they ticked? False only for a real contradiction, not for a student who fairly acknowledges the other side before disagreeing with it.',
    ),
  strength: z
    .string()
    .describe(
      'One sentence naming the strongest move they actually made, quoting three to six of their own words. Never generic praise — if the only strength is that they took a side, say that.',
    ),
  challenge: z
    .string()
    .describe(
      'The objection their position has to survive: what someone who read the other source would say back. One or two sentences, addressed to the student, ending in something they could answer. Never a request to edit — this is an argument, not a correction.',
    ),
  revise: z
    .string()
    .nullable()
    .describe(
      'At most 100 characters, or null once all three criteria are met. The single highest-value next move, addressed to the student. Never a list, never praise, never punitive.',
    ),
});

export type ModelFeedback = z.infer<typeof modelFeedback>;

/** What `/api/defend-claim` returns: the model's judgement plus the derived presentation. */
export type FeedbackResult = ModelFeedback & {
  /**
   * All three criteria met *and* the writing matches the ticked stance. The
   * widget marks the finish line with this rather than letting the revision
   * prompt silently vanish — an empty space is ambiguous, and "your defense
   * holds" is the whole point of showing goalposts in the first place.
   */
  holds: boolean;
  /** How many criteria are met, 0-3. Drives the progress read-out, not a grade. */
  met: number;
};

/**
 * One earlier round, replayed into the next feedback call.
 *
 * Without this the second reading is a cold read: a student who added the quote
 * they were asked for gets told, again, that their defense is fine, with no
 * acknowledgement that they changed anything. Iteration that does not notice
 * the iteration is just repetition.
 */
export const priorRound = z.object({
  defense: z.string(),
  challenge: z.string(),
  revise: z.string().nullable(),
});

export type PriorRound = z.infer<typeof priorRound>;

/** What the widget posts. Parsed rather than trusted — it crosses the network. */
export const feedbackRequest = z.object({
  defense: z.string(),
  stance: z.enum(STANCES),
  claim: z.string(),
  context: z.string(),
  sources: z.array(z.object({ attribution: z.string(), text: z.string() })).default([]),
  criteria: z.array(z.string()).default([]),
  standardCode: z.string(),
  standardDescription: z.string(),
  /** 1-based. Round 1 is the first submission; anything higher is a revision. */
  round: z.number().int().min(1).default(1),
  /** Earlier rounds, oldest first. Trimmed by the route, not by the client. */
  history: z.array(priorRound).default([]),
});

export type FeedbackRequest = z.infer<typeof feedbackRequest>;
