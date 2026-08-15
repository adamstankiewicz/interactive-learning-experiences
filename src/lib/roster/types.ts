import { z } from 'zod';

export type LearningStyle = {
  primary: string;
  secondary: string;
};

export type SocialPreference = 'solo' | 'pairs' | 'small-group' | 'whole-class';

export type RosterStudent = {
  id: string;
  name: string;
  grade: string;
  learningStyle: LearningStyle;
  preferredActivityTypes: string[];
  avoidActivityTypes: string[];
  adaptations: string;
  pacingPreference: string;
  attentionSpanMinutes: number;
  socialPreference: SocialPreference;
  motivators: string[];
  feedbackStyle: string;
  readingLevelGrade: string;
};

/**
 * The HTTP boundary for a roster student. Every field is caller-supplied and
 * ends up in two storage adapters and an LLM prompt, so all of them are bounded.
 *
 * Defaults matter as much as the limits: the list fields are read as
 * `motivators.length` during render, so a body that simply omitted them used to
 * store `undefined` and take the roster page down on the next paint.
 */
export const rosterStudentInput = z.object({
  name: z.string().trim().min(1).max(100),
  grade: z.string().trim().min(1).max(20),
  learningStyle: z.object({
    primary: z.string().max(60).default(''),
    secondary: z.string().max(60).default(''),
  }),
  preferredActivityTypes: z.array(z.string().max(60)).max(20).default([]),
  avoidActivityTypes: z.array(z.string().max(60)).max(20).default([]),
  adaptations: z.string().max(2000).default(''),
  pacingPreference: z.string().max(60).default(''),
  attentionSpanMinutes: z.number().int().min(1).max(240).default(20),
  socialPreference: z.enum(['solo', 'pairs', 'small-group', 'whole-class']).default('pairs'),
  motivators: z.array(z.string().max(60)).max(20).default([]),
  feedbackStyle: z.string().max(120).default(''),
  readingLevelGrade: z.string().max(20).default(''),
});

export type RosterStudentInput = z.infer<typeof rosterStudentInput>;

/** A pathway session that has been assigned to a specific roster student. */
export type Assignment = {
  id: string;
  rosterStudentId: string;
  /** The personalized session generated for this student. */
  sessionId: string;
  topic: string;
  createdAt: string;
};
