'use client';

import { useState } from 'react';
import { z } from 'zod';
import { schema } from '@json-render/react/schema';
import { defineCatalog } from '@json-render/core';
import { defineRegistry, useStateStore, useStateValue, type Spec } from '@json-render/react';

import { cn } from '@/lib/utils';
import type { ComposedElement, ComposedWidget } from '@/lib/ag-ui-prototype/compose-schema';

/**
 * The render half of the composition prototype. Four primitives
 * (`SingleChoice`, `FeedbackBanner`, `RevealWhen`, `Counter`) are genuinely
 * atomic: each does exactly one thing, and they only know about each other
 * by `id` reference (see the design note in `compose-schema.ts`) — every
 * stateful primitive writes its value to `/values/{its own id}` in
 * json-render's state store, and anything that reacts to another primitive
 * just reads that same path via the `bindTo` id it was given. `QuizGrid`
 * keeps its board/turn state local (nothing else needs to see a cell-by-cell
 * board) but writes its win count through the identical `/values/{id}`
 * convention, so a `Counter` can bind to a grid exactly like it binds to
 * anything else. `id` isn't part of json-render's own `ComponentRenderProps`
 * (the renderer doesn't pass an element its own key), so `toRenderSpec`
 * below injects it as an ordinary prop — the one bridging detail every
 * component here relies on.
 */

const gridQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })),
  correctOptionId: z.string(),
});

const catalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({ id: z.string(), direction: z.enum(['row', 'column']), gap: z.enum(['sm', 'md', 'lg']) }),
      description: 'Lays out children in a row or column.',
    },
    Card: {
      props: z.object({ id: z.string(), title: z.string().nullable() }),
      description: 'A bordered surface with an optional title.',
    },
    Heading: {
      props: z.object({ id: z.string(), text: z.string(), level: z.enum(['lg', 'md']) }),
      description: 'A heading.',
    },
    Text: {
      props: z.object({ id: z.string(), text: z.string() }),
      description: 'A paragraph of prose.',
    },
    SingleChoice: {
      props: z.object({
        id: z.string(),
        question: z.string(),
        options: z.array(z.object({ id: z.string(), label: z.string() })),
      }),
      description: "Asks a question and records which option was picked, keyed by this element's own id.",
    },
    FeedbackBanner: {
      props: z.object({
        id: z.string(),
        bindTo: z.string(),
        matchValue: z.string(),
        correctMessage: z.string(),
        incorrectMessage: z.string(),
      }),
      description: 'Shows a correct/incorrect message once the bound element has a value.',
    },
    RevealWhen: {
      props: z.object({ id: z.string(), bindTo: z.string(), matchValue: z.string() }),
      description: "Hides its children until the bound element's value equals matchValue.",
    },
    Counter: {
      props: z.object({ id: z.string(), bindTo: z.string(), counterLabel: z.string().nullable() }),
      description: 'Displays a running numeric value read from another element.',
    },
    QuizGrid: {
      props: z.object({ id: z.string(), questions: z.array(gridQuestionSchema) }),
      description:
        'A 3x3 tic-tac-toe board where claiming a square requires answering a question correctly; a wrong answer gives the square to the opponent.',
    },
  },
  actions: {},
});

const GAP: Record<'sm' | 'md' | 'lg', string> = { sm: 'gap-1.5', md: 'gap-3', lg: 'gap-5' };

type Mark = 'X' | 'O' | null;

