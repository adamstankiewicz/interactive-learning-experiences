import { TimelineBuilder } from '@/components/widgets/TimelineBuilder';
import { timelineBuilderSpec, type TimelineBuilderSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<TimelineBuilderSpec>({
  kind: 'timeline-builder',
  schema: timelineBuilderSpec,
  component: TimelineBuilder,
  plannerDescription: 'Drag historical or sequential events from a bank into labeled period zones on a horizontal timeline. Supports 3–5 zones with per-event correctness feedback.',
});
