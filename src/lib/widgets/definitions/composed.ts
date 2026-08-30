import { lazy } from 'react';
import { composedSpecStrict, type ComposedSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<ComposedSpec>({
  kind: 'composed',
  schema: composedSpecStrict,
  // Derived, not asserted: the composed alphabet (Sequence, Reveal, Callout,
  // Text) contains nothing that measures, so a composition cannot assess by
  // construction. When verdict-carrying primitives join the alphabet (#100
  // phase 3, gated on #99), this becomes a per-composition derivation.
  assesses: false,
  component: lazy(() =>
    import('@/components/widgets/Composed').then((m) => ({ default: m.Composed })),
  ),
  plannerDescription:
    'Composes a bespoke reading-and-reflection activity from pedagogical building blocks — gated walkthroughs, tap-to-reveal cards, why/tip callouts — when no single fixed activity shape fits the need. Explains and explores; does not measure.',
});
