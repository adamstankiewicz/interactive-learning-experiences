'use client';

import Link from 'next/link';
import { useState } from 'react';
import { JSONUIProvider, Renderer, type Spec } from '@json-render/react';

import { registry, toPartialRenderSpec, toRenderSpec } from '@/lib/ag-ui-prototype/compose-catalog';
import type { ComposedWidget, PartialComposedWidget } from '@/lib/ag-ui-prototype/compose-schema';

/**
 * Phase 3a research prototype #2 — the model composes a genuinely new
 * widget's structure from a nine-primitive catalog (layout: Stack, Card,
 * Heading, Text; atomic interaction: SingleChoice, FeedbackBanner,
 * RevealWhen, Counter, wired together purely by id-reference, not
 * expression syntax; game: QuizGrid), never one of the app's six named
 * widget kinds. The draft-meter prototype proved AG-UI can carry a
 * continuous state-patch loop over a fixed widget; this one proves the
 * other half — a model choosing *which* primitives to use, how to nest
 * them, and how to wire them to each other by id, per topic, up to and
 * including branching ("unlock question 2 only after question 1 is right")
 * and a real tic-tac-toe-style mini-game with turn logic and win detection.
 * Isolated the same way: new route, new page, nothing production touched.
 */

const EXAMPLES = [
  'tic-tac-toe to learn fractions',
  'a two-step quiz that unlocks a bonus question',
  'tectonic plates',
  'the water cycle',
  'figurative language',
];

type Phase = 'idle' | 'composing' | 'done' | 'error';

export default function AgUiComposePrototype() {
  const [topic, setTopic] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [spec, setSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compose(chosenTopic: string) {
    if (!chosenTopic.trim() || phase === 'composing') return;
    setPhase('composing');
    setError(null);
    setSpec(null);

    try {
      const response = await fetch('/api/ag-ui/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: chosenTopic }),
      });

      if (!response.body) {
        setPhase('error');
        setError('No response stream.');
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type: string; name?: string; value?: unknown; message?: string };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === 'CUSTOM' && event.name === 'widget-partial') {
            // Every render toward the final composition, not just the last
            // one — this is the actual streaming: whatever the model has
            // written far enough to render, appears immediately.
            const partialSpec = toPartialRenderSpec(event.value as PartialComposedWidget);
            if (partialSpec) setSpec(partialSpec);
          } else if (event.type === 'CUSTOM' && event.name === 'widget-composed') {
            setSpec(toRenderSpec(event.value as ComposedWidget));
          } else if (event.type === 'RUN_FINISHED') {
            setPhase('done');
          } else if (event.type === 'RUN_ERROR') {
            setPhase('error');
            setError(event.message ?? 'Composition failed.');
          }
        }
      }
    } catch {
      setPhase('error');
      setError('Could not reach the composition service.');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          Phase 3a prototype
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Compose a widget on the fly</h1>
        <p className="mt-2 text-muted-foreground">
          Not one of the app&rsquo;s six built-in widgets. The model picks from a nine-primitive catalog — layout,
          a question/feedback/reveal trio it can wire together by id to build branching logic, and — for a
          playful ask — a tic-tac-toe-style QuizGrid — and decides the structure itself, per topic. The whole
          composition streams in as a series of AG-UI{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">CUSTOM</code> events — each new element renders the
          moment it&rsquo;s written, well before the whole thing finishes — through a json-render catalog registry.
          Try &ldquo;tic-tac-toe to learn fractions,&rdquo; or a two-step branching quiz.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void compose(topic);
        }}
        className="flex gap-2"
      >
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Any topic — e.g. tectonic plates"
          aria-label="Topic"
          className="h-11 flex-1 rounded-lg border border-input bg-transparent px-3.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!topic.trim() || phase === 'composing'}
          className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {phase === 'composing' ? 'Composing…' : 'Compose'}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setTopic(example);
              void compose(example);
            }}
            className="rounded-full border border-input px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {phase === 'composing' && !spec && (
          <p className="text-sm text-muted-foreground">Composing a widget for &ldquo;{topic}&rdquo;…</p>
        )}

        {phase === 'composing' && spec && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            Still composing — more is on the way
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {spec && (
          <JSONUIProvider registry={registry}>
            <Renderer spec={spec} registry={registry} />
          </JSONUIProvider>
        )}
      </div>
    </main>
  );
}
