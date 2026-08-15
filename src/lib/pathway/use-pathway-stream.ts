'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  STAGES,
  type Anchor,
  type Candidate,
  type DeepPartial,
  type PathwayEvent,
  type StageId,
} from '@/lib/pathway/events';
import type { PathwayPlan, WidgetSpec } from '@/lib/pathway/schema';

export type StageStatus = 'pending' | 'active' | 'done' | 'skipped';

export type PathwayState = {
  status: 'idle' | 'streaming' | 'done' | 'error';
  /** The topic this run was started for, so the result can title itself. */
  topic: string;
  stages: Record<StageId, { status: StageStatus; detail?: string }>;
  candidates: Candidate[];
  /** code -> did the graph resolve it. Absent means not yet checked. */
  verdicts: Record<string, boolean>;
  anchor: Anchor | null;
  /** Partial while the model writes, replaced by the validated plan at the end. */
  plan: DeepPartial<PathwayPlan> | null;
  /**
   * Widget per step index, arriving one at a time as each is configured. A
   * missing key means not yet arrived — every step gets a widget eventually,
   * so there is no other reason for a key to be absent once the run finishes.
   */
  stepWidgets: Record<number, WidgetSpec>;
  /** Why a step's widget is a substitution, keyed the same way. */
  stepWidgetNotes: Record<number, string>;
  /** True while a single step's widget is being redone in place. */
  regeneratingSteps: Record<number, boolean>;
  /** A regenerate call that failed, keyed by step index — cleared on retry. */
  stepErrors: Record<number, string>;
  /** Set once the run is persisted; null when the write didn't happen. */
  sessionId: string | null;
  /** Why there is no `sessionId`, so an absent share link can explain itself. */
  sessionError: string | null;
  error: string | null;
  /**
   * Run timing. Timestamps are taken in event handlers and passed in, so the
   * reducer stays pure and nothing reads the clock during render.
   */
  startedAt: number | null;
  finishedAt: number | null;
};

const idleStages = () =>
  Object.fromEntries(STAGES.map((s) => [s.id, { status: 'pending' as StageStatus }])) as PathwayState['stages'];

const initialState: PathwayState = {
  status: 'idle',
  topic: '',
  stages: idleStages(),
  candidates: [],
  verdicts: {},
  anchor: null,
  plan: null,
  stepWidgets: {},
  stepWidgetNotes: {},
  regeneratingSteps: {},
  stepErrors: {},
  sessionId: null,
  sessionError: null,
  error: null,
  startedAt: null,
  finishedAt: null,
};

type Action =
  | { kind: 'start'; at: number; topic: string }
  /** Stop streaming but keep whatever already arrived on screen. */
  | { kind: 'stop'; at: number }
  | { kind: 'event'; event: PathwayEvent; at: number }
  | { kind: 'regenerate-start'; stepIndex: number }
  | { kind: 'regenerate-done'; stepIndex: number; widget: WidgetSpec; note: string | null }
  | { kind: 'regenerate-error'; stepIndex: number; message: string }
  /** A hand-edit to a prose field — only valid once `plan` is the full, validated thing. */
  | { kind: 'edit-plan'; plan: PathwayPlan };

function withoutKey<T>(record: Record<number, T>, key: number): Record<number, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function reducer(state: PathwayState, action: Action): PathwayState {
  if (action.kind === 'start') {
    return { ...initialState, status: 'streaming', startedAt: action.at, topic: action.topic };
  }
  if (action.kind === 'stop') {
    return {
      ...state,
      status: 'done',
      finishedAt: action.at,
      // Leave finished stages alone; only the one in flight is abandoned.
      stages: Object.fromEntries(
        Object.entries(state.stages).map(([id, entry]) => [
          id,
          entry.status === 'active' ? { ...entry, status: 'skipped' as StageStatus } : entry,
        ]),
      ) as PathwayState['stages'],
    };
  }

  if (action.kind === 'regenerate-start') {
    return {
      ...state,
      regeneratingSteps: { ...state.regeneratingSteps, [action.stepIndex]: true },
      stepErrors: withoutKey(state.stepErrors, action.stepIndex),
    };
  }
  if (action.kind === 'regenerate-done') {
    return {
      ...state,
      stepWidgets: { ...state.stepWidgets, [action.stepIndex]: action.widget },
      stepWidgetNotes: action.note
        ? { ...state.stepWidgetNotes, [action.stepIndex]: action.note }
        : withoutKey(state.stepWidgetNotes, action.stepIndex),
      regeneratingSteps: { ...state.regeneratingSteps, [action.stepIndex]: false },
      stepErrors: withoutKey(state.stepErrors, action.stepIndex),
    };
  }
  if (action.kind === 'regenerate-error') {
    return {
      ...state,
      regeneratingSteps: { ...state.regeneratingSteps, [action.stepIndex]: false },
      stepErrors: { ...state.stepErrors, [action.stepIndex]: action.message },
    };
  }
  if (action.kind === 'edit-plan') {
    return { ...state, plan: action.plan };
  }

  const event = action.event;

  switch (event.type) {
    case 'stage':
      return {
        ...state,
        stages: {
          ...state.stages,
          [event.stage]: { status: event.status, detail: event.detail },
        },
      };
    case 'candidates':
      return { ...state, candidates: event.candidates };
    case 'verdict':
      return { ...state, verdicts: { ...state.verdicts, [event.code]: event.resolved } };
    case 'anchor':
      return { ...state, anchor: event.anchor };
    case 'plan-partial':
      return { ...state, plan: event.plan };
    case 'plan':
      return { ...state, plan: event.plan };
    case 'step-widget':
      return {
        ...state,
        stepWidgets: { ...state.stepWidgets, [event.stepIndex]: event.widget },
        stepWidgetNotes: event.note
          ? { ...state.stepWidgetNotes, [event.stepIndex]: event.note }
          : state.stepWidgetNotes,
      };
    case 'session':
      return { ...state, sessionId: event.sessionId, sessionError: event.reason ?? null };
    case 'error':
      return { ...state, status: 'error', error: event.message, finishedAt: action.at };
    case 'done':
      return { ...state, status: 'done', finishedAt: action.at };
  }
}

