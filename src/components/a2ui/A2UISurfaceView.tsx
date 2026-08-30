'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { A2UIComponent, A2UISurfaceMessage } from '@/lib/a2learn/a2ui';
import type { SequencePolicy } from '@/lib/a2learn/primitives';

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
 * app's cards, pages horizontal lists like a deck, and renders Text's
 * simple-Markdown scope the way the catalog defines it (no HTML, links and
 * images unwrapped to their text). What it never does is exceed the
 * semantics: no component gains state the surface didn't model.
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
            {columnChildren(component, path)}
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
        // A horizontal list pages like a deck: swipe, or use the paging
        // controls — position affordances are presentation, not state the
        // surface didn't model.
        return (
          <DeckView
            key={id}
            items={childIds(component).map((childId) => ({
              id: childId,
              node: render(childId, path),
            }))}
          />
        );
      }
      case 'Card': {
        // Compositional presentation: a Card whose sole child is a two-tab
        // Tabs is a thing with two faces — draw it as a real flip card. The
        // semantics are untouched (same components, same two panels); only
        // the affordance is native.
        const child = typeof component.child === 'string' ? byId.get(component.child) : undefined;
        if (child?.component === 'Tabs' && Array.isArray(child.tabs) && child.tabs.length === 2) {
          const faces = (child.tabs as { title?: unknown; child?: unknown }[]).map((tab) => ({
            title: String(tab.title ?? ''),
            child: typeof tab.child === 'string' ? tab.child : null,
          }));
          return (
            <FlipCard
              key={id}
              faces={faces as [FlipFace, FlipFace]}
              render={(childId) => render(childId, path)}
            />
          );
        }
        return (
          <div
            key={id}
            className="flex min-h-44 flex-col justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            {children()}
          </div>
        );
      }
      case 'Text': {
        const caption = component.variant === 'caption';
        // The catalog's Text supports "simple Markdown formatting (without
        // HTML, images, or links)" — so render exactly that: GFM emphasis,
        // lists and headings; raw HTML ignored, links and images unwrapped
        // to their text. Drawing literal ** marks would under-render the
        // spec, not respect it.
        return (
          <div
            key={id}
            className={
              caption
                ? 'text-sm text-muted-foreground [&_p]:leading-relaxed'
                : 'flex flex-col gap-2 text-base [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5'
            }
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              disallowedElements={['a', 'img']}
              unwrapDisallowed
            >
              {String(component.text ?? '')}
            </ReactMarkdown>
          </div>
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
      // --- a2learn interaction primitives (draft catalog = basic ∪ primitives) ---
      case 'a2learn:Sequence': {
        const policy = (component.policy ?? {}) as Partial<SequencePolicy>;
        const items = childIds(component).map((childId) => ({
          id: childId,
          node: render(childId, path),
        }));
        const action = component.completeAction as Record<string, unknown> | undefined;
        const finale = action ? { label: 'Done', onClick: () => onAction?.(action) } : undefined;
        if (policy.disclosure === 'gated') {
          return (
            <GatedSequenceView
              key={id}
              items={items}
              accumulate={policy.revealed !== 'replace'}
              finale={finale}
            />
          );
        }
        return <DeckView key={id} items={items} finale={finale} />;
      }
      case 'a2learn:Reveal': {
        const faces = (Array.isArray(component.faces) ? component.faces : []) as {
          title?: unknown;
          child?: unknown;
        }[];
        if (faces.length === 2) {
          const pair = faces.map((tab) => ({
            title: String(tab.title ?? ''),
            child: typeof tab.child === 'string' ? tab.child : null,
          }));
          return (
            <FlipCard
              key={id}
              faces={pair as [FlipFace, FlipFace]}
              render={(childId) => render(childId, path)}
            />
          );
        }
        return (
          <TabsView
            key={id}
            tabs={faces.map((tab) => ({
              title: String(tab.title ?? ''),
              child: typeof tab.child === 'string' ? tab.child : null,
            }))}
            render={(childId) => render(childId, path)}
          />
        );
      }
      default:
        return <Gap key={id} label={`unrenderable component: ${component.component}`} />;
    }
  }

  /**
   * A Column's children, with one compositional merge: a horizontal List
   * (a deck) immediately followed by an action Button folds that button
   * into the deck's paging controls as the final page's action — the same
   * button, the same action, presented where the reader finishes, the way
   * the native widgets end on their own CTA. Nothing is dropped or added.
   */
  function columnChildren(component: A2UIComponent, path: Set<string>): React.ReactNode[] {
    const ids = childIds(component);
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < ids.length; i++) {
      const child = byId.get(ids[i]);
      const following = i + 1 < ids.length ? byId.get(ids[i + 1]) : undefined;
      if (
        child?.component === 'List' &&
        child.direction === 'horizontal' &&
        following?.component === 'Button' &&
        following.action &&
        typeof following.action === 'object'
      ) {
        const labelSource =
          typeof following.child === 'string' ? byId.get(following.child) : undefined;
        const action = following.action as Record<string, unknown>;
        nodes.push(
          <DeckView
            key={ids[i]}
            items={childIds(child).map((childId) => ({ id: childId, node: render(childId, path) }))}
            finale={{
              label: String(labelSource?.text ?? 'Done'),
              onClick: () => onAction?.(action),
            }}
          />,
        );
        i++; // the button is folded into the deck — don't render it twice
        continue;
      }
      nodes.push(render(ids[i], path));
    }
    return nodes;
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
 * A horizontal List as a paged deck: one item in view, Back/Next and
 * position dots as renderer affordances, and page changes slide in place —
 * the same 320ms slide-and-fade the native widgets use, not a scroll.
 */
