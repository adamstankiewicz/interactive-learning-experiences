'use client';

import { useState } from 'react';

import { A2UISurfaceDemo, ActionLog } from '@/components/a2ui/A2UISurfaceView';
import { WidgetRenderer } from '@/components/widgets/registry';
import type { A2UISurfaceMessage } from '@/lib/a2learn/a2ui';
import { A2LEARN_EVENT_PREFIX } from '@/lib/a2learn/manifest';

/**
 * The two tiers of the same spec, side by side — and both columns are A2UI.
 *
 * The left column renders the *a2learn catalog* surface (draft, #98): its
 * one component is the widget kind itself, so the registry's own React
 * component is the catalog renderer and parity with the native experience
 * is by construction — mechanics, completion reporting and all, the same
 * loop the MCP Apps shell speaks. The right column renders the *basic
 * catalog* projection any generic A2UI renderer can draw. The remaining gap
 * between the columns is exactly what the versioned a2learn catalog exists
 * to close for hosts beyond this app.
 */

type Props = {
  a2learnSurface: A2UISurfaceMessage;
  /** Generic-primitives composition (a2learn:Sequence / a2learn:Reveal), when one exists. */
  composition?: A2UISurfaceMessage | null;
  basicSurface: A2UISurfaceMessage;
};

/** Renders an a2learn-catalog surface: `a2learn:<kind>` → the registry. */
function A2LearnSurfaceView({
  surface,
  onAction,
}: {
  surface: A2UISurfaceMessage;
  onAction: (action: Record<string, unknown>) => void;
}) {
  const root = surface.createSurface.components.find((c) => c.id === 'root');
  if (!root || typeof root.component !== 'string' || !root.component.startsWith('a2learn:')) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        ⚠ not an a2learn-catalog surface.
      </p>
    );
  }
  const kind = root.component.slice('a2learn:'.length);
  return (
    <WidgetRenderer
      spec={root.spec}
      onComplete={() =>
        onAction({
          event: {
            name: `${A2LEARN_EVENT_PREFIX}widget_completed`,
            userMessage: 'Finished the activity.',
            context: { kind },
          },
        })
      }
    />
  );
}

export function A2UIComparison({ a2learnSurface, composition, basicSurface }: Props) {
  const [action, setAction] = useState<Record<string, unknown> | null>(null);
  return (
    <div className={`grid gap-6 lg:grid-cols-2 ${composition ? 'xl:grid-cols-3' : ''}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          a2learn catalog (draft) — full fidelity, registry as renderer
        </p>
        <A2LearnSurfaceView surface={a2learnSurface} onAction={setAction} />
        <ActionLog action={action} />
      </div>
      {composition && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            a2learn primitives (draft) — behavior as data
          </p>
          <A2UISurfaceDemo surface={composition} />
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          A2UI basic catalog — universal fallback
        </p>
        <A2UISurfaceDemo surface={basicSurface} />
      </div>
    </div>
  );
}