/** Rows, columns, both diagonals — the eight ways to win a 3x3 board. */
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board: Mark[]): 'X' | 'O' | 'draw' | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every((cell) => cell !== null) ? 'draw' : null;
}

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

    SingleChoice: ({ props }) => {
      const { set } = useStateStore();
      const selected = useStateValue<string>(`/values/${props.id}`);

      return (
        <fieldset>
          <legend className="text-sm font-medium">{props.question}</legend>
          <div className="mt-2 flex flex-col gap-1.5">
            {props.options.map((option) => {
              const picked = selected === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => set(`/values/${props.id}`, option.id)}
                  disabled={selected !== undefined}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default',
                    picked ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:enabled:bg-muted',
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

    FeedbackBanner: ({ props }) => {
      const value = useStateValue<string>(`/values/${props.bindTo}`);
      const answered = value !== undefined;
      const correct = answered && value === props.matchValue;

      if (!answered) return null;

      return (
        <p className={cn('text-xs font-medium', correct ? 'text-success' : 'text-destructive')}>
          {correct ? props.correctMessage : props.incorrectMessage}
        </p>
      );
    },

    RevealWhen: ({ props, children }) => {
      const value = useStateValue<string>(`/values/${props.bindTo}`);
      if (value !== props.matchValue) return null;
      return <div className="flex flex-col gap-3">{children}</div>;
    },

    Counter: ({ props }) => {
      const value = useStateValue<number>(`/values/${props.bindTo}`);
      return (
        <p className="text-sm font-medium">
          {props.counterLabel ?? 'Count'}: <span className="text-primary">{value ?? 0}</span>
        </p>
      );
    },

    QuizGrid: ({ props }) => {
      const { get, set } = useStateStore();
      const [board, setBoard] = useState<Mark[]>(() => Array<Mark>(9).fill(null));
      const [activeCell, setActiveCell] = useState<number | null>(null);
      const [questionIndex, setQuestionIndex] = useState(0);
      const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null);
      const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);

      const questions = props.questions;
      const currentQuestion = activeCell !== null && questions.length ? questions[questionIndex % questions.length] : null;

      function claimCell(index: number) {
        if (board[index] || winner || activeCell !== null || !questions.length) return;
        setActiveCell(index);
        setLastResult(null);
      }

      function answer(optionId: string) {
        if (activeCell === null || !currentQuestion) return;
        const correct = optionId === currentQuestion.correctOptionId;
        const mark: Mark = correct ? 'X' : 'O';

        const nextBoard = [...board];
        nextBoard[activeCell] = mark;
        setBoard(nextBoard);
        setActiveCell(null);
        setQuestionIndex((i) => i + 1);
        setLastResult(correct ? 'correct' : 'wrong');

        const result = checkWinner(nextBoard);
        if (result) {
          setWinner(result);
          // Same /values/{id} convention every other primitive uses — a
          // Counter can bind to this grid's own id exactly like it would
          // bind to any FeedbackBanner-incremented counter.
          if (result === 'X') {
            const path = `/values/${props.id}`;
            const current = typeof get(path) === 'number' ? (get(path) as number) : 0;
            set(path, current + 1);
          }
        }
      }

      function playAgain() {
        setBoard(Array<Mark>(9).fill(null));
        setActiveCell(null);
        setWinner(null);
        setLastResult(null);
        // questionIndex keeps advancing rather than resetting, so a replay
        // doesn't immediately repeat the same first question.
      }

      return (
        <div>
          <div className="grid w-full max-w-[280px] grid-cols-3 gap-1.5">
            {board.map((mark, index) => (
              <button
                key={index}
                type="button"
                onClick={() => claimCell(index)}
                disabled={Boolean(mark) || Boolean(winner) || activeCell !== null}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-lg border text-2xl font-bold transition-colors disabled:cursor-default',
                  mark === 'X' && 'border-primary bg-primary/10 text-primary',
                  mark === 'O' && 'border-muted-foreground/40 bg-muted text-muted-foreground',
                  !mark && 'border-input hover:enabled:bg-muted',
                )}
              >
                {mark}
              </button>
            ))}
          </div>

          {currentQuestion && (
            <div className="mt-3 rounded-lg border border-input p-3">
              <p className="text-sm font-medium">{currentQuestion.prompt}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => answer(option.id)}
                    className="rounded-lg border border-input px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lastResult && !currentQuestion && !winner && (
            <p
              className={cn(
                'mt-2 text-xs font-medium',
                lastResult === 'correct' ? 'text-success' : 'text-destructive',
              )}
            >
              {lastResult === 'correct' ? 'Correct — square claimed!' : 'Not quite — the square goes to the opponent.'}
            </p>
          )}

          {winner && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">
                {winner === 'X' ? 'You win! 🎉' : winner === 'O' ? 'The opponent wins this round.' : "It's a draw."}
              </p>
              <button
                type="button"
                onClick={playAgain}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Play again
              </button>
            </div>
          )}
        </div>
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
 * renderer consumes it". Every element's own `id` is injected into its
 * props here (see the file-top comment) since the renderer never passes it
 * through on its own.
 */
export function toRenderSpec(widget: ComposedWidget): Spec {
  const elements: Spec['elements'] = {};

  for (const element of widget.elements) {
    elements[element.id] = { type: element.type, props: elementProps(element), children: elementChildren(element) };
  }

  return { root: widget.root, elements };
}

function elementChildren(element: ComposedElement): string[] {
  return element.type === 'Stack' || element.type === 'Card' || element.type === 'RevealWhen'
    ? (element.children ?? [])
    : [];
}

function elementProps(element: ComposedElement): Record<string, unknown> {
  const id = element.id;

  switch (element.type) {
    case 'Stack':
      return { id, direction: element.direction ?? 'column', gap: element.gap ?? 'md' };
    case 'Card':
      return { id, title: element.title ?? null };
    case 'Heading':
      return { id, text: element.text ?? '', level: element.headingLevel ?? 'md' };
    case 'Text':
      return { id, text: element.text ?? '' };
    case 'SingleChoice':
      return { id, question: element.question ?? '', options: element.options ?? [] };
    case 'FeedbackBanner':
      return {
        id,
        bindTo: element.bindTo ?? '',
        matchValue: element.matchValue ?? '',
        correctMessage: element.correctMessage ?? '',
        incorrectMessage: element.incorrectMessage ?? '',
      };
    case 'RevealWhen':
      return { id, bindTo: element.bindTo ?? '', matchValue: element.matchValue ?? '' };
    case 'Counter':
      return { id, bindTo: element.bindTo ?? '', counterLabel: element.counterLabel ?? null };
    case 'QuizGrid':
      return { id, questions: element.gridQuestions ?? [] };
  }
}
