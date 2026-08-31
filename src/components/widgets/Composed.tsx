'use client';

import { useMemo, useRef } from 'react';

import { A2UISurfaceView } from '@/components/a2ui/A2UISurfaceView';
import { A2LEARN_CATALOG_DRAFT } from '@/lib/a2learn/primitives';
import type { A2UIComponent, A2UISurfaceMessage } from '@/lib/a2learn/a2ui';
import type { ComposedComponent, ComposedSpec } from '@/lib/pathway/schema';

type Props = { spec: ComposedSpec; onComplete?: (correct: boolean) => void };

/**
 * The composed kind's renderer: adapt the spec's flat primitive tree into an
 * a2learn-catalog surface and hand it to the primitives renderer. The model
 * authored structure and content only — completion wiring is injected here,
 * renderer-side, so event payloads are never model-authored data.
 *
 * Completion rule, deterministic: the first Sequence in the tree gets the
 * completion as its finale (its last advance is the natural end of the
 * activity); a composition with no Sequence gets a plain "Got it" button
 * appended below. Either way `onComplete(true)` fires — and the `true` is
 * honest only because the v1 alphabet is verdict-free: completion is the
 * only thing measured, so completing is succeeding. A verdict-carrying
 * alphabet must revisit this line before it ships (issue #100, phase 3).
 */

const COMPLETE_ACTION = { event: { name: 'composed.completed' } };

function toSurfaceComponent(component: ComposedComponent): A2UIComponent {
  switch (component.type) {
    case 'Group':
      return { id: component.id, component: 'Column', children: component.children };
    case 'Check':
      return {
        id: component.id,
        component: 'a2learn:Check',
        prompt: component.prompt,
        options: component.options,
        answer: component.answer,
      };
    case 'Match':
      return { id: component.id, component: 'a2learn:Match', prompt: component.prompt, pairs: component.pairs };
    case 'Hunt':
      return { id: component.id, component: 'a2learn:Hunt', prompt: component.prompt, items: component.items };
    case 'Text':
      return {
        id: component.id,
        component: 'Text',
        text: component.text,
        ...(component.variant === 'caption' ? { variant: 'caption' } : {}),
      };
    case 'Callout':
      return {
        id: component.id,
        component: 'a2learn:Callout',
        intent: component.intent,
        label: component.label,
        text: component.text,
      };
    case 'Reveal':
      return { id: component.id, component: 'a2learn:Reveal', faces: component.faces };
    case 'Sequence':
      return {
        id: component.id,
        component: 'a2learn:Sequence',
        policy: component.policy,
        children: component.children,
      };
  }
}

export function Composed({ spec, onComplete }: Props) {
  const completed = useRef(false);

  const { surface, hasSequence } = useMemo(() => {
    const components = spec.components.map(toSurfaceComponent);
    const firstSequence = components.find((c) => c.component === 'a2learn:Sequence');
    if (firstSequence) firstSequence.completeAction = COMPLETE_ACTION;
    const message: A2UISurfaceMessage = {
      version: 'v1.0',
      createSurface: {
        surfaceId: `composed-${spec.learningComponentId ?? 'activity'}`,
        catalogId: A2LEARN_CATALOG_DRAFT,
        components,
      },
    };
    return { surface: message, hasSequence: Boolean(firstSequence) };
  }, [spec]);

  const complete = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete?.(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{spec.title}</p>
      <A2UISurfaceView surface={surface} onAction={complete} />
      {!hasSequence && (
        <button
          type="button"
          onClick={complete}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Got it →
        </button>
      )}
    </div>
  );
}
