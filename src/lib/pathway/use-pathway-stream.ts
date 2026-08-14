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
  stages: Record<StageId, { status: StageStatus; detail?: string }>;
  candidates: Candidate[];
  /** code -> did the graph resolve it. Absent means not yet checked. */
  verdicts: Record<string, boolean>;
  anchor: Anchor | null;
  /** Partial while the model writes, replaced by the validated plan at the end. */
  plan: DeepPartial<PathwayPlan> | null;
  /** Appended to as each generator reports in, so widgets render as they land. */
  widgets: WidgetSpec[];
  /** Why a generator produced nothing — surfaced, not hidden. */
  widgetNotes: string[];
  /** Set once the run is persisted; null when there is no student to persist for. */
  sessionId: string | null;
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
  stages: idleStages(),
  candidates: [],
  verdicts: {},
  anchor: null,
  plan: null,
  widgets: [],
  widgetNotes: [],
  sessionId: null,
  error: null,
  startedAt: null,
  finishedAt: null,
};

type Action =
  | { kind: 'start'; at: number }
  /** Stop streaming but keep whatever already arrived on screen. */
  | { kind: 'stop'; at: number }
  | { kind: 'event'; event: PathwayEvent; at: number };

function reducer(state: PathwayState, action: Action): PathwayState {
  if (action.kind === 'start') {
    return { ...initialState, status: 'streaming', startedAt: action.at };
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
    case 'widget':
      // One event per generator, so both lists grow rather than being replaced.
      return {
        ...state,
        widgets: event.widget ? [...state.widgets, event.widget] : state.widgets,
        widgetNotes: event.note ? [...state.widgetNotes, event.note] : state.widgetNotes,
      };
    case 'session':
      return { ...state, sessionId: event.sessionId };
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

  const start = useCallback(async (topic: string, gradeHint: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ kind: 'start', at: Date.now() });

    try {
      const response = await fetch('/api/pathway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, gradeHint }),
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
  }, []);

  return { state, start, cancel };
}
