import { buildScoringPrompt, SCORING_SYSTEM } from '@/lib/draft-meter/prompt';
import {
  bandForScore,
  labelForBand,
  modelScore,
  type ScoreRequest,
  type ScoreResult,
} from '@/lib/draft-meter/schema';
import { generateStructured } from '@/lib/structured';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Score one draft. A single model call — never a local heuristic, and never a
 * local fallback that renders a score. If this throws, the caller shows an
 * error state; a confidently wrong meter is worse than no meter.
 *
 * This is the one function both surfaces call: the HTTP route today, and an
 * MCP tool later. Keeping it transport-agnostic is what makes that a second
 * call site rather than a second implementation.
 */
export async function scoreDraft(input: ScoreRequest): Promise<ScoreResult> {
  const raw = await generateStructured({
    schema: modelScore,
    system: SCORING_SYSTEM,
    prompt: buildScoringPrompt(input),
    // Determinism matters more than variety here — see the note in structured.ts.
    temperature: 0,
  });

  // The schema can't express these bounds (see the note there), so clamp here
  // rather than let an out-of-range score push the meter fill past the track.
  const rawScore = clamp(Math.round(raw.score), 0, 100);

  const criteriaMet = raw.signals.stance && raw.signals.reasoning && raw.signals.evidence;

  /**
   * Meeting every criterion has to reach the top band, or the widget
   * contradicts itself: the line reads "almost there" while the pill says
   * "that's all three". The scoring prompt already states this rule — once a
   * response takes a position, reasons, and grounds itself in the source it
   * belongs at 85+ — but the model routinely returns three true signals
   * alongside a score in the seventies, so the rule is enforced here.
   *
   * The standard's criteria are the finish line. Anything past it is polish,
   * and polish is not what this meter measures.
   */
  const score = criteriaMet ? Math.max(rawScore, 85) : rawScore;
  const band = bandForScore(score);

  // The nudge is rendered as plain text in a pill, so strip the emphasis marks
  // the model reaches for despite being asked not to.
  const nudge = raw.nudge?.replace(/[*_`]/g, '').trim();

  // Stop asking once the standard is met. The prompt says this too, but a
  // nudge on every non-perfect score turns the widget into a treadmill: a
  // student who has taken a position, reasoned, and cited the source gets told
  // to add one more thing, and then one more, with no point at which they are
  // done. See `criteriaMet` above.

  return {
    ...raw,
    score,
    band,
    label: labelForBand(band),
    criteriaMet,
    confidence: clamp(raw.confidence, 0, 1),
    nudge: criteriaMet || !nudge ? null : nudge,
  };
}
