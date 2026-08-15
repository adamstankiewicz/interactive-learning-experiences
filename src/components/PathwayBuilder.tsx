"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";

import { ActivityTrail } from "@/components/pathway/ActivityTrail";
import {
  LessonPlanUpload,
  type LessonPlanPick,
} from "@/components/pathway/LessonPlanUpload";
import { PathwayCompletionStrip, PathwayDocument } from "@/components/pathway/PathwayDocument";
import { AssignToStudents } from "@/components/roster/AssignToStudents";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { usePathwayStream } from "@/lib/pathway/use-pathway-stream";

const EXAMPLES = [
  { topic: "understanding fractions", grade: "4" },
  { topic: "multiplying by powers of ten", grade: "5" },
  { topic: "finding the main idea of a text", grade: "5" },
];

/** "Any grade" has to be a real Select value — Base UI doesn't allow "". */
const ANY_GRADE = "any";
const GRADE_OPTIONS = [
  "K",
  ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
];

/**
 * Base UI's SelectValue shows the raw value string unless told otherwise — it
 * has no built-in way to look up a SelectItem's label. Centralizing the
 * mapping here keeps the trigger's display and the dropdown's item text from
 * drifting apart.
 */
function gradeLabel(grade: string): string {
  if (grade === ANY_GRADE) return "Any grade";
  return grade === "K" ? "Kindergarten" : `Grade ${grade}`;
}

/**
 * A lesson plan's extracted grade level is free text from the model — "4",
 * "Grade 3", "middle school", "4-5". The select only has exact values, so
 * this maps loosely rather than rejecting anything that isn't a bare digit.
 * Falls back to no hint rather than guessing wrong.
 */
function normalizeGrade(raw: string): string {
  if (/^k(indergarten)?$/i.test(raw.trim())) return "K";
  const match = raw.match(/\d+/);
  if (!match) return "";
  const grade = Number(match[0]);
  return grade >= 1 && grade <= 12 ? String(grade) : "";
}

/**
 * The same warm, chunky visual language `/learn` uses on students — violet/
 * pink/amber, spring motion, a pressed-button physicality — carried over for
 * a teacher, not copied wholesale: this page is a workspace someone reads and
 * edits for minutes, not a one-shot tap-through, so the gradient here is an
 * ambient wash rather than full-bleed saturation, and dark mode (which
 * `/learn` opts out of entirely via `.light-surface`) still works.
 */
