'use client';

import Link from 'next/link';
import { useState } from 'react';
import { JSONUIProvider, Renderer, type Spec } from '@json-render/react';

import { registry, toRenderSpec } from '@/lib/ag-ui-prototype/compose-catalog';
import type { ComposedWidget } from '@/lib/ag-ui-prototype/compose-schema';

/**
 * Phase 3a research prototype #2 — the model composes a genuinely new
 * widget's structure from a small primitive catalog (Stack, Card, Heading,
 * Text, ChoiceGroup, QuizGrid, ScoreTracker), never one of the app's six
 * named widget kinds. The draft-meter prototype proved AG-UI can carry a
 * continuous state-patch loop over a fixed widget; this one proves the
 * other half — a model choosing *which* primitives to use and how to nest
 * them, per topic, up to and including a real tic-tac-toe-style mini-game
 * (QuizGrid) with turn logic, win detection, and score shared across two
 * independent elements via json-render's own state store. Isolated the
 * same way: new route, new page, nothing production touched.
 */

const EXAMPLES = [
  'tic-tac-toe to learn fractions',
  'tectonic plates',
  'the water cycle',
  'figurative language',
  'supply and demand',
];

type Phase = 'idle' | 'composing' | 'done' | 'error';

export default function AgUiComposePrototype() {
  const [topic, setTopic] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [widget, setWidget] = useState<ComposedWidget | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compose(chosenTopic: string) {
    if (!chosenTopic.trim() || phase === 'composing') return;
    setPhase('composing');
    setError(null);
    setWidget(null);

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

          if (event.type === 'CUSTOM' && event.name === 'widget-composed') {
            setWidget(event.value as ComposedWidget);
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

  const spec: Spec | null = widget ? toRenderSpec(widget) : null;

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
          Not one of the app&rsquo;s six built-in widgets. The model picks from a small primitive catalog (Stack,
          Card, Heading, Text, ChoiceGroup, and — for a playful ask — a tic-tac-toe-style QuizGrid with a
          ScoreTracker) and decides the structure itself, per topic — the whole composition arrives as a single
          AG-UI <code className="rounded bg-muted px-1 py-0.5 text-xs">CUSTOM</code> event, then renders through a
          json-render catalog registry. Try &ldquo;tic-tac-toe to learn fractions.&rdquo;
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
