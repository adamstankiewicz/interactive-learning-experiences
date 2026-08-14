'use client';

import { useState } from 'react';

import { ActivityTrail } from '@/components/pathway/ActivityTrail';
import { PathwayDocument } from '@/components/pathway/PathwayDocument';
import { ThemeToggle } from '@/components/pathway/ThemeToggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePathwayStream } from '@/lib/pathway/use-pathway-stream';

const EXAMPLES = [
  { topic: 'understanding fractions', grade: '4' },
  { topic: 'multiplying by powers of ten', grade: '5' },
  { topic: 'finding the main idea of a text', grade: '5' },
];

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
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-3">
          <span className="font-heading text-sm font-semibold tracking-tight">
            Pathways
          </span>
          <span className="text-xs text-muted-foreground">Standards-grounded lessons</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20">
        {!started && (
          <div className="pt-14">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
              Turn a topic into a lesson students can do.
            </h1>
            <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
              Name what you&rsquo;re teaching. We find the standard it maps to in the Learning
              Commons knowledge graph, then build a pathway from its verified learning
              components — with interactive activities your students work through.
            </p>
          </div>
        )}

        <form onSubmit={submit} className={started ? 'pt-8' : 'mt-8'}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="What are you teaching?"
              aria-label="Topic"
              className="h-11 flex-1 text-base"
            />
            <Input
              value={gradeHint}
              onChange={(event) => setGradeHint(event.target.value)}
              placeholder="Grade"
              aria-label="Grade level"
              className="h-11 text-base sm:w-28"
            />
            {streaming ? (
              <Button type="button" variant="outline" size="lg" onClick={cancel} className="h-11 px-6">
                Stop
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={!topic.trim()} className="h-11 px-6">
                {started ? 'Rebuild' : 'Build pathway'}
              </Button>
            )}
          </div>

          {!started && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">Or start from an example</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <Button
                    key={example.topic}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTopic(example.topic);
                      setGradeHint(example.grade);
                    }}
                    className="rounded-full font-normal text-muted-foreground"
                  >
                    {example.topic}
                    <span className="text-muted-foreground/60">· Gr {example.grade}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </form>

        {started && <ActivityTrail state={state} />}

        {state.error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <PathwayDocument state={state} />
      </main>
    </div>
  );
}
