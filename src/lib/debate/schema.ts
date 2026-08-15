import { z } from 'zod';

/**
 * The debate contract.
 *
 * Two things come back from one call and they are deliberately kept apart: the
 * assistant's next message, which is in character, and a judgement of the move
 * the student just made, which is not. Letting the reply carry the assessment
 * ("great point!") would flatter, leak the scoring, and make an opponent that
 * congratulates you for beating it — which is not an opponent.
 */

export const debateMove = z.object({
  id: z.string(),
  label: z.string(),
  lookFor: z.string(),
});

export type DebateMove = z.infer<typeof debateMove>;

export const debateMessage = z.object({
  role: z.enum(['ai', 'student']),
  text: z.string(),
});

export type DebateMessage = z.infer<typeof debateMessage>;

/** What the model returns for one exchange. */
export const modelTurn = z.object({
  reply: z
    .string()
    .describe(
      "The assistant's next message, in character. Two to four sentences. Never assesses the student's move and never praises it.",
    ),
  moves: z
    .array(
      z.object({
        id: z.string().describe('The id of the move, copied exactly from the list you were given.'),
        made: z.boolean().describe('Did the student make this move in the message they just sent?'),
      }),
    )
    .describe('One entry per move you were given, same ids. This is the assessment, kept out of the reply.'),
  conceded: z
    .boolean()
    .describe(
      'True only when the student genuinely defeated the point under discussion and the reply concedes it. Not for a merely good try.',
    ),
});

export type ModelTurn = z.infer<typeof modelTurn>;

/** What the widget posts. Parsed rather than trusted — it crosses the network. */
export const debateSide = z.object({
  id: z.string(),
  label: z.string(),
  summary: z.string(),
});

export type DebateSide = z.infer<typeof debateSide>;

export const debateRequest = z.object({
  motion: z.string(),
  /** Which side the assistant drew — the student took the other one. */
  aiSide: debateSide,
  studentSide: debateSide,
  aiPersona: z.string(),
  moves: z.array(debateMove).default([]),
  transcript: z.array(debateMessage).default([]),
  message: z.string(),
  turn: z.number(),
  turnLimit: z.number(),
});

export type DebateRequest = z.infer<typeof debateRequest>;

export type DebateTurnResult = {
  reply: string;
  /** Ids of the moves made in this message. */
  movesMade: string[];
  conceded: boolean;
  /** True on the last turn, so the widget can close the exchange. */
  final: boolean;
};
