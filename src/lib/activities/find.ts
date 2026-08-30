import { proposeFor } from '@/lib/widgets/build';
import { verifyAcrossSources } from '@/lib/standards';
import type { StandardRef } from '@/lib/standards/types';

import type { ActivityManifest, FindResult } from '@/lib/activities/types';
import { getEmbedder, rankSemantically } from '@/lib/activities/semantic';
import '@/lib/widgets/builtins';
import { listWidgetCatalogEntries } from '@/lib/widgets/types';

/**
 * Activity discovery: the registry half of find → invoke.
 *
 * The novelty worth being explicit about: listings here are *generative*.
 * The registry does not index a shelf of pre-made files — it lists activity
 * capabilities that manufacture a standards-verified activity on demand.
 * `find_activity` answers "what could this student do for this learning
 * need"; `show_widget` (the existing invocation tool) manufactures the one
 * that gets picked. Supply is infinite; what is scarce — and what this
 * module actually ranks — is *fit*.
 *
 * Discovery is deliberately model-free: verification hits the standards
 * graph, ranking is deterministic keyword/coverage scoring. Browsing must be
 * fast and free or agents will skip it and guess.
 */

export type { ActivityManifest, FindResult } from '@/lib/activities/types';

function titleCase(kind: string): string {
  return kind
    .split('-')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Lexical fallback ordering, used when the deployment has no
 * embedding-capable provider (`semantic.ts` is the primary ranker). Kept
 * deterministic and dependency-free so discovery always answers; the result
 * says which ranker ran.
 */

/**
 * Words that signal the need is *assessment*, with provenance rather than
 * gut feel: the "evaluate" category verbs of the revised Bloom taxonomy
 * (Anderson & Krathwohl, 2001) plus standing classroom-assessment
 * vocabulary (formative/summative practice — Black & Wiliam's literature).
 * Stems, matched as word prefixes, so "assessment", "quizzes", "grading"
 * all hit. Bare "grade" is deliberately absent: topics legitimately contain
 * "grade 4", and that must not read as an intent to assess — only the
 * activity word "graded"/"grading" does.
 */
const ASSESSMENT_INTENT_STEMS = [
  'assess', 'quiz', 'test', 'exam', 'measur', 'evaluat', 'apprais', 'judg',
  'critiqu', 'check', 'verif', 'master', 'formativ', 'summativ', 'graded', 'grading',
];

function wantsAssessment(need: string): boolean {
  const words = need.toLowerCase().split(/[^a-z]+/);
  return words.some((word) => ASSESSMENT_INTENT_STEMS.some((stem) => word.startsWith(stem)));
}

function scoreEntry(
  entry: { assesses: boolean; plannerDescription: string },
  need: string,
): number {
  let score = 0;
  const description = entry.plannerDescription.toLowerCase();
  const words = need
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 3);
  for (const word of words) if (description.includes(word)) score += 2;
  if (entry.assesses && wantsAssessment(need)) score += 3;
  return score;
}

/**
 * The graph's grade levels as a scheme-scoped audience entry. Every standards
 * source wired today is US K-12, so the scheme is a literal here; a source
 * whose levels aren't K-12 grades declares its own, and this becomes a lookup.
 *
 * The caller's free-text `gradeHint` deliberately does *not* fall back into
 * this field. "8th grade" is not a `k12-us` value, and laundering unscoped
 * user text into a scheme is precisely what the scheme exists to prevent —
 * an absent audience reads as unstated, which is the honest answer when all
 * we have is a hint nobody verified.
 */
function audienceFor(standard: StandardRef | null): ActivityManifest['audience'] {
  const values = standard?.gradeLevels ?? [];
  return values.length > 0 ? [{ scheme: 'k12-us', values }] : [];
}

export async function findActivities(input: {
  standardCode?: string;
  topic?: string;
  gradeHint?: string;
  jurisdiction?: string;
  /** Free-text preference — "a game", "something they write", "quick check". */
  need?: string;
}): Promise<FindResult> {
  let candidates: string[] = [];
  if (input.standardCode?.trim()) {
    candidates = [input.standardCode.trim()];
  } else if (input.topic?.trim()) {
    const proposal = await proposeFor(input.topic, input.gradeHint);
    candidates = proposal.candidates;
  }

  let standard: StandardRef | null = null;
  const rejectedCodes: string[] = [];
  for (const code of candidates) {
    standard = await verifyAcrossSources(code, input.jurisdiction);
    if (standard) break;
    rejectedCodes.push(code);
  }

  const need = [input.need, input.topic].filter(Boolean).join(' ');

  const eligible = listWidgetCatalogEntries()
    // No verified standard → no tags → tag-gated coverage rules correctly
    // exclude themselves; the survivors are the standard-agnostic kinds.
    .filter((entry) => !standard || !entry.coverageRule || entry.coverageRule(standard));

  // Semantic ranking when the deployment can embed; lexical otherwise — and
  // an embedding failure degrades to lexical rather than failing discovery.
  let ranking: FindResult['ranking'] = 'lexical';
  let ordered = eligible
    .map((entry) => ({ entry, score: scoreEntry(entry, need) }))
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);

  const embedder = getEmbedder();
  if (embedder && need.trim()) {
    try {
      const rankedIndices = await rankSemantically(need, eligible, embedder);
      ordered = rankedIndices.map(({ index }) => eligible[index]);
      ranking = 'semantic';
    } catch (error) {
      // Lexical order already computed; the result says which ranker ran —
      // but say why in the logs, or a misconfigured embedder (a Bedrock 403,
      // a bad key) silently downgrades every deployment forever.
      console.warn('[find_activity] semantic ranking unavailable, using lexical:', error instanceof Error ? error.message : error);
    }
  }

  const activities = ordered.map((entry): ActivityManifest => {
      const invokeArgs: Record<string, string> = { kind: entry.kind };
      if (standard) invokeArgs.standardCode = standard.code;
      else if (input.topic) invokeArgs.topic = input.topic;

      return {
        id: standard ? `${entry.kind}@${standard.code}` : entry.kind,
        kind: 'activity',
        title: titleCase(entry.kind),
        summary: entry.plannerDescription,
        tier: 'content',
        generative: true,
        standards: standard
          ? [{ code: standard.code, source: standard.sourceId, verified: standard.verified }]
          : [],
        audience: audienceFor(standard),
        pedagogy: { assesses: entry.assesses, mechanics: [entry.kind] },
        delivery: { mcp: { tool: 'show_widget', arguments: invokeArgs } },
        provenance: { generated: true },
      };
    });

  return { standard, ranking, rejectedCodes, activities };
}