/**
 * Consumes the NDJSON event stream from `/api/pathway`.
 *
 * Every event is additive, so the UI can render whatever has arrived without
 * waiting for the rest — that is the whole point of the protocol.
 */
export function usePathwayStream() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  // Abort an in-flight generation if the component goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ kind: 'stop', at: Date.now() });
  }, []);

  // Same anonymous identity `/learn` mints and caches — one per browser,
  // shared across both surfaces. Without one, `/api/pathway` has nothing to
  // call `persistSession` with, and a build here produces nothing to share.
  const studentIdRef = useRef<string | null>(
    typeof window === 'undefined' ? null : localStorage.getItem('studentId'),
  );

  const ensureStudentId = useCallback(async (): Promise<string | null> => {
    if (studentIdRef.current) return studentIdRef.current;

    try {
      const response = await fetch('/api/student', { method: 'POST' });
      if (!response.ok) return null;
      const data = (await response.json()) as { studentId?: string };
      if (!data.studentId) return null;

      localStorage.setItem('studentId', data.studentId);
      studentIdRef.current = data.studentId;
      return data.studentId;
    } catch {
      return null;
    }
  }, []);

  const start = useCallback(async (topic: string, gradeHint: string, teacherNote?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ kind: 'start', at: Date.now(), topic });

    try {
      const studentId = await ensureStudentId();
      const response = await fetch('/api/pathway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, gradeHint, studentId, teacherNote }),
        signal: controller.signal,
      });

      if (!response.body) {
        dispatch({
          kind: 'event',
          event: { type: 'error', message: 'No response stream.' },
          at: Date.now(),
        });
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += value;

        // Everything before the last newline is a set of complete events; the
        // remainder is a partial line waiting for the next chunk.
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            dispatch({ kind: 'event', event: JSON.parse(line) as PathwayEvent, at: Date.now() });
          } catch {
            // A truncated line is not worth failing the whole run over.
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      dispatch({
        kind: 'event',
        event: { type: 'error', message: 'Could not reach the pathway service.' },
        at: Date.now(),
      });
    }
  }, [ensureStudentId]);

  const regenerateStep = useCallback(async (anchor: Anchor, plan: PathwayPlan, stepIndex: number) => {
    dispatch({ kind: 'regenerate-start', stepIndex });

    try {
      const response = await fetch('/api/pathway/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchor, plan, stepIndex }),
      });

      const body = (await response.json().catch(() => null)) as
        | { widget: WidgetSpec; note: string | null }
        | { message: string }
        | null;

      if (!response.ok || !body || !('widget' in body)) {
        throw new Error(body && 'message' in body ? body.message : 'Could not regenerate this step.');
      }

      dispatch({ kind: 'regenerate-done', stepIndex, widget: body.widget, note: body.note });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not regenerate this step.';
      dispatch({ kind: 'regenerate-error', stepIndex, message });
    }
  }, []);

  const editPlan = useCallback((plan: PathwayPlan) => {
    dispatch({ kind: 'edit-plan', plan });
  }, []);

  // Debounced autosave: a share link is only worth handing out if it shows
  // what the teacher actually approved, not the pipeline's first draft. Waits
  // for typing to pause rather than saving on every keystroke, and only once
  // there is a persisted session to overwrite — editing before that just
  // updates local state, saved for free once `persistSession` eventually runs.
  useEffect(() => {
    if (!state.sessionId || !state.plan) return;
    const plan = state.plan as PathwayPlan;
    const sessionId = state.sessionId;

    const id = setTimeout(() => {
      void fetch(`/api/pathway/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      }).catch(() => {
        // Best-effort — the teacher's local view already has the edit.
      });
    }, 800);

    return () => clearTimeout(id);
  }, [state.plan, state.sessionId]);

  return { state, start, cancel, regenerateStep, editPlan };
}