export function PathwayBuilder() {
  const teacherNoteId = useId();
  const [topic, setTopic] = useState("");
  const [gradeHint, setGradeHint] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  /** The uploaded plan behind the current topic, sent along when building. */
  const [lessonPlan, setLessonPlan] = useState<{
    filename: string;
    excerpt: string;
  } | null>(null);
  /**
   * Whether the note currently in the box was filled from a lesson plan rather
   * than typed. Picking a different topic should replace a note that came from
   * the previous chip — it describes the wrong topic now — but must never
   * overwrite a sentence the teacher wrote themselves.
   */
  const noteFromLessonPlan = useRef(false);
  const { state, start, cancel, regenerateStep, editPlan } = usePathwayStream();

  const streaming = state.status === "streaming";
  const started = state.status !== "idle";
  // Topic is the one thing this page asks first — it's the variable a
  // teacher is actively deciding day to day; grade is usually a fixed fact
  // about them, so it (and the submit action) only earns screen space once
  // there's actually a topic to attach it to. Mirrors `/learn`'s one-question
  // focus rather than presenting every field as equally important at once.
  const engaged = started || Boolean(topic.trim());

  function runSubmit() {
    if (!topic.trim() || streaming) return;
    void start(
      topic,
      gradeHint,
      teacherNote.trim() || undefined,
      lessonPlan?.excerpt,
    );
  }

  function pickFromLessonPlan(pick: LessonPlanPick) {
    setTopic(pick.topic);
    setGradeHint(normalizeGrade(pick.gradeLevel));
    setLessonPlan({ filename: pick.filename, excerpt: pick.excerpt });

    if (!teacherNote.trim() || noteFromLessonPlan.current) {
      // Assigns even when the plan said nothing about this topic: clearing a
      // stale note beats carrying the previous topic's difficulty forward.
      setTeacherNote(pick.teacherNote);
      noteFromLessonPlan.current = Boolean(pick.teacherNote);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    runSubmit();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-violet-100/80 via-pink-50/60 to-amber-50/70 dark:from-violet-950/50 dark:via-fuchsia-950/25 dark:to-amber-950/20">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20">
        {!started && (
          <div className="pt-14">
            <motion.h1
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="font-(family-name:--font-lexend) text-4xl font-black tracking-tight text-balance sm:text-5xl"
            >
              Turn a topic into a lesson{" "}
              <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-pink-400">
                students can do
              </span>
              .
            </motion.h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
              Name what you&rsquo;re teaching. We find the standard it maps to
              in the Learning Commons knowledge graph, then build a pathway from
              its verified learning components — with interactive activities
              your students work through.
            </p>
          </div>
        )}

        <form onSubmit={submit} className={started ? "pt-8" : "mt-8"}>
          {/* One question first: what. Grade, the submit action, and every
              optional field only earn space once there's a topic to hang
              them off — the opening moment is a single focused decision,
              not a five-field form presented all at once. */}
          <Textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            onKeyDown={(event) => {
              // Enter submits like a chat input; Shift+Enter still writes a
              // newline for a teacher who wants to give real context.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                runSubmit();
              }
            }}
            placeholder="What are you teaching?"
            aria-label="Topic"
            rows={1}
            className="min-h-16 w-full resize-none rounded-2xl border-3 border-violet-200 bg-white/70 px-5 py-4 text-lg font-semibold placeholder:font-normal placeholder:text-violet-300 focus-visible:border-violet-400 focus-visible:ring-violet-300/50 dark:border-violet-800 dark:bg-white/5 dark:placeholder:text-violet-700 dark:focus-visible:border-violet-500"
          />

          {!engaged && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                ✨ Or start from an example
              </p>
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
                      // An example has nothing to do with the uploaded plan,
                      // so building from one must not cite it.
                      setLessonPlan(null);
                    }}
                    className="rounded-full border-2 border-violet-200 font-normal text-violet-600 hover:border-violet-300 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
                  >
                    {example.topic}
                    <span className="text-violet-400 dark:text-violet-500">
                      · Gr {example.grade}
                    </span>
                  </Button>
                ))}
              </div>
              <LessonPlanUpload
                disabled={streaming}
                onPick={pickFromLessonPlan}
                onClear={() => setLessonPlan(null)}
              />
              {lessonPlan && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Building with{" "}
                  <span className="font-medium text-foreground">{lessonPlan.filename}</span>{" "}
                  as context — the pathway follows how your plan teaches this.
                </p>
              )}
            </div>
          )}

          <AnimatePresence initial={false}>
            {engaged && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                // `overflow-hidden` is required for the height animation, but it
                // also clips paint effects that extend past the layout box —
                // the pressed-button shadow on "Build pathway"/"Rebuild" is one.
                // Bottom padding here (not on the row below) pulls the auto
                // height calculation out far enough that the shadow fits inside
                // the clipped box instead of getting cut off.
                className="overflow-hidden pb-1.5"
              >
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <Select
                    value={gradeHint || ANY_GRADE}
                    onValueChange={(value) =>
                      setGradeHint(!value || value === ANY_GRADE ? "" : value)
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        "h-12! w-full rounded-xl border-2 border-violet-200 bg-white/70 px-4 text-sm font-semibold hover:bg-white/90 dark:border-violet-800 dark:bg-white/5 dark:hover:bg-white/10 sm:w-40",
                        !gradeHint
                          ? "text-muted-foreground"
                          : "text-violet-700 dark:text-violet-300",
                      )}
                      aria-label="Grade level"
                    >
                      <SelectValue>
                        {(value: string | null) => gradeLabel(value ?? ANY_GRADE)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="p-1.5">
                      <SelectItem value={ANY_GRADE}>
                        {gradeLabel(ANY_GRADE)}
                      </SelectItem>
                      {GRADE_OPTIONS.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {gradeLabel(grade)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {streaming ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancel}
                      className="h-12 rounded-xl border-2 px-6 text-sm font-semibold"
                    >
                      Stop
                    </Button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!topic.trim()}
                      className="h-12 shrink-0 rounded-xl bg-emerald-500 px-6 text-sm font-black text-white shadow-[0_4px_0_0_#047857] transition-transform hover:bg-emerald-400 active:translate-y-1 active:shadow-[0_1px_0_0_#047857] disabled:pointer-events-none disabled:opacity-40"
                    >
                      {started ? "Rebuild ↻" : "Build pathway →"}
                    </button>
                  )}
                </div>

                {!started && (
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    The more specific the topic, the better the match — e.g.
                    &ldquo;comparing fractions with unlike denominators,&rdquo; not
                    just &ldquo;fractions.&rdquo;
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!started && (
            <Collapsible className="mt-4">
              <CollapsibleTrigger className="group/detail flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Plus className="size-3.5 transition-transform group-data-panel-open/detail:rotate-45" />
                Add detail
                <span className="text-muted-foreground/60">(optional, but it sharpens the pathway)</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <label htmlFor={teacherNoteId} className="sr-only">
                  What&rsquo;s tricky about this for your students?
                </label>
                <Textarea
                  id={teacherNoteId}
                  value={teacherNote}
                  onChange={(event) => {
                    setTeacherNote(event.target.value);
                    noteFromLessonPlan.current = false;
                  }}
                  placeholder="What's tricky about this for your students? e.g. they mix up numerator and denominator when the fraction is improper"
                  rows={1}
                  className="mt-2 min-h-10 resize-none py-2 text-sm"
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </form>

        {started && <ActivityTrail state={state} />}

        {state.error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <PathwayCompletionStrip state={state} />

        {state.status === "done" && (
          <AssignToStudents
            topic={state.topic}
            gradeHint={gradeHint || undefined}
            parentSessionId={state.sessionId ?? undefined}
          />
        )}

        <PathwayDocument
          state={state}
          onRegenerateStep={regenerateStep}
          onEditPlan={editPlan}
        />
      </main>
    </div>
  );
}
