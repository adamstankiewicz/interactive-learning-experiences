import { proposeFor } from '@/lib/widgets/build';
import { verifyAcrossSources } from '@/lib/standards';
import type { StandardRef } from '@/lib/standards/types';
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

/**
 * A compact activity listing: what it teaches, whether it measures, and the
 * exact call that builds it. This file is the only normative source for the
 * shape; it converges on the a2learn manifest format when those docs ship
 * with their producer.
 */
export type ActivityManifest = {
  id: string;
  kind: 'activity';
  title: string;
  summary: string;
  tier: 'content';
  generative: true;
  standards: { code: string; source: string; verified: boolean }[];
  gradeBand: string[];
  pedagogy: { assesses: boolean; mechanics: string[] };
  delivery: { mcp: { tool: 'show_widget'; arguments: Record<string, string> } };
  provenance: { generated: true };
};

export type FindResult = {
  standard: StandardRef | null;
  rejectedCodes: string[];
  activities: ActivityManifest[];
};

function titleCase(kind: string): string {
  return kind
    .split('-')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Deterministic fit score. Coverage eligibility is the gate; `need` words
 * matching the planner description are the tiebreaker; assessing activities
 * float when the need sounds like checking.
 */
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
  if (/\b(check|assess|quiz|test|grade|measure)\b/i.test(need) && entry.assesses) score += 3;
  return score;
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

  const activities = listWidgetCatalogEntries()
    // No verified standard → no tags → tag-gated coverage rules correctly
    // exclude themselves; the survivors are the standard-agnostic kinds.
    .filter((entry) => !standard || !entry.coverageRule || entry.coverageRule(standard))
    .map((entry) => ({ entry, score: scoreEntry(entry, need) }))
    .sort((a, b) => b.score - a.score)
    .map(({ entry }): ActivityManifest => {
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
        gradeBand: standard?.gradeLevels ?? (input.gradeHint ? [input.gradeHint] : []),
        pedagogy: { assesses: entry.assesses, mechanics: [entry.kind] },
        delivery: { mcp: { tool: 'show_widget', arguments: invokeArgs } },
        provenance: { generated: true },
      };
    });

  return { standard, rejectedCodes, activities };
}
