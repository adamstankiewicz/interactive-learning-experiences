'use client';

import { useState } from 'react';

import { ActivityTrail } from '@/components/pathway/ActivityTrail';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WidgetRenderer } from '@/components/widgets/registry';
import { plainMath } from '@/lib/learning-commons/format';
import type { Anchor } from '@/lib/pathway/events';
import { usePathwayStream, type PathwayState } from '@/lib/pathway/use-pathway-stream';

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
  const { state, start, cancel } = usePathwayStream();

  const streaming = state.status === 'streaming';
  const started = state.status !== 'idle';

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!topic.trim() || streaming) return;
    void start(topic, gradeHint);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Topic to student pathway</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter a topic. It resolves against the Learning Commons knowledge graph for the authoritative
          standard, its learning components, and its prerequisites — then becomes a pedagogical pathway
          with interactive widgets.
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
          {streaming ? (
            <Button type="button" variant="outline" size="lg" onClick={cancel} className="h-10 px-5">
              Stop
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={!topic.trim()} className="h-10 px-5">
              Build
            </Button>
          )}
        </div>

        {!started && (
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
        )}
      </form>

      {started && <ActivityTrail state={state} />}

      {state.error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Pathway state={state} />
    </div>
  );
}

/**
 * Renders whatever has arrived. Every section is independently gated on its own
 * data, so the page fills in as the stream produces rather than appearing all
 * at once at the end.
 */
function Pathway({ state }: { state: PathwayState }) {
  const { anchor, plan, widgets, widgetNotes } = state;
  const streaming = state.status === 'streaming';
  const writingPlan = streaming && state.stages.plan.status === 'active';

  if (!anchor) return null;

  const rejectedCodes = Object.entries(state.verdicts)
    .filter(([, resolved]) => !resolved)
    .map(([code]) => code);

  return (
    <div className="mt-8 space-y-8">
      <Section title="Anchor standard" note="Verified against the Learning Commons graph">
        <AnchorCard anchor={anchor} />
        {rejectedCodes.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Rejected by the graph before this one: {rejectedCodes.join(', ')}
          </p>
        )}
      </Section>

      {plan?.bigIdea && (
        <Section title="Big idea">
          <p className="text-sm leading-relaxed">
            {plan.bigIdea}
            {writingPlan && !plan.outcomes?.length && <Caret />}
          </p>
        </Section>
      )}

      {Boolean(plan?.outcomes?.length) && (
        <Section
          title="Learning outcomes"
          note={
            anchor.learningComponents.length
              ? `${anchor.learningComponents.length} learning components from the graph`
              : 'No published learning components for this standard'
          }
        >
          <ol className="space-y-3">
            {plan?.outcomes?.map((outcome, index) => (
              <li key={index}>
                <Card size="sm">
                  <CardContent>
                    <p className="text-sm font-medium">{outcome?.statement}</p>
                    {outcome?.evidence && (
                      <p className="mt-1 text-xs text-muted-foreground">Evidence: {outcome.evidence}</p>
                    )}
                    {outcome?.learningComponentId && (
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
                        LC {outcome.learningComponentId}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {anchor.prerequisites.length > 0 && (
        <Section title="Prior knowledge to activate" note="From the SAP coherence map">
          <ul className="space-y-2">
            {anchor.prerequisites.map((prerequisite) => (
              <li key={prerequisite.caseIdentifierUUID} className="text-sm">
                <code className="font-mono text-xs font-medium text-muted-foreground">
                  {prerequisite.statementCode}
                </code>{' '}
                {plainMath(prerequisite.description)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Boolean(plan?.misconceptions?.length) && (
        <Section title="Misconceptions to watch for">
          <ul className="list-disc space-y-1.5 pl-5">
            {plan?.misconceptions?.map((misconception, index) => (
              <li key={index} className="text-sm">
                {misconception}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Boolean(plan?.steps?.length) && (
        <Section title="Pathway">
          {/* Fixed left gutter for the purpose label — the sequence reads down
              the column, which a per-item pill does not give you. */}
          <ol className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {plan?.steps?.map((step, index) => (
              <li
                key={index}
                className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:gap-4"
              >
                <span className="shrink-0 pt-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:w-20">
                  {(step?.purpose && PURPOSE_LABEL[step.purpose]) ?? step?.purpose}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step?.title}</p>
                  {step?.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {(widgets.length > 0 || widgetNotes.length > 0) && (
        <Section
          title={widgets.length === 1 ? 'Interactive widget' : 'Interactive widgets'}
          note={widgets.length > 1 ? `${widgets.length} generated for this standard` : undefined}
        >
          <div className="space-y-4">
            {widgets.map((widget, index) => (
              <WidgetRenderer key={index} spec={widget} />
            ))}
            {widgetNotes.map((note, index) => (
              <Alert key={index}>
                <AlertDescription>{note}</AlertDescription>
              </Alert>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function AnchorCard({ anchor }: { anchor: Anchor }) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-2">
          <code className="rounded bg-primary px-2 py-0.5 font-mono text-xs font-medium text-primary-foreground">
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
  );
}

/** Marks the text the model is still writing. */
function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-foreground"
    />
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
