import 'server-only';

import { type Anchor } from '@/lib/pathway/events';
import { type PathwayPlan, type WidgetSpec } from '@/lib/pathway/schema';
import { storageAdapter } from '@/lib/storage';
import '@/lib/widgets/builtins.generate';
import { widgetContext } from '@/lib/widgets/context';
import { getWidgetGenerator } from '@/lib/widgets/types';

/**
 * The widget kinds remediation is allowed to inject, in priority order.
 *
 * These are the read/absorb widgets — no new performance pressure on a student
 * who just demonstrated a gap. The generator picks the first kind that has a
 * registered generator; in practice all three are always registered.
 */
const REMEDIATION_KINDS = ['markdown-card', 'flashcard', 'step-reveal'] as const;
type RemediationKind = (typeof REMEDIATION_KINDS)[number];

export type RemediationResult = {
  widget: WidgetSpec;
  kind: RemediationKind;
  insertAt: number;
};

/**
 * Decide whether this completed widget warrants a remediation step.
 *
 * The signal is deliberately coarse: a single incorrect answer triggers it.
 * The model call is cheap (markdown-card / flashcard are small), and a
 * student who got it right costs nothing — the gate is strict on the "no"
 * side so we never bother a student who understood.
 *
 * `correct === null` means the widget has no binary outcome (draft-meter,
 * defend-claim) — skip remediation for those; the live-scoring loop is their
 * feedback mechanism.
 */
export function shouldRemediate(correct: boolean | null): boolean {
  return correct === false;
}

/**
 * Generate a remediation widget for a step the student struggled with.
 *
 * Loads the session to recover `anchor` and `plan`, builds the same widget
 * context the original generator used, but overrides the purpose to signal
 * "re-teaching" rather than the original step purpose. Returns null if the
 * session cannot be loaded or no generator is available.
 *
 * `currentStep` is the student's live position when the telemetry batch was
 * flushed — the injected widget is placed after whichever is further ahead,
 * the failed step or the student's current position, so a fast reader who
 * already moved on never sees the remediation widget appear behind them.
 */
export async function generateRemediationWidget(
  sessionId: string,
  stepIndex: number,
  currentStep?: number,
): Promise<RemediationResult | null> {
  const session = await storageAdapter().loadSession(sessionId);
  if (!session) return null;

  const anchor = session.anchor as Anchor;
  const plan = session.plan as PathwayPlan;
  const step = plan.steps[stepIndex];
  if (!step) return null;

  const remediationStep: PathwayPlan['steps'][number] = {
    ...step,
    purpose: 'model',
    title: `Let's revisit: ${step.title}`,
    description: `Re-teach the concept from "${step.title}" that the student struggled with. Focus on the core idea from first principles — address the known misconceptions directly.`,
  };

  const prompt = widgetContext(anchor, plan, remediationStep);

  // Always insert after the student's current position, not just after the
  // failed step — if they advanced past the failed step before the server
  // responded, inserting at stepIndex + 1 would land behind them.
  const insertAt = Math.max(stepIndex + 1, (currentStep ?? stepIndex) + 1);

  for (const kind of REMEDIATION_KINDS) {
    const generator = getWidgetGenerator(kind);
    if (!generator) continue;

    try {
      const result = await generator.generate({ anchor, plan, step: remediationStep, prompt });
      if (result.widget) {
        return { widget: result.widget, kind, insertAt };
      }
    } catch {
      // Try next kind
    }
  }

  return null;
}
