'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { PathwayPlan, WidgetSpec } from '@/lib/pathway/schema';
import { widgetSpec } from '@/lib/pathway/schema';

// ---------------------------------------------------------------------------
// Per-kind static preview cards
// ---------------------------------------------------------------------------

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full border border-border bg-accent px-2.5 py-0.5 text-xs text-foreground">
      {label}
    </span>
  );
}

function PreviewShell({ title, kind, children }: { title: string; kind: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-accent/40 px-4 py-2.5">
        <span className="text-sm font-medium truncate">{title}</span>
        <span className="shrink-0 rounded-full bg-background border border-border px-2 py-0.5 text-xs font-mono text-muted-foreground">
          {kind}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MarkdownCardPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'markdown-card' }> }) {
  return (
    <PreviewShell title={spec.title} kind="markdown-card">
      <div className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed line-clamp-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{spec.body}</ReactMarkdown>
      </div>
      {spec.tip && (
        <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs text-muted-foreground italic">{spec.tip}</p>
      )}
    </PreviewShell>
  );
}

function SwiperFlashcardPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'swiper-flashcard' }> }) {
  return (
    <PreviewShell title={spec.cards[0]?.question ?? 'Swiper flashcard'} kind="swiper-flashcard">
      <p className="mb-2 text-xs text-muted-foreground">{spec.cards.length} cards</p>
      <div className="flex flex-col gap-1.5">
        {spec.cards.slice(0, 4).map((c, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
            <span className="flex-1 truncate">{c.question}</span>
            <span className="shrink-0 text-muted-foreground">↑ {c.upLabel} / ↓ {c.downLabel}</span>
          </div>
        ))}
        {spec.cards.length > 4 && <p className="text-xs text-muted-foreground">+{spec.cards.length - 4} more</p>}
      </div>
    </PreviewShell>
  );
}

function FlashcardPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'flashcard' }> }) {
  return (
    <PreviewShell title={spec.prompt} kind="flashcard">
      <p className="mb-2 text-xs text-muted-foreground">{spec.cards.length} cards</p>
      <div className="flex flex-col gap-1.5">
        {spec.cards.slice(0, 4).map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
            <span className="flex-1 truncate">{c.front.text ?? c.front.markdown}</span>
            <span className="shrink-0 text-muted-foreground">→ {c.back.text ?? c.back.markdown}</span>
          </div>
        ))}
        {spec.cards.length > 4 && <p className="text-xs text-muted-foreground">+{spec.cards.length - 4} more</p>}
      </div>
    </PreviewShell>
  );
}

function DragSortPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'drag-sort' }> }) {
  return (
    <PreviewShell title={spec.prompt} kind="drag-sort">
      <div className="flex flex-wrap gap-1.5">
        {spec.items.map((item) => <Chip key={item.id} label={item.label} />)}
      </div>
    </PreviewShell>
  );
}

function DragCategorizePreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'drag-categorize' }> }) {
  return (
    <PreviewShell title={spec.prompt} kind="drag-categorize">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {spec.categories.map((cat) => (
          <div key={cat.id} className="min-w-[120px] flex-1">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{cat.label}</p>
            <div className="flex flex-col gap-1">
              {spec.items.filter((i) => i.categoryId === cat.id).map((item) => (
                <Chip key={item.id} label={item.label} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function FractionAreaModelPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'fraction-area-model' }> }) {
  return (
    <PreviewShell title={spec.prompt} kind="fraction-area-model">
      <p className="text-sm text-muted-foreground">
        Build <strong className="text-foreground">{spec.numerator}/{spec.denominator}</strong> using a {spec.representation} model.
      </p>
    </PreviewShell>
  );
}

function DraftMeterPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'draft-meter' }> }) {
  return (
    <PreviewShell title={spec.question} kind="draft-meter">
      {spec.passage && (
        <blockquote className="mb-3 border-l-2 border-border pl-3 text-xs text-muted-foreground italic line-clamp-3">
          {spec.passage.text}
          <span className="not-italic font-medium"> — {spec.passage.source}</span>
        </blockquote>
      )}
      <div className="flex flex-wrap gap-1.5">
        {spec.checks.map((c) => <Chip key={c.id} label={c.label} />)}
      </div>
    </PreviewShell>
  );
}

function StepRevealPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'step-reveal' }> }) {
  return (
    <PreviewShell title={spec.prompt} kind="step-reveal">
      <ol className="flex flex-col gap-1.5 text-xs">
        {spec.steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="font-medium">{s.title}</span>
          </li>
        ))}
      </ol>
    </PreviewShell>
  );
}

function NarratedCardPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'narrated-card' }> }) {
  return (
    <PreviewShell title={spec.prompt} kind="narrated-card">
      <ol className="flex flex-col gap-1.5 text-xs">
        {spec.steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="font-medium">{s.title}</span>
          </li>
        ))}
      </ol>
    </PreviewShell>
  );
}

function CrosswordPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'crossword' }> }) {
  return (
    <PreviewShell title={spec.title} kind="crossword">
      <p className="mb-2 text-xs text-muted-foreground">{spec.entries.length} entries</p>
      <div className="flex flex-wrap gap-1.5">
        {spec.entries.slice(0, 8).map((e, i) => <Chip key={i} label={e.answer} />)}
        {spec.entries.length > 8 && <Chip label={`+${spec.entries.length - 8}`} />}
      </div>
    </PreviewShell>
  );
}

function TimelineBuilderPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'timeline-builder' }> }) {
  return (
    <PreviewShell title={spec.prompt} kind="timeline-builder">
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {spec.zones.map((z) => (
          <div key={z.id} className="flex-1 min-w-[80px] text-center">
            <div className="rounded border border-border bg-accent px-2 py-1 text-xs font-medium">{z.label}</div>
            {z.sublabel && <p className="mt-0.5 text-[10px] text-muted-foreground">{z.sublabel}</p>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {spec.events.map((e) => <Chip key={e.id} label={e.label} />)}
      </div>
    </PreviewShell>
  );
}

function FindTheFlawPreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'find-the-flaw' }> }) {
  return (
    <PreviewShell title={spec.scenario.title} kind="find-the-flaw">
      <p className="mb-2 text-xs text-muted-foreground">{spec.scenario.setup}</p>
      <ol className="flex flex-col gap-1 text-xs">
        {spec.steps.map((s, i) => (
          <li key={s.id} className={`flex gap-2 ${s.id === spec.flawedStepId ? 'text-destructive' : ''}`}>
            <span className="shrink-0 tabular-nums text-muted-foreground">{i + 1}.</span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
    </PreviewShell>
  );
}

function DrawTheCurvePreview({ spec }: { spec: Extract<WidgetSpec, { kind: 'draw-the-curve' }> }) {
  const max = Math.max(...spec.actual.map((p) => p.value), 1);
  return (
    <PreviewShell title={spec.prompt} kind="draw-the-curve">
      <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{spec.setup}</p>
      <div className="flex items-end gap-1 h-12">
        {spec.actual.map((pt) => {
          const pt_id = spec.xAxis.points.find((p) => p.id === pt.pointId);
          return (
            <div key={pt.pointId} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-primary/40"
                style={{ height: `${Math.round((pt.value / max) * 40)}px` }}
              />
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">{pt_id?.label}</span>
            </div>
          );
        })}
      </div>
    </PreviewShell>
  );
}

function WidgetPreview({ spec }: { spec: WidgetSpec }) {
  switch (spec.kind) {
    case 'markdown-card': return <MarkdownCardPreview spec={spec} />;
    case 'swiper-flashcard': return <SwiperFlashcardPreview spec={spec} />;
    case 'flashcard': return <FlashcardPreview spec={spec} />;
    case 'drag-sort': return <DragSortPreview spec={spec} />;
    case 'drag-categorize': return <DragCategorizePreview spec={spec} />;
    case 'fraction-area-model': return <FractionAreaModelPreview spec={spec} />;
    case 'draft-meter': return <DraftMeterPreview spec={spec} />;
    case 'step-reveal': return <StepRevealPreview spec={spec} />;
    case 'narrated-card': return <NarratedCardPreview spec={spec} />;
    case 'crossword': return <CrosswordPreview spec={spec} />;
    case 'timeline-builder': return <TimelineBuilderPreview spec={spec} />;
    case 'find-the-flaw': return <FindTheFlawPreview spec={spec} />;
    case 'draw-the-curve': return <DrawTheCurvePreview spec={spec} />;
  }
}

const PURPOSE_LABEL: Record<string, string> = {
  activate: 'Activate',
  model: 'Model',
  practice: 'Practice',
  check: 'Check',
};

const PURPOSE_COLOR: Record<string, string> = {
  activate: 'bg-(--purpose-activate-bg) text-(--purpose-activate-fg)',
  model: 'bg-(--purpose-model-bg) text-(--purpose-model-fg)',
  practice: 'bg-(--purpose-practice-bg) text-(--purpose-practice-fg)',
  check: 'bg-(--purpose-check-bg) text-(--purpose-check-fg)',
};

export type PathwayPreviewData = {
  plan: PathwayPlan;
  stepWidgets: Record<number, unknown>;
};

export function PathwayPreview({ data }: { data: PathwayPreviewData }) {
  const { plan, stepWidgets } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Big idea */}
      {plan.bigIdea && (
        <p className="text-sm text-muted-foreground italic">{plan.bigIdea}</p>
      )}

      {/* Steps */}
      {plan.steps.map((step, idx) => {
        const rawWidget = stepWidgets[idx];
        const parsed = rawWidget ? widgetSpec.safeParse(rawWidget) : null;
        const spec = parsed?.success ? parsed.data : null;

        return (
          <div key={idx} className="flex gap-3">
            {/* Step number column */}
            <div className="flex flex-col items-center pt-0.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-muted-foreground">
                {idx + 1}
              </div>
              {idx < plan.steps.length - 1 && (
                <div className="mt-1 flex-1 w-px bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4 min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{step.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PURPOSE_COLOR[step.purpose] ?? ''}`}>
                  {PURPOSE_LABEL[step.purpose] ?? step.purpose}
                </span>
              </div>
              <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              {spec ? (
                <WidgetPreview spec={spec} />
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                  Widget not yet generated
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
