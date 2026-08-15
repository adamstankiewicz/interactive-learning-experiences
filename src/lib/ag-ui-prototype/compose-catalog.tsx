'use client';

import { useState } from 'react';
import { z } from 'zod';
import { schema } from '@json-render/react/schema';
import { defineCatalog } from '@json-render/core';
import { defineRegistry, type Spec } from '@json-render/react';

import { cn } from '@/lib/utils';
import type { ComposedElement, ComposedWidget } from '@/lib/ag-ui-prototype/compose-schema';

/**
 * The render half of the composition prototype. Every primitive owns its own
 * reactivity via ordinary React state (`ChoiceGroup`'s selection) — the model
 * never authors a `$state`/`$bindState` expression, only literal content and
 * structure (see `compose-schema.ts`), so there is nothing here for
 * `JSONUIProvider`'s state store to do. It's still used (see the demo page)
 * for consistency with the draft-meter prototype and because a future
 * primitive that genuinely needs cross-element state has somewhere to put it
 * without a second wiring pattern.
 */

const catalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({ direction: z.enum(['row', 'column']), gap: z.enum(['sm', 'md', 'lg']) }),
      description: 'Lays out children in a row or column.',
    },
    Card: {
      props: z.object({ title: z.string().nullable() }),
      description: 'A bordered surface with an optional title.',
    },
    Heading: {
      props: z.object({ text: z.string(), level: z.enum(['lg', 'md']) }),
      description: 'A heading.',
    },
    Text: {
      props: z.object({ text: z.string() }),
      description: 'A paragraph of prose.',
    },
    ChoiceGroup: {
      props: z.object({
        question: z.string(),
        options: z.array(z.object({ id: z.string(), label: z.string() })),
        correctOptionId: z.string(),
      }),
      description: 'A single-select question with immediate right/wrong feedback per option.',
    },
  },
  actions: {},
});

const GAP: Record<'sm' | 'md' | 'lg', string> = { sm: 'gap-1.5', md: 'gap-3', lg: 'gap-5' };

export const { registry } = defineRegistry(catalog, {
  components: {
    Stack: ({ props, children }) => (
      <div className={cn('flex', props.direction === 'row' ? 'flex-row flex-wrap' : 'flex-col', GAP[props.gap])}>
        {children}
      </div>
    ),
    Card: ({ props, children }) => (
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {props.title && <h3 className="mb-2 text-sm font-semibold">{props.title}</h3>}
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    ),
    Heading: ({ props }) =>
      props.level === 'lg' ? (
        <h2 className="text-xl font-semibold tracking-tight">{props.text}</h2>
      ) : (
        <h3 className="text-base font-semibold">{props.text}</h3>
      ),
    Text: ({ props }) => <p className="text-sm leading-relaxed text-muted-foreground">{props.text}</p>,
    ChoiceGroup: ({ props }) => {
      const [selected, setSelected] = useState<string | null>(null);

      return (
        <fieldset>
          <legend className="text-sm font-medium">{props.question}</legend>
          <div className="mt-2 flex flex-col gap-1.5">
            {props.options.map((option) => {
              const picked = selected === option.id;
              const isCorrect = picked && option.id === props.correctOptionId;
              const isWrong = picked && option.id !== props.correctOptionId;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelected(option.id)}
                  disabled={selected !== null}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default',
                    isCorrect && 'border-success bg-success/10 text-success',
                    isWrong && 'border-destructive bg-destructive/10 text-destructive',
                    !picked && 'border-input hover:bg-muted',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    },
  },
});

/**
 * The model's flat, one-shape-fits-all `elements` array (see the comment in
 * `compose-schema.ts` on why it's flat, not a discriminated union) becomes
 * json-render's own id-map `Spec` shape here, with each element narrowed
 * back down to the specific props its own catalog component expects — the
 * one place this prototype bridges "how the model outputs it" to "how the
 * renderer consumes it".
 */
export function toRenderSpec(widget: ComposedWidget): Spec {
  const elements: Spec['elements'] = {};

  for (const element of widget.elements) {
    elements[element.id] = { type: element.type, props: elementProps(element), children: elementChildren(element) };
  }

  return { root: widget.root, elements };
}

function elementChildren(element: ComposedElement): string[] {
  return element.type === 'Stack' || element.type === 'Card' ? (element.children ?? []) : [];
}

function elementProps(element: ComposedElement): Record<string, unknown> {
  switch (element.type) {
    case 'Stack':
      return { direction: element.direction ?? 'column', gap: element.gap ?? 'md' };
    case 'Card':
      return { title: element.title ?? null };
    case 'Heading':
      return { text: element.headingText ?? '', level: element.headingLevel ?? 'md' };
    case 'Text':
      return { text: element.text ?? '' };
    case 'ChoiceGroup':
      return {
        question: element.question ?? '',
        options: element.options ?? [],
        correctOptionId: element.correctOptionId ?? '',
      };
  }
}
