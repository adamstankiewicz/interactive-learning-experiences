import { StepReveal } from '@/components/widgets/StepReveal';
import { stepRevealSpec, type StepRevealSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<StepRevealSpec>({
  kind: 'step-reveal',
  schema: stepRevealSpec,
  component: StepReveal,
  plannerDescription: 'Walks through a concept or worked example one step at a time — each step stacks up so students can follow the full chain of reasoning.',
});
