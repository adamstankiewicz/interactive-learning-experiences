import {
  findLearningComponents,
  findProgression,
  findStandardStatement,
  type ProgressionStandard,
  type StandardStatement,
} from '@/lib/learning-commons/client';
import type { LearningComponentRef, StandardRef, StandardsSource } from '@/lib/standards/types';

/**
 * Learning Commons as one `StandardsSource` implementation — CCSS-Math-heavy
 * in practice (its learning-components decomposition is CCSS-M only; see
 * `client.ts`), but the standards-lookup surface itself covers more.
 *
 * The classification that used to live in `pathway/coverage.ts` as three
 * exported regexes lives here now, private: it's this *source's* opinion
 * about what a code means, not a fact every source shares. A state-standards
 * source or an NGSS source would classify differently, with a different
 * notation entirely — that's the whole point of moving it behind the
 * interface instead of leaving it as a global.
 */

const SOURCE_ID = 'learning-commons';
const SOURCE_LABEL = 'Learning Commons';

/** CCSS-M fractions, grades 3-5. */
const FRACTION_CODE = /^(3|4|5)\.NF\./;
/** CCSS ELA writing (W.8.1) and literacy-in-content writing (WHST.6-8.1). */
const WRITING_CODE = /^W(HST)?\./;
/**
 * Reading standards a criteria-grounded writing scorer can honestly grade —
 * strand 1 ("cite textual evidence") and strand 8 ("evaluate the argument
 * and specific claims"), both measured by stance, reasoning and evidence.
 * Deliberately excludes strand 2 (summary/central idea) and strand 4 (word
 * meaning, tone), where a student is judged on interpretive accuracy rather
 * than a defensible position.
 */
const READING_EVIDENCE_CODE = /^(RL|RI|RH|RST)\.[0-9-]+\.(1|8)$/;
/**
 * Standards where a few sentences of student writing is the natural evidence —
 * literature and informational reading, reading in history and in science and
 * technical subjects, and writing in all of them.
 *
 * Broader than `reading-evidence` on purpose. A meter that scores a short
 * written response against whatever the standard asks for is not only an
 * argument tool: "what does this character value, and what shows it" and "what
 * does this source tell you about the period" are the same shape of task.
 * Deliberately excludes L (language conventions) and RF (foundational reading),
 * where the evidence of learning is not a paragraph.
 */
const WRITTEN_RESPONSE_CODE = /^(W|WHST|RL|RI|RH|RST)\./;
/** Reading standards: the task is about a text, so one has to be supplied. */
const TEXT_DEPENDENT_CODE = /^(RL|RI|RH|RST)\./;
/**
 * History, for widgets that need a claim historians actually disagree about.
 *
 * Two signals, because neither alone is enough. `RH.` (Reading in History/
 * Social Studies) is the one CCSS strand that is unambiguously history by its
 * notation — `WHST` is deliberately *not* here, since it spans history,
 * science and technical subjects, and a WHST code on its own is no evidence
 * the lesson is history at all. The subject match is what carries non-CCSS
 * state social-studies standards, whose codes share no notation with these.
 *
 * Narrower than `written-response`, which every RH code also carries: that tag
 * says a paragraph is the right evidence, this one says the subject is one
 * where a claim can be argued rather than looked up.
 */
const HISTORY_CODE = /^RH\./;
const HISTORY_SUBJECT = /histor|social studies|civics|government/i;

/**
 * Grade bands in the notation, e.g. the "6-8" in RH.6-8.3.
 *
 * The graph reports a single grade for these ("6" for the whole 6-8 band),
 * which `reachesGrade` then reads as "this standard tops out at grade 6" — so
 * any widget with a grade-7 floor excludes the entire middle-school history and
 * literacy-in-content strand, which is precisely the band it was written for.
 * The band in the code is the more complete fact about a standard that
 * explicitly serves three grades, so it is unioned into what the graph returns
 * rather than replacing it.
 */
const GRADE_BAND = /\.(\d{1,2})-(\d{1,2})\./;

function gradeLevelsFor(code: string, reported: string[]): string[] {
  const band = GRADE_BAND.exec(code);
  if (!band) return reported;

  const from = Number(band[1]);
  const to = Number(band[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return reported;

  const expanded = Array.from({ length: to - from + 1 }, (_, index) => String(from + index));
  return [...new Set([...reported, ...expanded])];
}

function classify(code: string, subject: string): string[] {
  const tags: string[] = [];
  if (FRACTION_CODE.test(code)) tags.push('fractions');
  if (WRITING_CODE.test(code)) tags.push('writing-argument');
  if (READING_EVIDENCE_CODE.test(code)) tags.push('reading-evidence');
  if (WRITTEN_RESPONSE_CODE.test(code)) tags.push('written-response');
  if (TEXT_DEPENDENT_CODE.test(code)) tags.push('text-dependent');
  if (HISTORY_CODE.test(code) || HISTORY_SUBJECT.test(subject)) tags.push('history');
  return tags;
}

function toStandardRef(standard: StandardStatement): StandardRef {
  return {
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    verified: true,
    code: standard.statementCode,
    id: standard.caseIdentifierUUID,
    description: standard.description,
    jurisdiction: standard.jurisdiction,
    gradeLevels: gradeLevelsFor(standard.statementCode, standard.gradeLevels),
    subject: standard.academicSubject,
    tags: classify(standard.statementCode, standard.academicSubject),
  };
}

function progressionToStandardRef(standard: ProgressionStandard): StandardRef {
  return {
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    verified: true,
    code: standard.statementCode,
    id: standard.caseIdentifierUUID,
    description: standard.description,
    jurisdiction: standard.jurisdiction,
    gradeLevels: gradeLevelsFor(standard.statementCode, [standard.gradeLevel]),
    subject: standard.academicSubject,
    tags: classify(standard.statementCode, standard.academicSubject),
  };
}

export const learningCommonsSource: StandardsSource = {
  id: SOURCE_ID,
  label: SOURCE_LABEL,

  proposalPromptFragment: [
    'Propose codes in official Common Core notation only: math like "3.NF.A.1", "5.NBT.A.2";',
    'ELA like "RI.5.2", "RL.4.3". Do not invent codes for frameworks like NGSS.',
    // Without this, a history or civics topic gets state-social-studies codes
    // ("8.10", "US.1.10") that this graph cannot resolve, and every such
    // pathway falls to an unverified Discovery anchor. CCSS's literacy-in-
    // history strands are the notation it *can* resolve, so they have to be
    // named — the model does not reach for them unprompted.
    'For history, civics, and social studies, use the literacy-in-content strands, which are the',
    'only Common Core codes covering them: "RH.6-8.2", "RH.9-10.8" for reading in history/social',
    'studies, and "WHST.6-8.1" for writing in those subjects. Never propose a state social-studies',
    'code such as "8.10" or "US.1.10" — they are not Common Core and will not resolve.',
  ].join(' '),

  async verify(code, jurisdiction) {
    const match = await findStandardStatement(code, jurisdiction);
    return match ? toStandardRef(match) : null;
  },

  async decompose(standard) {
    const components: LearningComponentRef[] = (await findLearningComponents(standard.id)).map((c) => ({
      id: c.identifier,
      description: c.description,
    }));
    return components;
  },

  async progression(standard, direction) {
    const standards = await findProgression(standard.id, direction);
    return standards.map(progressionToStandardRef);
  },
};
