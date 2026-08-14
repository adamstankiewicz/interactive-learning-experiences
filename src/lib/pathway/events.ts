import type {
  LearningComponent,
  ProgressionStandard,
  StandardStatement,
} from '@/lib/learning-commons/client';
import type { PathwayPlan, WidgetSpec } from '@/lib/pathway/schema';

/**
 * The wire protocol between the pipeline and the UI.
 *
 * This module deliberately imports no model or network code: the client bundle
 * pulls `STAGES` and these types in, and dragging `generate.ts` along would
 * drag the AI SDK and server env with it.
 */

export type Anchor = {
  standard: StandardStatement;
  learningComponents: LearningComponent[];
  prerequisites: ProgressionStandard[];
};

export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * The pipeline's stages, in order. Exported as data because the UI renders the
 * whole list up front — pending steps included — so the shape of the work is
 * visible before any of it finishes.
 */
export const STAGES = [
  { id: 'propose', label: 'Proposing standards', active: 'Asking the model for candidate codes' },
  { id: 'verify', label: 'Verifying against the graph', active: 'Checking each code for a real match' },
  { id: 'graph', label: 'Loading the standard’s spine', active: 'Fetching learning components and prerequisites' },
  { id: 'plan', label: 'Planning the pathway', active: 'Writing outcomes, misconceptions and steps' },
  { id: 'widget', label: 'Building the interactions', active: 'Configuring a widget for every step' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];

export type Candidate = { statementCode: string; rationale: string };

export type PathwayEvent =
  /** A stage opened or closed. `detail` overrides the default label when done. */
  | { type: 'stage'; stage: StageId; status: 'active' | 'done' | 'skipped'; detail?: string }
  /** Codes the model proposed, before the graph has had a vote. */
  | { type: 'candidates'; candidates: Candidate[] }
  /** One code's verdict from the graph. The rejections are the interesting part. */
  | { type: 'verdict'; code: string; resolved: boolean }
  | { type: 'anchor'; anchor: Anchor }
  /** Successive partial plans as the model writes it. Each supersedes the last. */
  | { type: 'plan-partial'; plan: DeepPartial<PathwayPlan> }
  | { type: 'plan'; plan: PathwayPlan }
  /**
   * One per step, emitted as its widget finishes configuring so each appears
   * against its step rather than all at once at the end. `note` is set when
   * the requested kind didn't fit and a different one was substituted — the
   * substitution is transparent, not silent, but it isn't a failure either.
   */
  | { type: 'step-widget'; stepIndex: number; widget: WidgetSpec; note: string | null }
  /** Persisted session id, once there is one. Telemetry attaches to it. */
  | { type: 'session'; sessionId: string | null }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** Newline-delimited JSON: one event per line, flushed as produced. */
export function encodeEvent(event: PathwayEvent): string {
  return `${JSON.stringify(event)}\n`;
}
