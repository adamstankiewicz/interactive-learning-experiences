'use client';

import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Topic to student pathway</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter a topic. It resolves against the Learning Commons knowledge graph for the authoritative
          standard, its learning components, and its prerequisites — then becomes a pedagogical pathway
          with one interactive widget.
        </p>
      </header>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. understanding fractions"
            aria-label="Topic"
            className="h-10 flex-1"
          />
          <Input
            value={gradeHint}
            onChange={(event) => setGradeHint(event.target.value)}
            placeholder="grade (optional)"
            aria-label="Grade"
            className="h-10 sm:w-40"
          />
          <Button type="submit" size="lg" disabled={loading || !topic.trim()} className="h-10 px-5">
            {loading ? 'Building…' : 'Build'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setTopic(example)}
              className="rounded-full text-muted-foreground"
            >
              {example}
            </Button>
          ))}
        </div>
      </form>

      {loading && (
        <p className="mt-8 text-sm text-muted-foreground">
          Proposing standards, verifying against the graph, planning the pathway…
        </p>
      )}

      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
        <Card>
          <CardContent>
            <div className="flex flex-wrap items-baseline gap-2">
              <code className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {anchor.standard.statementCode}
              </code>
              <span className="text-xs text-muted-foreground">
                {anchor.standard.academicSubject} · grade {anchor.standard.gradeLevels.join(', ')} ·{' '}
                {anchor.standard.jurisdiction}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{plainMath(anchor.standard.description)}</p>
          </CardContent>
        </Card>
        {rejectedCodes.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Rejected by the graph before this one: {rejectedCodes.join(', ')}
          </p>
        )}
      </Section>

      <Section title="Big idea">
        <p className="text-sm leading-relaxed">{plan.bigIdea}</p>
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
            <li key={index}>
              <Card size="sm">
                <CardContent>
                  <p className="text-sm font-medium">{outcome.statement}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Evidence: {outcome.evidence}</p>
                  {outcome.learningComponentId && (
                    <p className="mt-2 text-[11px] text-muted-foreground/70">
                      LC {outcome.learningComponentId}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {anchor.prerequisites.length > 0 && (
        <Section title="Prior knowledge to activate" note="From the SAP coherence map">
          <ul className="space-y-2">
            {anchor.prerequisites.map((prerequisite) => (
              <li key={prerequisite.caseIdentifierUUID} className="text-sm">
                <code className="text-xs font-medium text-muted-foreground">
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
            <li key={index} className="text-sm">
              {misconception}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Pathway">
        <ol className="space-y-3">
          {plan.steps.map((step, index) => (
            <li key={index} className="flex gap-4">
              <span className="mt-0.5 h-6 shrink-0 rounded bg-muted px-2 text-xs leading-6 font-medium text-muted-foreground">
                {PURPOSE_LABEL[step.purpose] ?? step.purpose}
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Interactive widget">
        {widget ? (
          <WidgetRenderer spec={widget} />
        ) : (
          <Alert>
            <AlertDescription>{widgetNote}</AlertDescription>
          </Alert>
        )}
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">{title}</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}
