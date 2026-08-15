import { buildFeedbackPrompt, FEEDBACK_SYSTEM } from '@/lib/defend-claim/prompt';
import {
  type FeedbackRequest,
  type FeedbackResult,
  modelFeedback,
} from '@/lib/defend-claim/schema';
import { scoringModel } from '@/lib/model';
import { generateStructured } from '@/lib/structured';

// Resolved once, lazily: `scoringModel()` throws when its provider env vars are
// missing, and doing that at module scope would fail the import rather than the
// request that actually needed a model.
let cachedModel: ReturnType<typeof scoringModel> | null = null;
const model = () => (cachedModel ??= scoringModel());

/**
 * Read one defense. A single model call — never a local heuristic, and never a
 * local fallback that renders feedback. If this throws, the caller shows an
 * error state and keeps the student's draft: a student who asked for a reading
 * and got a confidently wrong one is worse off than one who got none, and a
 * student who lost their paragraph to a failed request is worse off than both.
 *
 * Transport-agnostic, like `scoreDraft` — the HTTP route is one call site, and
 * an MCP tool later is a second, not a second implementation.
 */
export async function reviewDefense(input: FeedbackRequest): Promise<FeedbackResult> {
  const raw = await generateStructured({
    schema: modelFeedback,
    system: FEEDBACK_SYSTEM,
    prompt: buildFeedbackPrompt(input),
    // Determinism matters more than variety: a student who resubmits an
    // unchanged draft and gets a different verdict learns that the feedback is
    // weather, not a reading of their work. See the note in structured.ts.
    temperature: 0,
    model: model(),
  });

  const met = Number(raw.checks.position) + Number(raw.checks.reasoning) + Number(raw.checks.evidence);
  const holds = met === 3 && raw.stanceMatchesWriting;

  // The model reaches for emphasis marks despite being asked not to, and all
  // three of these render as plain prose.
  const plain = (text: string) => text.replace(/[*_`]/g, '').trim();

  /**
   * Stop asking once the defense holds. The prompt says this too, but a
   * revision request on every imperfect draft turns the widget into a
   * treadmill: a student who has taken a side, reasoned, and cited a source
   * gets told to add one more thing, then one more, with no point at which
   * they are done.
   *
   * The challenge is not suppressed alongside it, and that asymmetry is the
   * design. "Your defense holds — and here is what you would still have to
   * answer" is the honest end state for a history argument. "Your defense
   * holds, now go and fix it" is not.
   */
  const revise = raw.revise ? plain(raw.revise) : null;

  /**
   * A defense that argues the opposite of the ticked box has one obvious next
   * move, and the prompt asks for it in the revise line — but observed
   * behaviour is that the model reads three met criteria, returns null, and
   * leaves the student with a stance warning and nothing to do about it. The
   * rule is enforced here for the same reason `scoreDraft` enforces its 85
   * floor in code: a rule the prompt states and the model intermittently drops
   * is not a rule.
   */
  const stanceFix = raw.stanceMatchesWriting
    ? null
    : (revise ?? 'Your writing argues the other way — switch your pick, or argue the side you chose.');

  return {
    ...raw,
    strength: plain(raw.strength),
    challenge: plain(raw.challenge),
    revise: holds ? null : (stanceFix ?? revise),
    holds,
    met,
  };
}
