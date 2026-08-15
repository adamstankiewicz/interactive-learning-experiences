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

/** A pathway session that has been assigned to a specific roster student. */
export type Assignment = {
  id: string;
  rosterStudentId: string;
  /** The personalized session generated for this student. */
  sessionId: string;
  topic: string;
  createdAt: string;
};
