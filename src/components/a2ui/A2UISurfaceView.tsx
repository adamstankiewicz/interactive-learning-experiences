'use client';

import { useState } from 'react';

import type { A2UIComponent, A2UISurfaceMessage } from '@/lib/a2learn/a2ui';

/**
 * A minimal renderer for the slice of the A2UI basic catalog the boundary
 * mapper emits: Column, Card, Text, Divider, Image, Button. This is not a
 * general A2UI client — it exists so the app can *show* a mapped surface
 * being a real UI, not just JSON that validates. A component outside the
 * emitted slice renders as a visible gap, never silently dropped.
 *
 * Fidelity is deliberately strict-renderer: Text draws its string as plain
 * text, so a markdown body shows literal `**` marks — the exact degradation
 * the mapper's header documents. Honesty over polish applies to demos too.
 */

type Props = {
  surface: A2UISurfaceMessage;
  /** Called when a Button's action fires — the demo shows the payload. */
  onAction?: (action: Record<string, unknown>) => void;
};

export function A2UISurfaceView({ surface, onAction }: Props) {
  const byId = new Map(surface.createSurface.components.map((c) => [c.id, c]));

  function render(id: string, seen: Set<string>): React.ReactNode {
    const component = byId.get(id);
    if (!component) return <Gap key={id} label={`missing component: ${id}`} />;
    if (seen.has(id)) return <Gap key={id} label={`circular reference: ${id}`} />;
    const path = new Set(seen).add(id);

    const children = () => childIds(component).map((childId) => render(childId, path));

    switch (component.component) {
      case 'Column':
        return (
          <div key={id} className="flex flex-col gap-3">
            {children()}
          </div>
        );
      case 'Card':
        return (
          <div key={id} className="rounded-lg border border-border bg-card p-4">
            {children()}
          </div>
        );
      case 'Text': {
        const caption = component.variant === 'caption';
        return (
          <p key={id} className={caption ? 'text-sm text-muted-foreground' : 'text-base'}>
            {String(component.text ?? '')}
          </p>
        );
      }
      case 'Divider':
        return <hr key={id} className="border-border" />;
      case 'Image':
        return (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL from a surface; next/image needs configured hosts
          <img
            key={id}
            src={String(component.url ?? '')}
            alt={String(component.alt ?? '')}
            className="max-w-full rounded-md"
          />
        );
      case 'Button':
        return (
          <button
            key={id}
            type="button"
            className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={() => {
              if (component.action && typeof component.action === 'object') {
                onAction?.(component.action as Record<string, unknown>);
              }
            }}
          >
            {children()}
          </button>
        );
      default:
        return <Gap key={id} label={`unrenderable component: ${component.component}`} />;
    }
  }

  return <div className="flex flex-col gap-3">{render('root', new Set())}</div>;
}

/** Child references, in the shapes the mapper emits (string child / id list). */
function childIds(component: A2UIComponent): string[] {
  const ids: string[] = [];
  if (typeof component.child === 'string') ids.push(component.child);
  if (Array.isArray(component.children)) {
    for (const ref of component.children) if (typeof ref === 'string') ids.push(ref);
  }
  return ids;
}

function Gap({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-dashed border-amber-500 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      ⚠ {label}
    </p>
  );
}

/** The demo's action panel: what the conversation would hear. */
export function ActionLog({ action }: { action: Record<string, unknown> | null }) {
  return action ? (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="mb-2 text-sm font-medium">✓ action dispatched — what the agent would receive:</p>
      <pre className="overflow-x-auto text-xs">{JSON.stringify(action, null, 2)}</pre>
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">
      Nothing dispatched yet — finish the activity to see its completion action.
    </p>
  );
}

/** Small stateful wrapper so a server page can compose surface + log. */
export function A2UISurfaceDemo({ surface }: { surface: A2UISurfaceMessage }) {
  const [action, setAction] = useState<Record<string, unknown> | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <A2UISurfaceView surface={surface} onAction={setAction} />
      <ActionLog action={action} />
    </div>
  );
}
