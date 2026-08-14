'use client';

import { useState } from 'react';

import { WidgetRenderer } from '@/components/widgets/registry';
import { plainMath } from '@/lib/learning-commons/format';
import type { PathwayResult } from '@/lib/pathway/generate';

const EXAMPLES = ['understanding fractions', 'multiplying by powers of ten', 'finding the main idea of a text'];

const PURPOSE_LABEL: Record<string, string> = {
  activate: 'Activate',
  model: 'Model',
  practice: 'Practice',
  check: 'Check',
};

export function PathwayBuilder() {
  const [topic, setTopic] = useState('');
  const [gradeHint, setGradeHint] = useState('');
  const [result, setResult] = useState<PathwayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/pathway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, gradeHint }),
      });
      const data = await response.json();

      if (!response.ok) setError(data.error ?? 'Something went wrong.');
      else setResult(data as PathwayResult);
    } catch {
      setError('Could not reach the pathway service.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Topic to student pathway
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Enter a topic. It resolves against the Learning Commons knowledge graph for the authoritative
          standard, its learning components, and its prerequisites — then becomes a pedagogical pathway
          with one interactive widget.
        </p>
      </header>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. understanding fractions"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300"
          />
          <input
            value={gradeHint}
            onChange={(event) => setGradeHint(event.target.value)}
            placeholder="grade (optional)"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 sm:w-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300"
          />
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {loading ? 'Building…' : 'Build'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setTopic(example)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {loading && (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
          Proposing standards, verifying against the graph, planning the pathway…
        </p>
      )}

      {error && (
        <div className="mt-8 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
          {error}
        </div>
      )}

      {result && <Pathway result={result} />}
    </div>
  );
}

function Pathway({ result }: { result: PathwayResult }) {
  const { anchor, plan, widget, widgetNote, rejectedCodes } = result;

  return (
    <div className="mt-10 space-y-8">
      <Section title="Anchor standard" note="Verified against the Learning Commons graph">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-baseline gap-2">
            <code className="rounded bg-slate-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
              {anchor.standard.statementCode}
            </code>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {anchor.standard.academicSubject} · grade {anchor.standard.gradeLevels.join(', ')} ·{' '}
              {anchor.standard.jurisdiction}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {plainMath(anchor.standard.description)}
          </p>
        </div>
        {rejectedCodes.length > 0 && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            Rejected by the graph before this one: {rejectedCodes.join(', ')}
          </p>
        )}
      </Section>

      <Section title="Big idea">
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{plan.bigIdea}</p>
      </Section>

      <Section
        title="Learning outcomes"
        note={
          anchor.learningComponents.length
            ? `${anchor.learningComponents.length} learning components from the graph`
            : 'No published learning components for this standard'
        }
      >
        <ol className="space-y-3">
          {plan.outcomes.map((outcome, index) => (
            <li
              key={index}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{outcome.statement}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Evidence: {outcome.evidence}</p>
              {outcome.learningComponentId && (
                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-600">
                  LC {outcome.learningComponentId}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {anchor.prerequisites.length > 0 && (
        <Section title="Prior knowledge to activate" note="From the SAP coherence map">
          <ul className="space-y-2">
            {anchor.prerequisites.map((prerequisite) => (
              <li key={prerequisite.caseIdentifierUUID} className="text-sm text-slate-700 dark:text-slate-300">
                <code className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {prerequisite.statementCode}
                </code>{' '}
                {plainMath(prerequisite.description)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Misconceptions to watch for">
        <ul className="list-disc space-y-1.5 pl-5">
          {plan.misconceptions.map((misconception, index) => (
            <li key={index} className="text-sm text-slate-700 dark:text-slate-300">
              {misconception}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Pathway">
        <ol className="space-y-3">
          {plan.steps.map((step, index) => (
            <li key={index} className="flex gap-4">
              <span className="mt-0.5 h-6 shrink-0 rounded bg-slate-100 px-2 text-xs leading-6 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {PURPOSE_LABEL[step.purpose] ?? step.purpose}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{step.title}</p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Interactive widget">
        {widget ? (
          <WidgetRenderer spec={widget} />
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {widgetNote}
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
          {title}
        </h2>
        {note && <span className="text-xs text-slate-500 dark:text-slate-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}
