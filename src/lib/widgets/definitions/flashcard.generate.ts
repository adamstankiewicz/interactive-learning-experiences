import { flashcardSpec, type FlashcardSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { fallbackWidgetKind, getWidgetGenerator, registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_CARDS = 3;

function normalize(spec: FlashcardSpec): FlashcardSpec | null {
  const cards = spec.cards
    .filter((c, i, all) => c.id.trim() && all.findIndex((x) => x.id === c.id) === i)
    .filter((c) => {
      const frontHasContent = c.front.text || c.front.markdown || c.front.imageUrl;
      const backHasContent = c.back.text || c.back.markdown || c.back.imageUrl;
      return frontHasContent && backHasContent;
    })
    .slice(0, 8);

  if (cards.length < MIN_CARDS) return null;
  return { ...spec, cards };
}

registerWidgetGenerator({
  kind: 'flashcard',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: flashcardSpec,
      system: [
        'You configure a flip-card deck for a student reviewing key concepts.',
        'Give 4–6 cards. Each card must have at least one field on each side (text or markdown).',
        'The front should be a term, question, or prompt. The back should be the definition,',
        'answer, or explanation. Keep each side concise — one to three sentences.',
        'imageUrl and imageAlt are null unless an image is genuinely available and adds value.',
        'Ids are short, stable, lowercase slugs.',
      ].join(' '),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    const fallback = await getWidgetGenerator(fallbackWidgetKind())!.generate(ctx);
    return {
      widget: fallback.widget,
      note: [
        "The flashcard deck didn't have enough valid cards — built a fallback activity for this step instead.",
        fallback.note,
      ]
        .filter(Boolean)
        .join(' '),
    };
  },
});
