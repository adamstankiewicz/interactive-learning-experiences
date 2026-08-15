import type { Anchor } from '@/lib/pathway/events';
import type { PathwayPlan } from '@/lib/pathway/schema';

/**
 * Context every widget generator gets, regardless of kind — moved out of
 * `generate.ts` so widget definition modules can build their own prompt
 * without importing `generate.ts` itself (which imports the registry these
 * modules register into — that circularity is exactly what this split avoids).
 */
export function widgetContext(anchor: Anchor, plan: PathwayPlan, step: PathwayPlan['steps'][number]): string {
  const componentBlock = anchor.learningComponents.map((c) => `- id: ${c.id}\n  skill: ${c.description}`).join('\n');

  return [
    `Standard ${anchor.standard.code}: ${anchor.standard.description}`,
    '',
    'Learning components:',
    componentBlock || '(none)',
    '',
    'Pathway outcomes:',
    plan.outcomes.map((o, i) => `${i + 1}. ${o.statement}`).join('\n'),
    '',
    'Known misconceptions:',
    plan.misconceptions.map((m) => `- ${m}`).join('\n'),
    '',
    `Grade band: ${plan.gradeBand}`,
    '',
    `This widget belongs to the "${step.purpose}" step: ${step.title} — ${step.description}`,
  ].join('\n');
}