function DeckView({
  items,
  finale,
}: {
  items: { id: string; node: React.ReactNode }[];
  /** Rendered in Next's place on the last page — the deck's own completion action. */
  finale?: { label: string; onClick: () => void };
}) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    setDirection(Math.sign(clamped - index));
    setIndex(clamped);
  };

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        key={items[index]?.id}
        initial={direction === 0 ? false : { x: direction * 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {items[index]?.node}
      </motion.div>
      {items.length > 1 && (
        <>
          <div className="flex justify-center gap-1.5" aria-hidden>
            {items.map((item, i) => (
              <span
                key={item.id}
                className={
                  i === index
                    ? 'h-2 w-4 rounded-full bg-primary transition-all'
                    : 'h-2 w-2 rounded-full bg-muted-foreground/30 transition-all'
                }
              />
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              ← Back
            </button>
            {finale && index === items.length - 1 ? (
              <button
                type="button"
                onClick={finale.onClick}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {finale.label}
              </button>
            ) : (
              <button
                type="button"
                disabled={index === items.length - 1}
                onClick={() => go(index + 1)}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                Next →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Sequence(disclosure: gated): items reveal one advance at a time —
 * accumulate keeps passed items visible, replace shows only the newest.
 * The advance past the last item is the completion, exactly the native
 * step-reveal's discipline, driven here entirely by policy data.
 */
function GatedSequenceView({
  items,
  accumulate,
  finale,
}: {
  items: { id: string; node: React.ReactNode }[];
  accumulate: boolean;
  finale?: { label: string; onClick: () => void };
}) {
  const [revealed, setRevealed] = useState(1);
  const atEnd = revealed >= items.length;
  const visible = accumulate ? items.slice(0, revealed) : items.slice(revealed - 1, revealed);
  return (
    <div className="flex flex-col gap-3">
      {visible.map((item, i) => (
        <motion.div
          key={item.id}
          initial={i === visible.length - 1 ? { y: 12, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          {item.node}
        </motion.div>
      ))}
      {!atEnd ? (
        <button
          type="button"
          onClick={() => setRevealed((n) => n + 1)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Next →
        </button>
      ) : finale ? (
        <button
          type="button"
          onClick={finale.onClick}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {finale.label}
        </button>
      ) : null}
    </div>
  );
}

type FlipFace = { title: string; child: string | null };

/**
 * A genuine 3D flip: one container rotating in perspective, two
 * backface-hidden faces stacked in the same grid cell (so the tallest face
 * sets the height), tap anywhere to turn it over. The caption names the
 * other face using the surface's own tab titles — no flashcard vocabulary
 * baked into the renderer.
 */
function FlipCard({
  faces,
  render,
}: {
  faces: [FlipFace, FlipFace];
  render: (childId: string) => React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  const faceClass =
    'col-start-1 row-start-1 flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm [backface-visibility:hidden]';
  return (
    <div className="flex flex-col gap-2">
      <div style={{ perspective: 1100 }}>
        <motion.div
          className="grid cursor-pointer transform-3d"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.9, 0.3, 1] }}
          onClick={() => setFlipped((f) => !f)}
        >
          <div className={faceClass}>{faces[0].child ? render(faces[0].child) : null}</div>
          <div className={`${faceClass} transform-[rotateY(180deg)]`}>
            {faces[1].child ? render(faces[1].child) : null}
          </div>
        </motion.div>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Tap to see {flipped ? faces[0].title.toLowerCase() : faces[1].title.toLowerCase()}
      </p>
    </div>
  );
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
