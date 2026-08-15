import { swiperFlashcardSpec, type SwiperFlashcardSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

/**
 * Trim the card set and drop degenerate cards. Never returns nothing — this
 * kind is the universal fallback every other kind's own generation lands on
 * when it can't produce something valid, so there is no further fallback to
 * hand a bad deck to.
 */
function normalize(spec: SwiperFlashcardSpec): SwiperFlashcardSpec {
  const cards = spec.cards
    .filter((card) => card.question.trim() && card.upLabel.trim() !== card.downLabel.trim())
    .slice(0, 8);
  return { ...spec, cards: cards.length > 0 ? cards : spec.cards.slice(0, 8) };
}

export async function generateSwiperFlashcard(prompt: string): Promise<SwiperFlashcardSpec> {
  const spec = await generateStructured({
    schema: swiperFlashcardSpec,
    system: [
      'You write a deck of swipeable judgement cards. Each card states one claim about the',
      'standard, and the student swipes to accept or reject it.',
      'Write 6 cards. Roughly half should be true, in no fixed pattern, so the deck cannot be',
      'passed by alternating.',
      'Every false card must be a claim a student who holds one of the listed misconceptions',
      'would actually accept — not an obvious absurdity, and never a trick of wording.',
      'The up and down labels are the two judgements themselves, phrased for the content',
      '(for example "Always true" and "Not always"), never the literal words "up" and "down".',
      'The explanation says why in one sentence a student at this grade band would follow, and',
      'names the misconception when the card was built from one.',
    ].join(' '),
    prompt,
  });

  return normalize(spec);
}

registerWidgetGenerator({
  kind: 'swiper-flashcard',
  async generate(ctx) {
    return { widget: await generateSwiperFlashcard(ctx.prompt), note: null };
  },
});
