'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

import type { A2UIComponent, A2UISurfaceMessage } from '@/lib/a2learn/a2ui';

/**
 * A renderer for the slice of the A2UI basic catalog the boundary mapper
 * emits: Column, Card, Text, Divider, Image, Button, Tabs, List. This is
 * not a general A2UI client — it exists so the app can *show* a mapped
 * surface being a real UI, not just JSON that validates. A component
 * outside the emitted slice renders as a visible gap, never silently
 * dropped.
 *
 * Presentation is the renderer's job — that's A2UI's core split: the
 * surface carries semantics, the host draws them in its own design
 * language. So this renderer animates tab switches, styles cards like the
 * app's cards, and pages horizontal lists like a deck. What it never does
 * is exceed the semantics: Text draws its string as plain text (a markdown
 * body shows literal `**` marks — the mapper documents exactly that), and
 * no component gains state the surface didn't model.
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
      case 'Row':
        return (
          <div key={id} className="flex flex-row items-center gap-3">
            {children()}
          </div>
        );
      case 'List': {
        const horizontal = component.direction === 'horizontal';
        if (!horizontal) {
          return (
            <div key={id} className="flex flex-col gap-3">
              {children()}
            </div>
          );
        }
        // A horizontal list pages like a deck: full-width snap targets, one
        // in view at a time, swipe or scroll to move through.
        return (
          <div key={id} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
            {childIds(component).map((childId) => (
              <div key={childId} className="w-full shrink-0 snap-center">
                {render(childId, path)}
              </div>
            ))}
          </div>
        );
      }
      case 'Card':
        return (
          <div
            key={id}
            className="flex min-h-44 flex-col justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
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
      case 'Tabs': {
        const tabs = Array.isArray(component.tabs) ? (component.tabs as { title?: unknown; child?: unknown }[]) : [];
        return (
          <TabsView
            key={id}
            tabs={tabs.map((tab) => ({
              title: String(tab.title ?? ''),
              child: typeof tab.child === 'string' ? tab.child : null,
            }))}
            render={(childId) => render(childId, path)}
          />
        );
      }
      case 'Image':
        // The catalog's accessibility field is `description`, not `alt`.
        return (
          <SurfaceImage key={id} url={String(component.url ?? '')} alt={String(component.description ?? '')} />
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

/**
 * Tab switching is renderer-local state — the one interaction the basic
 * catalog gives back (this is how the flashcard reveal survives projection).
 * Presentation is ours to choose, so a switch flips: the panel turns over
 * like a card, and the whole panel is tappable to advance to the next tab —
 * semantics unchanged, affordance native.
 */
function TabsView({
  tabs,
  render,
}: {
  tabs: { title: string; child: string | null }[];
  render: (childId: string) => React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const current = tabs[active];
  const advance = () => setActive((i) => (i + 1) % tabs.length);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-center gap-1" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={
              i === active
                ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                : 'rounded-full px-3 py-1 text-xs text-muted-foreground hover:bg-muted'
            }
            onClick={() => setActive(i)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <motion.div
        key={active}
        initial={{ rotateY: -90, opacity: 0.4 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        style={{ transformPerspective: 900 }}
        className="cursor-pointer"
        onClick={advance}
        title="Tap to turn over"
      >
        {current?.child ? render(current.child) : null}
      </motion.div>
    </div>
  );
}

/** A broken image collapses to nothing; the alt text is the honest fallback. */
function SurfaceImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // An image that broke before hydration already fired its error event;
  // onError alone would miss it, and the gap would render as silence.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-muted-foreground">
        🖼 image unavailable — {alt || 'no description provided'}
      </p>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL from a surface; next/image needs configured hosts
    <img ref={ref} src={url} alt={alt} className="max-w-full rounded-md" onError={() => setFailed(true)} />
  );
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
