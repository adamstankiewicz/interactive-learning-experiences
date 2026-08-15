import { timelineBuilderSpec, type TimelineBuilderSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { fallbackWidgetKind, getWidgetGenerator, registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_ZONES = 3;
const MIN_EVENTS = 4;

function normalize(spec: TimelineBuilderSpec): TimelineBuilderSpec | null {
  const zones = spec.zones
    .filter((z, i, all) => z.id.trim() && all.findIndex((x) => x.id === z.id) === i)
    .slice(0, 5);

  const zoneIds = new Set(zones.map((z) => z.id));
  const events = spec.events
    .filter((e, i, all) => e.id.trim() && all.findIndex((x) => x.id === e.id) === i)
    .filter((e) => zoneIds.has(e.zoneId))
    .slice(0, 10);

  const usedZones = new Set(events.map((e) => e.zoneId));
  const keptZones = zones.filter((z) => usedZones.has(z.id));

  if (keptZones.length < MIN_ZONES || events.length < MIN_EVENTS) return null;
  return { ...spec, zones: keptZones, events };
}

registerWidgetGenerator({
  kind: 'timeline-builder',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: timelineBuilderSpec,
      system: [
        'You configure a timeline drag-and-drop activity: the student places events into labeled',
        'period zones in the correct chronological order.',
        'Give 3–4 zones in strict chronological order, left to right. Give 6–8 events spread',
        'across the zones with at least one event per zone.',
        'Each event zoneId must exactly match one of the zone ids you defined.',
        'Ids are short, stable, lowercase slugs. Event labels are self-contained short phrases',
        '(e.g. "Moon landing") — no labels like "the next event" or "after the previous one".',
        'The hint names the most common misconception about the ordering rather than giving the answer.',
      ].join(' '),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    const fallback = await getWidgetGenerator(fallbackWidgetKind())!.generate(ctx);
    return {
      widget: fallback.widget,
      note: [
        "The timeline didn't produce enough valid zones and events — built a fallback activity for this step instead.",
        fallback.note,
      ]
        .filter(Boolean)
        .join(' '),
    };
  },
});
