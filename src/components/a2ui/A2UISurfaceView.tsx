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

  // The free-form state layer: finite, declared variables from the surface's
  // data model. The interpreter below is everything that ever executes —
  // compositions author values, visibility conditions, and transitions as data.
  const stateDefs = ((surface.createSurface.dataModel?.state ?? {}) as Record<
    string,
    { values: string[]; initial: string }
  >);
  const [stateVals, setStateVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(stateDefs).map(([k, d]) => [k, d.initial])),
  );
  const applyOps = (ops: { var: string; set?: string | null; cycle?: boolean | null }[]) => {
    setStateVals((prev) => {
      const next = { ...prev };
      for (const op of ops) {
        const def = stateDefs[op.var];
        if (!def) continue;
        if (op.set != null && def.values.includes(op.set)) next[op.var] = op.set;
        else if (op.cycle) {
          const i = def.values.indexOf(next[op.var] ?? def.initial);
          next[op.var] = def.values[(i + 1) % def.values.length];
        }
      }
      return next;
    });
  };
  const interp = (text: string) =>
    Object.keys(stateDefs).length === 0
      ? text
      : text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (m, name) => stateVals[name] ?? m);

  function render(id: string, seen: Set<string>): React.ReactNode {
    const component = byId.get(id);
    if (!component) return <Gap key={id} label={`missing component: ${id}`} />;
    if (seen.has(id)) return <Gap key={id} label={`circular reference: ${id}`} />;
    const showWhen = component.showWhen as { var: string; equals: string } | undefined;
    if (showWhen && stateVals[showWhen.var] !== showWhen.equals) return null;
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
              {interp(String(component.text ?? ''))}
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
      case 'a2learn:Check': {
        const options = (Array.isArray(component.options) ? component.options : []) as {
          text?: unknown;
          feedback?: unknown;
        }[];
        return (
          <CheckView
            key={id}
            prompt={String(component.prompt ?? '')}
            answer={typeof component.answer === 'number' ? component.answer : -1}
            options={options.map((o) => ({ text: String(o.text ?? ''), feedback: String(o.feedback ?? '') }))}
          />
        );
      }
      case 'a2learn:Match': {
        const pairs = (Array.isArray(component.pairs) ? component.pairs : []) as { left?: unknown; right?: unknown }[];
        return (
          <MatchView
            key={id}
            prompt={String(component.prompt ?? '')}
            pairs={pairs.map((p) => ({ left: String(p.left ?? ''), right: String(p.right ?? '') }))}
          />
        );
      }
      case 'a2learn:Hunt': {
        const items = (Array.isArray(component.items) ? component.items : []) as {
          text?: unknown; target?: unknown; feedback?: unknown;
        }[];
        return (
          <HuntView
            key={id}
            prompt={String(component.prompt ?? '')}
            items={items.map((i) => ({ text: String(i.text ?? ''), target: Boolean(i.target), feedback: String(i.feedback ?? '') }))}
          />
        );
      }
      case 'a2learn:Action': {
        const ops = (Array.isArray(component.onTap) ? component.onTap : []) as {
          var: string; set?: string | null; cycle?: boolean | null;
        }[];
        return (
          <motion.button
            key={id}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => applyOps(ops)}
            className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {interp(String(component.label ?? ''))}
          </motion.button>
        );
      }
      case 'a2learn:Estimate': {
        return (
          <EstimateView
            key={id}
            prompt={String(component.prompt ?? '')}
            min={Number(component.min ?? 0)}
            max={Number(component.max ?? 100)}
            unit={component.unit ? String(component.unit) : ''}
            actual={Number(component.actual ?? 0)}
            feedback={String(component.feedback ?? '')}
          />
        );
      }
      case 'a2learn:Model': {
        const variable = (component.variable ?? {}) as { name?: unknown; options?: unknown };
        const outcomes = (Array.isArray(component.outcomes) ? component.outcomes : []) as {
          option?: unknown; text?: unknown;
        }[];
        return (
          <ModelView
            key={id}
            prompt={String(component.prompt ?? '')}
            name={String(variable.name ?? '')}
            options={(Array.isArray(variable.options) ? variable.options : []).map(String)}
            outcomes={Object.fromEntries(outcomes.map((o) => [String(o.option ?? ''), String(o.text ?? '')]))}
          />
        );
      }
      case 'a2learn:Callout': {
        // Pedagogical emphasis with intent as data — the renderer maps
        // intent to its design language; unknown intents get the neutral box.
        const intent = String(component.intent ?? 'note');
        const tone =
          intent === 'why'
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30'
            : intent === 'tip'
              ? 'border-primary/25 bg-primary/5'
              : 'border-border bg-muted/40';
        const labelTone = intent === 'tip' ? 'font-semibold text-primary' : 'font-semibold';
        return (
          <div key={id} className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
            {component.label ? <span className={labelTone}>{String(component.label)} </span> : null}
            {typeof component.child === 'string' ? (
              render(component.child, path)
            ) : (
              <span className="[&_p]:inline">
                <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={['a', 'img']} unwrapDisallowed>
                  {interp(String(component.text ?? ''))}
                </ReactMarkdown>
              </span>
            )}
          </div>
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

/**
 * A self-check: pick, see immediately whether that was it and why, try again
 * on a miss. Deliberately local — nothing leaves this component, because it
 * exists for the learner's retrieval, not anyone's measurement. State is
 * icon + word, never color alone.
 */
function CheckView({
  prompt,
  options,
  answer,
}: {
  prompt: string;
  options: { text: string; feedback: string }[];
  answer: number;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const settled = picked === answer;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="text-base font-medium [&_p]:leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={['a', 'img']} unwrapDisallowed>
          {prompt}
        </ReactMarkdown>
      </div>
      <div className="flex flex-col gap-2" role="group">
        {options.map((option, i) => {
          const isPicked = picked === i;
          const revealed = isPicked || (settled && i === answer);
          return (
            <button
              key={i}
              type="button"
              disabled={settled}
              onClick={() => setPicked(i)}
              className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                revealed && i === answer
                  ? 'border-green-600/50 bg-green-50 dark:bg-green-950/30'
                  : isPicked
                    ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-border hover:border-muted-foreground/40'
              } disabled:cursor-default`}
            >
              {option.text}
              {isPicked && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {i === answer ? '✓ that\'s it — ' : '✗ not quite — '}
                  {option.feedback}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {picked !== null && !settled && (
        <p className="text-sm text-muted-foreground">Try another one — checking yourself is the point.</p>
      )}
    </div>
  );
}

/**
 * Match: tap a left item, then the right item you think pairs with it.
 * A hit locks the pair with a check; a miss flashes and clears. The shuffle
 * is deterministic per mount, progress is "n of N matched", and — like every
 * local game primitive — nothing leaves the component.
 */
function MatchView({ prompt, pairs }: { prompt: string; pairs: { left: string; right: string }[] }) {
  const [shuffled] = useState(() =>
    pairs.map((_, i) => i).sort((a, b) => ((a * 7919 + 13) % 101) - ((b * 7919 + 13) % 101)),
  );
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [missAt, setMissAt] = useState<number | null>(null);

  const tryPair = (rightIdx: number) => {
    if (selectedLeft === null || matched.has(rightIdx)) return;
    if (rightIdx === selectedLeft) {
      setMatched((prev) => new Set(prev).add(rightIdx));
      setSelectedLeft(null);
    } else {
      setMissAt(rightIdx);
      setTimeout(() => setMissAt(null), 500);
    }
  };

  const complete = matched.size === pairs.length;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-medium">{prompt}</p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {matched.size} / {pairs.length} matched
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          {pairs.map((pair, i) => (
            <button
              key={i}
              type="button"
              disabled={matched.has(i)}
              onClick={() => setSelectedLeft(i)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                matched.has(i)
                  ? 'border-green-600/40 bg-green-50 text-muted-foreground dark:bg-green-950/30'
                  : selectedLeft === i
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
              }`}
            >
              {matched.has(i) ? '✓ ' : ''}{pair.left}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {shuffled.map((originalIdx) => (
            <motion.button
              key={originalIdx}
              type="button"
              disabled={matched.has(originalIdx)}
              onClick={() => tryPair(originalIdx)}
              animate={missAt === originalIdx ? { x: [0, -6, 6, -3, 0] } : {}}
              transition={{ duration: 0.35 }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                matched.has(originalIdx)
                  ? 'border-green-600/40 bg-green-50 text-muted-foreground dark:bg-green-950/30'
                  : missAt === originalIdx
                    ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-border hover:border-muted-foreground/40'
              } ${selectedLeft === null && !matched.has(originalIdx) ? 'opacity-70' : ''}`}
            >
              {matched.has(originalIdx) ? '✓ ' : ''}{pairs[originalIdx].right}
            </motion.button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {complete
          ? '✓ all matched — every pair retrieved.'
          : selectedLeft === null
            ? 'Tap an item on the left, then its match on the right.'
            : 'Now tap its match on the right.'}
      </p>
    </div>
  );
}

/**
 * Hunt: find every target among near-miss decoys. Each tap answers
 * immediately — a target locks in with its feedback, a decoy flashes with
 * why it is not one. Progress counts found targets; local state only.
 */
function HuntView({ prompt, items }: { prompt: string; items: { text: string; target: boolean; feedback: string }[] }) {
  const [tapped, setTapped] = useState<Set<number>>(new Set());
  const [lastTap, setLastTap] = useState<number | null>(null);
  const targets = items.filter((i) => i.target).length;
  const found = items.filter((i, idx) => i.target && tapped.has(idx)).length;
  const complete = found === targets;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-medium">{prompt}</p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {found} / {targets} found
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => {
          const isTapped = tapped.has(i);
          return (
            <motion.button
              key={i}
              type="button"
              disabled={isTapped && item.target}
              onClick={() => { setTapped((prev) => new Set(prev).add(i)); setLastTap(i); }}
              animate={isTapped && !item.target && lastTap === i ? { x: [0, -6, 6, -3, 0] } : {}}
              transition={{ duration: 0.35 }}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                isTapped && item.target
                  ? 'border-green-600/50 bg-green-50 dark:bg-green-950/30'
                  : isTapped
                    ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-border hover:border-muted-foreground/40'
              }`}
            >
              {isTapped ? (item.target ? '✓ ' : '✗ ') : ''}{item.text}
            </motion.button>
          );
        })}
      </div>
      {lastTap !== null && tapped.has(lastTap) && (
        <p className="text-sm text-muted-foreground">
          {items[lastTap].target ? '✓ ' : '✗ '}{items[lastTap].feedback}
        </p>
      )}
      {complete && <p className="text-sm text-muted-foreground">✓ found them all — that&apos;s the discrimination.</p>}
    </div>
  );
}

/**
 * Estimate: commit a value on the slider, then the reveal shows your mark
 * and the actual on the same track — juxtaposition, never a verdict badge.
 * Committing before seeing is the pedagogy; nothing is transmitted.
 */
function EstimateView({
  prompt, min, max, unit, actual, feedback,
}: {
  prompt: string; min: number; max: number; unit: string; actual: number; feedback: string;
}) {
  const [value, setValue] = useState((min + max) / 2);
  const [locked, setLocked] = useState(false);
  const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;
  const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="text-base font-medium [&_p]:leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={['a', 'img']} unwrapDisallowed>
          {prompt}
        </ReactMarkdown>
      </div>
      <div className="relative pt-6 pb-1">
        {locked && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-0 -translate-x-1/2 text-xs font-medium text-primary"
            style={{ left: `${pct(actual)}%` }}
          >
            actual: {fmt(actual)}
          </motion.div>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={(max - min) / 100}
          value={value}
          disabled={locked}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label={prompt}
        />
        {locked && (
          <div
            className="pointer-events-none absolute top-6 h-4 w-0.5 -translate-x-1/2 rounded bg-primary"
            style={{ left: `${pct(actual)}%` }}
          />
        )}
      </div>
      {!locked ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">your estimate: {fmt(value)}</span>
          <button
            type="button"
            onClick={() => setLocked(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Lock it in
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You said {fmt(value)} · actual {fmt(actual)} — off by {fmt(Math.abs(actual - value))}. {feedback}
        </p>
      )}
    </div>
  );
}

/**
 * Model: an explanation with a knob. The student sets the variable; the
 * authored outcome for that value shows. All-numeric options render as a
 * stepped slider, labels as chips. The renderer only ever selects among
 * authored outcomes — it computes nothing.
 */
function ModelView({
  prompt, name, options, outcomes,
}: {
  prompt: string; name: string; options: string[]; outcomes: Record<string, string>;
}) {
  const [index, setIndex] = useState(0);
  const numeric = options.length > 0 && options.every((o) => /^-?\d+(\.\d+)?$/.test(o.trim()));
  const current = options[index] ?? '';
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="text-base font-medium [&_p]:leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={['a', 'img']} unwrapDisallowed>
          {prompt}
        </ReactMarkdown>
      </div>
      {numeric ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{name}:</span>
          <input
            type="range"
            min={0}
            max={options.length - 1}
            step={1}
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label={name}
          />
          <span className="w-12 text-right text-sm font-medium tabular-nums">{current}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-muted-foreground">{name}:</span>
          {options.map((option, i) => (
            <button
              key={option}
              type="button"
              onClick={() => setIndex(i)}
              className={
                i === index
                  ? 'rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground'
                  : 'rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground'
              }
            >
              {option}
            </button>
          ))}
        </div>
      )}
      <motion.div
        key={current}
        initial={{ opacity: 0.4, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-lg bg-muted/40 px-4 py-3 text-sm [&_p]:leading-relaxed"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={['a', 'img']} unwrapDisallowed>
          {outcomes[current] ?? ''}
        </ReactMarkdown>
      </motion.div>
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
