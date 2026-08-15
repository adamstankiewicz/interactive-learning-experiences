import type { RosterStudent } from './types';

/**
 * Demo fixtures, loaded only when SEED_DEMO_ROSTER=1.
 *
 * `adaptations` is where a teacher records IEP and accommodation detail, so
 * these deliberately describe instructional needs rather than diagnoses: the
 * pipeline reads them the same way, and nothing in this repo distinguishes a
 * committed fixture from a real record once it is in the table.
 */
export const SEED_STUDENTS: Omit<RosterStudent, 'id'>[] = [
  {
    name: 'Maya Chen',
    grade: '5',
    learningStyle: { primary: 'visual-spatial', secondary: 'reading-writing' },
    preferredActivityTypes: ['diagramming', 'infographic-creation', 'independent-research', 'choice-board'],
    avoidActivityTypes: ['cold-call-qa', 'lecture'],
    adaptations:
      'Needs a visual schedule posted; benefits from color-coded materials; allow think time or a written response option instead of timed verbal answers.',
    pacingPreference: 'fast, gets bored with repetition',
    attentionSpanMinutes: 20,
    socialPreference: 'pairs',
    motivators: ['space', 'animals', 'drawing'],
    feedbackStyle: 'written or private feedback over public praise',
    readingLevelGrade: '7',
  },
  {
    name: 'Jayden Brooks',
    grade: '5',
    learningStyle: { primary: 'kinesthetic-tactile', secondary: 'auditory' },
    preferredActivityTypes: ['hands-on-manipulatives', 'movement-game', 'role-play-simulation', 'teach-it-back'],
    avoidActivityTypes: ['worksheet', 'silent-independent-reading'],
    adaptations:
      'Needs movement breaks every 10-15 minutes, a fidget tool available, and multi-step written directions broken into single-step checklists.',
    pacingPreference: 'short bursts, high variety, novelty-driven',
    attentionSpanMinutes: 10,
    socialPreference: 'small-group',
    motivators: ['sports', 'building-construction', 'competition-games'],
    feedbackStyle: 'immediate, verbal, energetic — specific praise lands well',
    readingLevelGrade: '4',
  },
  {
    name: 'Amara Diallo',
    grade: '5',
    learningStyle: { primary: 'auditory', secondary: 'kinesthetic' },
    preferredActivityTypes: ['think-pair-share', 'paired-discussion', 'read-aloud-with-partner', 'audio-video-content'],
    avoidActivityTypes: ['independent-silent-reading', 'timed-written-test'],
    adaptations:
      'Still building academic English — needs vocabulary pre-teaching, visual supports paired with text, extended time on written output, and sentence starters/frames.',
    pacingPreference: 'moderate, benefits from repetition and rephrasing',
    attentionSpanMinutes: 15,
    socialPreference: 'pairs',
    motivators: ['music', 'family-community-stories', 'cooking'],
    feedbackStyle: 'encouraging, low-stakes; language correction given privately, not in front of peers',
    readingLevelGrade: '3',
  },
  {
    name: 'Noah Kessler',
    grade: '5',
    learningStyle: { primary: 'reading-writing', secondary: 'visual-spatial' },
    preferredActivityTypes: ['structured-written-response', 'graphic-organizer', 'step-by-step-guided-practice'],
    avoidActivityTypes: ['open-ended-group-work', 'unannounced-schedule-change'],
    adaptations:
      'Needs predictable structure and advance notice of transitions, explicit (not implied) instructions, a reduced-sensory-load workspace option, and literal language (avoid idioms/sarcasm in prompts).',
    pacingPreference: 'steady and predictable; resists forced acceleration',
    attentionSpanMinutes: 25,
    socialPreference: 'solo',
    motivators: ['trains', 'maps-geography', 'categorization-sorting-systems'],
    feedbackStyle: 'direct, specific, factual — avoid vague praise, prefers concrete confirmation of accuracy',
    readingLevelGrade: '5',
  },
];
