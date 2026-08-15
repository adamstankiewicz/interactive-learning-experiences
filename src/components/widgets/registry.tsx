"use client";

import { useMemo } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { widgetSpec } from "@/lib/pathway/schema";
import "@/lib/widgets/builtins";
import { getWidgetCatalogEntry } from "@/lib/widgets/types";

/**
 * Spec -> component, via the open widget registry (`@/lib/widgets`). Adding a
 * widget kind no longer means a case here — it means a new file under
 * `lib/widgets/definitions/` plus one import line in `lib/widgets/builtins.ts`.
 *
 * `onComplete` is deliberately payload-free at this boundary — each widget's
 * internal result shape (swipe results, sort correctness) is that widget's
 * own business. A caller that walks a student through several widgets in
 * sequence only ever needs to know "this one is done," never what was in it.
 * Fraction area model, Draft Meter, and Crossword have no notion of "done"
 * (an area model is checked repeatedly, a meter just keeps scoring, a
 * crossword is solved cell by cell with no single completion moment) and so
 * never call it — their registered components simply don't accept the prop
 * in a way that does anything.
 *
 * `widgetSpec` (the six-kind discriminated union in `schema.ts`) is still the
 * validation boundary — specs cross a network boundary from a model, so they
 * are parsed rather than trusted, and a malformed spec degrades to a visible
 * notice, not a crash. That union stays static rather than registry-derived
 * for now (see `lib/widgets/types.ts`'s top comment for why) — a third party
 * adding a widget still needs one addition to `schema.ts`'s union to be
 * generateable/validatable end to end, even though rendering itself no longer
 * needs any core-file edit.
 */
export function WidgetRenderer({
  spec,
  onComplete,
}: {
  spec: unknown;
  onComplete?: () => void;
}) {
  // safeParse rebuilds the object graph, so an unmemoized call here hands every
  // widget a new `spec` identity per render — which silently re-armed
  // DraftMeter's debounce and defeated Crossword's layout memo.
  const parsed = useMemo(() => widgetSpec.safeParse(spec), [spec]);

  if (!parsed.success) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          This widget spec did not match any registered schema.
        </AlertDescription>
      </Alert>
    );
  }

  const definition = getWidgetCatalogEntry(parsed.data.kind);
  if (!definition) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          No renderer is registered for widget kind &ldquo;{parsed.data.kind}
          &rdquo;.
        </AlertDescription>
      </Alert>
    );
  }

  const Component = definition.component;
  return <Component spec={parsed.data} onComplete={onComplete} />;
}
