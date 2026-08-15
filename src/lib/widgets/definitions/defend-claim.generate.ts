import { defendClaimSpec, type DefendClaimSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { fallbackWidgetKind, getWidgetGenerator, registerWidgetGenerator } from '@/lib/widgets/types';

/**
 * Two sources is the whole mechanism, so it is the one thing enforced rather
 * than requested.
 *
 * With one source, "cite the evidence" has exactly one answer and the student
 * is retrieving, not choosing. With two that agree, the disagree option is a
 * trap — every document on screen supports one side, and a student who picks
 * the other is set up to fail by the setup itself. The model is told this in
 * the prompt and still occasionally returns one source, so a spec that cannot
 * support both sides is rejected here rather than shipped to a student.
 */
function normalize(spec: DefendClaimSpec): DefendClaimSpec | null {
  const sources = spec.sources
    .filter((source) => source.attribution.trim() && source.text.trim())
    .slice(0, 2);

  if (sources.length < 2) return null;
  if (!spec.claim.trim() || !spec.context.trim()) return null;

  const checklist = spec.checklist;
  if (!checklist.position.trim() || !checklist.reasoning.trim() || !checklist.evidence.trim()) {
    return null;
  }

  const criteria = spec.criteria.filter((criterion) => criterion.trim()).slice(0, 4);
  if (criteria.length < 2) return null;

  return { ...spec, sources, criteria };
}

registerWidgetGenerator({
  kind: 'defend-claim',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: defendClaimSpec,
      system: [
        'You configure a Defend a Claim activity: one contestable historical claim, two primary',
        'sources that pull against each other, and a box where a student argues for a side and',
        'then revises after asking for feedback.',
        '',
        'THE CLAIM IS THE WHOLE ACTIVITY. It must be a judgement historians actually disagree',
        'about — cause, significance, responsibility, or how much one factor mattered against',
        'another. Test it before you commit: if a competent teacher would mark one side wrong,',
        'it is a comprehension question and it does not belong here. "The Compromise of 1877',
        'ended Reconstruction" is a fact, not a claim. "Reconstruction failed less because of',
        'Southern resistance than because the North lost interest" is a claim. Phrase it as an',
        'assertion the student agrees or disagrees with, never as a question.',
        '',
        'Give exactly two sources, and make them pull in different directions, so that both',
        'Agree and Disagree can be defended from what is on the screen. A student who ticks',
        'Disagree and finds every document arguing the other way has been set up to fail. Write',
        'the excerpts yourself in period-appropriate voice, 25-60 words each, readable by a',
        'seventh grader, each with a plausible short attribution. Do not fabricate a famous',
        'quotation and attribute it to a real person as their exact words — for a named figure,',
        'write what the source type makes defensible and attribute it plainly ("Frederick',
        'Douglass, speech, 1875"); for anything else prefer a generic attribution ("Northern',
        'newspaper editorial, 1874").',
        '',
        'context is one sentence of neutral, uncontested fact — dates, who did what — so a',
        'student hazy on the period can still argue. Take no side in it.',
        '',
        'The checklist is what the student sees before submitting, and the same three things get',
        'ticked off by the feedback call, so keep each under 45 characters. Only the evidence one',
        'is specific to this activity: name the actual sources in it, e.g. "A quote from Douglass',
        'or the editorial".',
        '',
        'criteria name what a strong defense of THIS claim contains; they ground the feedback',
        'call and are never shown. standardForStudents IS shown behind a "?", so it must name',
        'what counts as done in plain words — the point is that the student can see the',
        'goalposts, not just be measured against them.',
      ].join(' '),
      prompt: [
        ctx.prompt,
        '',
        'Copy standardCode and standardDescription from the standard above exactly as given.',
      ].join('\n'),
    });

    const normalized = normalize(spec);

    if (!normalized) {
      const fallback = await getWidgetGenerator(fallbackWidgetKind())!.generate(ctx);
      return {
        widget: fallback.widget,
        note: [
          'Could not build a claim with two genuinely opposing sources for this standard — built a fallback activity for this step instead.',
          fallback.note,
        ]
          .filter(Boolean)
          .join(' '),
      };
    }

    return { widget: normalized, note: null };
  },
});
