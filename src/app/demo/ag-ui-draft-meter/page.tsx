'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { JSONUIProvider, Renderer, createStateStore, useStateValue, type Spec } from '@json-render/react';

import { computedFunctions, registry } from '@/lib/ag-ui-prototype/catalog';

/**
 * Phase 3a research prototype — draft-meter's continuous re-score loop
 * rendered through a json-render catalog, fed by a real `@ag-ui/core` event
 * stream (`/api/ag-ui/draft-meter`) instead of this app's bespoke NDJSON
 * shape. Deliberately isolated: nothing here touches `DraftMeter.tsx` or the
 * production `/api/pathway` pipeline. See the plan doc's Phase 3a section for
 * why this specific widget is the one to prototype first.
 */

const DEBOUNCE_MS = 1500;

const QUESTION = {
  question: 'Should our school start at 8:45? Say what you think — and why.',
  standardCode: 'W.8.1',
  standardDescription: 'Write arguments to support claims with clear reasons and relevant evidence.',
  criteria: [
    'takes a clear position on the question asked',
    'gives a reason that actually supports the position',
    'points to evidence outside the writer’s own opinion',
    'stays on the question rather than drifting to a related one',
  ],
  passage: null as { source: string; text: string } | null,
};

/** Every path the server ever patches, present from the start so the server's `replace` ops are always valid. */
const spec: Spec = {
  root: 'meter',
  elements: {
    meter: {
      type: 'ScoreMeter',
      props: {
        fill: { $computed: 'meterFill', args: { checking: { $state: '/checking' }, score: { $state: '/score' } } },
        tone: { $computed: 'meterTone', args: { checking: { $state: '/checking' }, band: { $state: '/band' } } },
        label: { $computed: 'meterLabel', args: { checking: { $state: '/checking' }, label: { $state: '/label' } } },
        checking: { $state: '/checking' },
      },
      children: [],
    },
  },
};

export default function AgUiDraftMeterPrototype() {
  const [text, setText] = useState('');
  const [runError, setRunError] = useState<string | null>(null);
  // Lazy `useState`, not `useRef`: the store must be created exactly once and
  // stay stable across renders (same reasons as a ref), but its value is read
  // directly during render (passed to `JSONUIProvider` below) — a ref's
  // `.current` is off-limits there, a state value is exactly what render is for.
  const [store] = useState(() =>
    createStateStore({ score: null, band: null, label: '', criteriaMet: false, nudge: null, checking: false }),
  );

  const seq = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  function handleChange(value: string) {
    setText(value);
    if (value.trim()) return;

    seq.current += 1;
    inFlight.current?.abort();
    store.update({
      '/score': null,
      '/band': null,
      '/label': '',
      '/criteriaMet': false,
      '/nudge': null,
      '/checking': false,
    });
    setRunError(null);
  }

  useEffect(() => {
    const draft = text.trim();
    if (!draft) return;

    const timer = setTimeout(() => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      const id = ++seq.current;

      void runScore(draft, controller.signal, {
        onRunStarted: () => {
          if (id !== seq.current) return;
          store.set('/checking', true);
          setRunError(null);
        },
        onDelta: (ops) => {
          if (id !== seq.current) return;
          for (const op of ops) store.set(op.path, op.value);
        },
        onRunFinished: () => {
          if (id !== seq.current) return;
          store.set('/checking', false);
        },
        onRunError: (message) => {
          if (id !== seq.current) return;
          store.set('/checking', false);
          setRunError(message);
        },
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `store` is a stable ref-held instance, not render state
  }, [text]);

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
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Draft Meter, on AG-UI + json-render</h1>
        <p className="mt-2 text-muted-foreground">
          Same scoring logic as the real Draft Meter widget, but every re-score arrives as a genuine{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">@ag-ui/core</code> event stream — RUN_STARTED →
          STATE_DELTA (RFC 6902 patch) → RUN_FINISHED — and the meter itself renders from a{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">json-render</code> catalog entry, not hand-written
          React. This is the trickiest of the six widgets to migrate — it has no single terminal &ldquo;done&rdquo;
          turn — so it&rsquo;s the one prototyped first.
        </p>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-base leading-[1.4] font-semibold">{QUESTION.question}</p>

        <textarea
          value={text}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="Write a few sentences…"
          rows={3}
          className="mt-4 block min-h-[92px] w-full resize-y rounded-lg border border-input bg-transparent p-3.5 text-sm leading-[1.6] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
        />

        <div className="mt-5">
          <JSONUIProvider registry={registry} store={store} functions={computedFunctions}>
            <Renderer spec={spec} registry={registry} />
            <NudgeLine />
          </JSONUIProvider>
        </div>

        {runError && <p className="mt-3 text-xs text-destructive">{runError}</p>}
      </div>
    </main>
  );
}

/** Reads the same store the catalog renders from — ordinary React, proving the store is a shared source of truth, not catalog-only. */
function NudgeLine() {
  const nudge = useStateValue<string | null>('/nudge');
  const criteriaMet = useStateValue<boolean>('/criteriaMet');

  if (criteriaMet) {
    return (
      <p className="mt-3 inline-block rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
        That&apos;s all three — a side, a reason, and evidence.
      </p>
    );
  }
  if (!nudge) return null;
  return <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-snug">{nudge}</p>;
}

type DeltaOp = { op: string; path: string; value: unknown };

async function runScore(
  draft: string,
  signal: AbortSignal,
  handlers: {
    onRunStarted: () => void;
    onDelta: (ops: DeltaOp[]) => void;
    onRunFinished: () => void;
    onRunError: (message: string) => void;
  },
) {
  try {
    const response = await fetch('/api/ag-ui/draft-meter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: draft, ...QUESTION }),
      signal,
    });

    if (!response.body) {
      handlers.onRunError('No response stream.');
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
        let event: { type: string; delta?: DeltaOp[]; message?: string };
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }

        if (event.type === 'RUN_STARTED') handlers.onRunStarted();
        else if (event.type === 'STATE_DELTA') handlers.onDelta(event.delta ?? []);
        else if (event.type === 'RUN_FINISHED') handlers.onRunFinished();
        else if (event.type === 'RUN_ERROR') handlers.onRunError(event.message ?? 'Scoring failed.');
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    handlers.onRunError('Could not reach the scoring service.');
  }
}
