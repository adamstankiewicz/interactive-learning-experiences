'use client';

import { useId, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { ActivityTrail } from '@/components/pathway/ActivityTrail';
import { PathwayDocument } from '@/components/pathway/PathwayDocument';
import { ShareLink } from '@/components/pathway/ShareLink';
import { ThemeToggle } from '@/components/pathway/ThemeToggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePathwayStream } from '@/lib/pathway/use-pathway-stream';

const EXAMPLES = [
  { topic: 'understanding fractions', grade: '4' },
  { topic: 'multiplying by powers of ten', grade: '5' },
  { topic: 'finding the main idea of a text', grade: '5' },
];

/** "Any grade" has to be a real Select value — Base UI doesn't allow "". */
const ANY_GRADE = 'any';
const GRADE_OPTIONS = ['K', ...Array.from({ length: 12 }, (_, i) => String(i + 1))];

/**
 * Base UI's SelectValue shows the raw value string unless told otherwise — it
 * has no built-in way to look up a SelectItem's label. Centralizing the
 * mapping here keeps the trigger's display and the dropdown's item text from
 * drifting apart.
 */
function gradeLabel(grade: string): string {
  if (grade === ANY_GRADE) return 'Any grade';
  return grade === 'K' ? 'Kindergarten' : `Grade ${grade}`;
}

export function PathwayBuilder() {
  const teacherNoteId = useId();
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState('');
  const [gradeHint, setGradeHint] = useState('');
  const [teacherNote, setTeacherNote] = useState('');
  const { state, start, cancel, regenerateStep, editPlan } = usePathwayStream();

  const streaming = state.status === 'streaming';
  const started = state.status !== 'idle';

  // Pre-fill form from URL parameters
  useEffect(() => {
    const topicParam = searchParams.get('topic');
    const gradeParam = searchParams.get('grade');

    if (topicParam && !topic) {
      setTopic(topicParam);
    }
    if (gradeParam && !gradeHint) {
      setGradeHint(gradeParam);
    }

    // Auto-submit if both params present and not already started
    if (topicParam && gradeParam && !started && !streaming) {
      setTimeout(() => {
        start(topicParam, gradeParam, undefined);
      }, 100);
    }
  }, [searchParams, topic, gradeHint, started, streaming, start]);

  function runSubmit() {
    if (!topic.trim() || streaming) return;
    void start(topic, gradeHint, teacherNote.trim() || undefined);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    runSubmit();
  }

  return (
    // The same warm identity /learn's saturated gradient carries, at a
    // register suited to lesson-planning rather than tapping through an
    // activity: a faint wash of the existing --primary/--success tokens
    // (2-3% alpha) over the base background, not new colors — low enough
    // opacity that foreground-text contrast against it is effectively
    // unchanged from the flat --background it replaces.
    <div className="flex min-h-full flex-col bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_3%,var(--background)),var(--background)_60%)]">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-3">
          <span className="font-heading text-sm font-semibold tracking-tight text-primary">
            Pathways
          </span>
          <span className="text-xs text-muted-foreground">Standards-grounded lessons</span>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/upload">
              <Button variant="outline" size="sm">
                Upload File
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20">
        {!started && (
          <div className="pt-14">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
              Turn a topic into a lesson <span className="text-primary">students can do</span>.
            </h1>
            <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
              Name what you&rsquo;re teaching. We find the standard it maps to in the Learning
              Commons knowledge graph, then build a pathway from its verified learning
              components — with interactive activities your students work through.
            </p>
          </div>
        )}

        <form onSubmit={submit} className={started ? 'pt-8' : 'mt-8'}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              onKeyDown={(event) => {
                // Enter submits like a chat input; Shift+Enter still writes a
                // newline for a teacher who wants to give real context.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  runSubmit();
                }
              }}
              placeholder="What are you teaching?"
              aria-label="Topic"
              rows={1}
              className="min-h-11 flex-1 resize-none py-2.5 text-base"
            />
            <Select
              value={gradeHint || ANY_GRADE}
              onValueChange={(value) => setGradeHint(!value || value === ANY_GRADE ? '' : value)}
            >
              <SelectTrigger className={`h-11! w-full sm:w-40 text-sm bg-transparent dark:bg-transparent dark:hover:bg-transparent border-input/50 ${!gradeHint ? 'text-muted-foreground' : ''}`} aria-label="Grade level">
                <SelectValue>{(value: string | null) => gradeLabel(value ?? ANY_GRADE)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="p-1.5">
                <SelectItem value={ANY_GRADE}>{gradeLabel(ANY_GRADE)}</SelectItem>
                {GRADE_OPTIONS.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {gradeLabel(grade)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                The more specific the topic, the better the match — e.g. &ldquo;comparing
                fractions with unlike denominators,&rdquo; not just &ldquo;fractions.&rdquo;
              </p>
            </div>
          )}

          {!started && (
            <div className="mt-4">
              <label htmlFor={teacherNoteId} className="text-xs text-muted-foreground">
                What&rsquo;s tricky about this for your students?{' '}
                <span className="text-muted-foreground/60">(optional, but it sharpens the pathway)</span>
              </label>
              <Textarea
                id={teacherNoteId}
                value={teacherNote}
                onChange={(event) => setTeacherNote(event.target.value)}
                placeholder="e.g. they mix up numerator and denominator when the fraction is improper"
                rows={1}
                className="mt-1.5 min-h-10 resize-none py-2 text-sm"
              />
            </div>
          )}

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

        {state.status === 'done' && state.sessionId && <ShareLink sessionId={state.sessionId} />}

        <PathwayDocument state={state} onRegenerateStep={regenerateStep} onEditPlan={editPlan} />
      </main>
    </div>
  );
}
