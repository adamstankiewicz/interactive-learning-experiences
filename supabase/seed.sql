-- Seed data for roster_students.
-- Runs automatically on `supabase db reset` (see config.toml [db.seed]).

insert into public.roster_students (
  name, grade, learning_style,
  preferred_activity_types, avoid_activity_types,
  adaptations, pacing_preference, attention_span_minutes,
  social_preference, motivators, feedback_style, reading_level_grade
) values
  (
    'Maya Chen', '5',
    '{"primary": "visual-spatial", "secondary": "reading-writing"}',
    array['diagramming', 'infographic-creation', 'independent-research', 'choice-board'],
    array['cold-call-qa', 'lecture'],
    'Needs a visual schedule posted; benefits from color-coded materials; mild anxiety around timed verbal responses — allow think time or a written response option.',
    'fast, gets bored with repetition',
    20, 'pairs',
    array['space', 'animals', 'drawing'],
    'written or private feedback over public praise',
    '7'
  ),
  (
    'Jayden Brooks', '5',
    '{"primary": "kinesthetic-tactile", "secondary": "auditory"}',
    array['hands-on-manipulatives', 'movement-game', 'role-play-simulation', 'teach-it-back'],
    array['worksheet', 'silent-independent-reading'],
    'ADHD (diagnosed) — needs movement breaks every 10-15 minutes, permitted a fidget tool, and multi-step written directions broken into single-step checklists.',
    'short bursts, high variety, novelty-driven',
    10, 'small-group',
    array['sports', 'building-construction', 'competition-games'],
    'immediate, verbal, energetic — specific praise lands well',
    '4'
  ),
  (
    'Amara Diallo', '5',
    '{"primary": "auditory", "secondary": "kinesthetic"}',
    array['think-pair-share', 'paired-discussion', 'read-aloud-with-partner', 'audio-video-content'],
    array['independent-silent-reading', 'timed-written-test'],
    'English Language Learner (intermediate, home language French/Wolof) — needs vocabulary pre-teaching, visual supports paired with text, extended time on written output, and sentence starters/frames.',
    'moderate, benefits from repetition and rephrasing',
    15, 'pairs',
    array['music', 'family-community-stories', 'cooking'],
    'encouraging, low-stakes; language correction given privately, not in front of peers',
    '3'
  ),
  (
    'Noah Kessler', '5',
    '{"primary": "reading-writing", "secondary": "visual-spatial"}',
    array['structured-written-response', 'graphic-organizer', 'step-by-step-guided-practice'],
    array['open-ended-group-work', 'unannounced-schedule-change'],
    'Autism spectrum — needs predictable structure and advance notice of transitions, explicit (not implied) instructions, a reduced-sensory-load workspace option, and literal language (avoid idioms/sarcasm in prompts).',
    'steady and predictable; resists forced acceleration',
    25, 'solo',
    array['trains', 'maps-geography', 'categorization-sorting-systems'],
    'direct, specific, factual — avoid vague praise, prefers concrete confirmation of accuracy',
    '5'
  )
on conflict do nothing;
