'use client';

import { FractionAreaModel } from '@/components/widgets/FractionAreaModel';
import { widgetSpec, type WidgetSpec } from '@/lib/pathway/schema';

/**
 * Spec -> component. This is the extension point: adding a widget type means
 * a schema in `pathway/schema.ts`, a generator in `pathway/generate.ts`, and
 * a case here. The exhaustive switch makes a missing case a type error.
 */
function render(spec: WidgetSpec) {
  switch (spec.kind) {
    case 'fraction-area-model':
      return <FractionAreaModel spec={spec} />;
  }
}

/**
 * Specs cross a network boundary from a model, so they are parsed rather than
 * trusted — a malformed spec degrades to a visible notice, not a crash.
 */
export function WidgetRenderer({ spec }: { spec: unknown }) {
  const parsed = widgetSpec.safeParse(spec);

  if (!parsed.success) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        This widget spec did not match any registered schema.
      </div>
    );
  }

  return render(parsed.data);
}
