import { buildDebatePrompt, DEBATE_SYSTEM } from '@/lib/debate/prompt';
import { modelTurn, type DebateRequest, type DebateTurnResult } from '@/lib/debate/schema';
import { scoringModel } from '@/lib/model';
import { generateStructured } from '@/lib/structured';

// Resolved once, lazily: `scoringModel()` throws when its provider env vars are
// missing, and doing that at module scope would fail the import rather than the
// request that actually needed a model.
let cachedModel: ReturnType<typeof scoringModel> | null = null;
const model = () => (cachedModel ??= scoringModel());

/**
 * One exchange: the opponent's reply, plus a judgement of the move the student
 * just made. Transport-agnostic like `scoreDraft` and `reviewDefense` — the
 * HTTP route is one call site and an MCP tool later is a second, not a second
 * implementation.
 */
export async function respondInDebate(input: DebateRequest): Promise<DebateTurnResult> {
  const raw = await generateStructured({
    schema: modelTurn,
    system: DEBATE_SYSTEM,
    prompt: buildDebatePrompt(input),
    /**
     * Warmer than the graders. A debate opponent that answers an identical
     * objection with an identical sentence stops reading as someone arguing
     * back, and unlike a score there is no verdict here for the student to
     * mistake for weather. The judgement rides along at the same temperature,
     * which is the cost of getting both from one call — the prompt leans on
     * "resolve borderline cases in the student's favour" to keep it steady.
     */
    temperature: 0.7,
    model: model(),
  });

  // Judge only the moves that were actually offered. A model that invents an id
  // shouldn't be able to light up a chip that isn't there.
  const offered = new Set(input.moves.map((m) => m.id));
  const movesMade = raw.moves.filter((m) => m.made && offered.has(m.id)).map((m) => m.id);

  return {
    // Rendered as plain text in a bubble; the model reaches for emphasis marks
    // despite being asked for none.
    reply: raw.reply.replace(/[*_`]/g, '').trim(),
    movesMade,
    conceded: raw.conceded,
    final: input.turn >= input.turnLimit,
  };
}
