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

function classify(code: string): string[] {
  const tags: string[] = [];
  if (FRACTION_CODE.test(code)) tags.push('fractions');
  if (WRITING_CODE.test(code)) tags.push('writing-argument');
  if (READING_EVIDENCE_CODE.test(code)) tags.push('reading-evidence');
  if (WRITTEN_RESPONSE_CODE.test(code)) tags.push('written-response');
  if (TEXT_DEPENDENT_CODE.test(code)) tags.push('text-dependent');
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
    gradeLevels: standard.gradeLevels,
    subject: standard.academicSubject,
    tags: classify(standard.statementCode),
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
    gradeLevels: [standard.gradeLevel],
    subject: standard.academicSubject,
    tags: classify(standard.statementCode),
  };
}

export const learningCommonsSource: StandardsSource = {
  id: SOURCE_ID,
  label: SOURCE_LABEL,

  proposalPromptFragment: [
    'Propose codes in official Common Core notation only: math like "3.NF.A.1", "5.NBT.A.2";',
    'ELA like "RI.5.2", "RL.4.3". Do not invent codes for frameworks like NGSS.',
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
