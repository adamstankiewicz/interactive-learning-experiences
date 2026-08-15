import { z } from 'zod';

/**
 * What the student did, and what we distilled from it.
 *
 * Bounds live in `.describe()` rather than `.max()` for the same reason as the
 * widget specs: these schemas are also parsed from untrusted client input, so
 * hard limits that matter for safety are enforced in the route handler where a
 * violation can be truncated instead of failing the whole batch.
 */

export const INTERACTION_EVENTS = [
  'widget_shown',
  'card_swiped',
  'partition_changed',
  'part_selected',
  'answer_checked',
  'hint_requested',
  /**
   * A student asked to have their work read — distinct from `hint_requested`
   * on purpose. `component_mastery_rollup` counts hints as a struggle signal,
   * and requesting feedback is the *intended* move in a revision loop, not
   * evidence of being stuck. Folding the two together would make every student
   * who used `defend-claim` as designed look like they needed help.
   */
  'feedback_requested',
  'hesitation',
  'widget_completed',
] as const;

export const interactionEvent = z.object({
  eventType: z.enum(INTERACTION_EVENTS),
  widgetKind: z.string(),
  /** Graph learning component this event bears on, when the spec names one. */
  learningComponentId: z.string().nullable(),
  standardCode: z.string().nullable(),
  /** Milliseconds from widget mount, so hesitation needs no client maths. */
  elapsedMs: z.number().int().min(0),
  correct: z.boolean().nullable(),
  payload: z.record(z.string(), z.unknown()),
  /**
   * Zero-based index of the step this event belongs to. Present on
   * `widget_completed` so the server can generate remediation for the right
   * step without having to infer it from other state. Null for events that
   * pre-date this field or don't belong to a numbered step.
   */
  stepIndex: z.number().int().min(0).nullable().optional(),
});
export type InteractionEvent = z.infer<typeof interactionEvent>;

export const telemetryBatch = z.object({
  sessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  events: z.array(interactionEvent).min(1).max(50),
  /**
   * The step the student is on when this batch is flushed. Used by the
   * remediation system to guarantee the injected widget always lands after
   * the student's current position, even if they advanced past the failed
   * step before the server responded.
   */
  currentStep: z.number().int().min(0).optional(),
});
export type TelemetryBatch = z.infer<typeof telemetryBatch>;

/**
 * The distilled profile. This is the entire adaptive surface of the system, so
 * it stays small enough to sit in a system prompt without crowding out the
 * graph facts it accompanies.
 */
export const masteryEntry = z.object({
  learningComponentId: z.string(),
  standardCode: z.string().nullable(),
  /** 0 = no evidence of understanding, 1 = demonstrated mastery. */
  score: z.number().min(0).max(1),
  attempts: z.number().int().min(0),
  lastSeenAt: z.string(),
});
export type MasteryEntry = z.infer<typeof masteryEntry>;

export const studentProfile = z.object({
  mastery: z.array(masteryEntry),
  pacing: z.object({
    medianResponseMs: z.number().int().min(0),
    hintRate: z.number().min(0),
    accuracy: z.number().min(0).max(1),
  }),
  /** Misconceptions the pathway named that the student then demonstrated. */
  confirmedMisconceptions: z.array(z.string()),
  updatedAt: z.string(),
});
export type StudentProfile = z.infer<typeof studentProfile>;

export const EMPTY_PROFILE: StudentProfile = {
  mastery: [],
  pacing: { medianResponseMs: 0, hintRate: 0, accuracy: 0 },
  confirmedMisconceptions: [],
  updatedAt: new Date(0).toISOString(),
};
