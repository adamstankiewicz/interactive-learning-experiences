/**
 * A small drawing of what each widget *does*, for the gallery cards.
 *
 * Diagrams rather than screenshots, for three reasons: a screenshot of a
 * widget at 300px wide is unreadable mush, it goes stale the moment the widget
 * changes, and it needs an asset pipeline. These are a few shapes each, they
 * inherit the design tokens so they follow light and dark for free, and they
 * show the *interaction* — a curve with draggable nodes, one row marked wrong,
 * chips falling into columns — which is the thing a card title struggles to
 * convey.
 *
 * Decorative: every card already carries the widget's name and description, so
 * these are `aria-hidden` and add nothing for a screen reader to wade through.
 */

const VIEW = '0 0 120 52';

/** Shared look: unfilled shapes read as the surface, filled ones as the action. */
const SURFACE = 'fill-background stroke-border';
const ACTIVE = 'fill-primary/15 stroke-primary';

function FractionAreaModel() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={12 + i * 24}
          y={14}
          width={24}
          height={24}
          className={i < 3 ? ACTIVE : SURFACE}
          strokeWidth={1.5}
        />
      ))}
    </>
  );
}

function SwiperFlashcard() {
  return (
    <>
      <path d="M52 10l8-5 8 5" className="stroke-muted-foreground" strokeWidth={1.5} fill="none" />
      <rect x={38} y={15} width={44} height={22} rx={3} className={ACTIVE} strokeWidth={1.5} />
      <path d="M52 42l8 5 8-5" className="stroke-muted-foreground" strokeWidth={1.5} fill="none" />
    </>
  );
}

function DraftMeter() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={16}
          y={10 + i * 7}
          width={[88, 76, 52][i]}
          height={3}
          rx={1.5}
          className="fill-muted-foreground/35"
        />
      ))}
      <rect x={16} y={38} width={88} height={4} rx={2} className="fill-muted" />
      <rect x={16} y={38} width={54} height={4} rx={2} className="fill-primary" />
      <circle cx={70} cy={40} r={4} className="fill-background stroke-primary" strokeWidth={2} />
    </>
  );
}

function DrawTheCurve() {
  return (
    <>
      <path
        d="M14 40 C26 40 26 20 38 20 C50 20 50 20 62 20 C74 20 74 12 86 12 C98 12 98 12 106 12"
        className="stroke-primary"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      {[
        [14, 40],
        [38, 20],
        [62, 20],
        [86, 12],
        [106, 12],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={3} className="fill-background stroke-primary" strokeWidth={2} />
      ))}
    </>
  );
}

function FindTheFlaw() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={14}
          y={8 + i * 11}
          width={92}
          height={8}
          rx={2}
          className={i === 2 ? 'fill-destructive/10 stroke-destructive' : SURFACE}
          strokeWidth={1.5}
        />
      ))}
      <path
        d="M96 28l6 6M102 28l-6 6"
        className="stroke-destructive"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </>
  );
}

function DefendClaim() {
  return (
    <>
      <rect x={30} y={7} width={60} height={12} rx={3} className={ACTIVE} strokeWidth={1.5} />
      <path d="M46 19v7M74 19v7" className="stroke-border" strokeWidth={1.5} />
      <rect x={16} y={26} width={54} height={9} rx={2} className={SURFACE} strokeWidth={1.5} />
      <rect x={16} y={38} width={54} height={9} rx={2} className={SURFACE} strokeWidth={1.5} />
      <path
        d="M80 32l4 4 8-9"
        className="stroke-success"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function TimelineBuilder() {
  return (
    <>
      <rect x={20} y={8} width={26} height={9} rx={2} className={ACTIVE} strokeWidth={1.5} />
      <rect x={62} y={8} width={26} height={9} rx={2} className={SURFACE} strokeWidth={1.5} />
      <path d="M12 30h96" className="stroke-border" strokeWidth={1.5} />
      {[16, 48, 80].map((x) => (
        <g key={x}>
          <path d={`M${x} 26v8`} className="stroke-muted-foreground" strokeWidth={1.5} />
          <rect x={x + 3} y={36} width={26} height={8} rx={2} className={SURFACE} strokeWidth={1.5} />
        </g>
      ))}
      <path d="M108 26v8" className="stroke-muted-foreground" strokeWidth={1.5} />
    </>
  );
}

function DragSort() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={i === 1 ? 26 : 18}
            y={9 + i * 13}
            width={80}
            height={10}
            rx={2}
            className={i === 1 ? ACTIVE : SURFACE}
            strokeWidth={1.5}
          />
          {[0, 1, 2].map((d) => (
            <circle
              key={d}
              cx={(i === 1 ? 32 : 24) + (d % 2) * 3.5}
              cy={11.5 + i * 13 + Math.floor(d / 2) * 3.5}
              r={0.9}
              className="fill-muted-foreground"
            />
          ))}
        </g>
      ))}
    </>
  );
}

function DragCategorize() {
  return (
    <>
      <rect x={20} y={6} width={22} height={8} rx={2} className={SURFACE} strokeWidth={1.5} />
      <rect x={50} y={4} width={22} height={8} rx={2} className={ACTIVE} strokeWidth={1.5} />
      <path d="M61 14v8" className="stroke-primary" strokeWidth={1.5} strokeDasharray="2 2" />
      <rect x={14} y={26} width={42} height={20} rx={3} className={SURFACE} strokeWidth={1.5} />
      <rect x={64} y={26} width={42} height={20} rx={3} className={SURFACE} strokeWidth={1.5} />
    </>
  );
}

function Flashcard() {
  return (
    <>
      <path
        d="M28 12h56a3 3 0 013 3v22a3 3 0 01-3 3H28a3 3 0 01-3-3V15a3 3 0 013-3z"
        className={SURFACE}
        strokeWidth={1.5}
      />
      <path d="M74 40l14-12v9a3 3 0 01-3 3z" className="fill-primary/25 stroke-primary" strokeWidth={1.5} />
    </>
  );
}

function NarratedCard() {
  const bars = [8, 16, 26, 14, 30, 20, 10, 24, 32, 18, 12, 22, 8];
  return (
    <>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={16 + i * 7}
          y={26 - h / 2}
          width={3}
          height={h}
          rx={1.5}
          className={i < 6 ? 'fill-primary' : 'fill-muted-foreground/40'}
        />
      ))}
    </>
  );
}

function StepReveal() {
  return (
    <>
      <path d="M22 14v26" className="stroke-border" strokeWidth={1.5} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle
            cx={22}
            cy={12 + i * 15}
            r={5}
            className={i === 0 ? 'fill-primary stroke-primary' : SURFACE}
            strokeWidth={1.5}
          />
          <rect
            x={34}
            y={9 + i * 15}
            width={i === 0 ? 68 : 46}
            height={6}
            rx={2}
            className={i === 0 ? 'fill-muted-foreground/45' : 'fill-muted-foreground/20'}
          />
        </g>
      ))}
    </>
  );
}

function MarkdownCard() {
  return (
    <>
      <rect x={16} y={9} width={44} height={7} rx={2} className="fill-primary/70" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={16}
          y={23 + i * 7}
          width={[88, 82, 88, 58][i]}
          height={3}
          rx={1.5}
          className="fill-muted-foreground/30"
        />
      ))}
    </>
  );
}

function WritingWorkshop() {
  return (
    <>
      {/* Prose on the left with one sentence marked, and the note that marking
          earned sitting beside it — the review lands on the sentence, and says
          why. */}
      {[
        [10, 52],
        [18, 40],
        [26, 52],
        [34, 30],
      ].map(([y, w]) => (
        <rect key={y} x={14} y={y} width={w} height={3} rx={1.5} className="fill-muted-foreground/30" />
      ))}
      <rect x={14} y={18} width={40} height={3} rx={1.5} className="fill-primary/70" />
      <path d="M14 23h40" className="stroke-primary" strokeWidth={1.25} strokeDasharray="2 2" />
      <path d="M56 21h8" className="stroke-primary/60" strokeWidth={1.25} />
      <rect x={64} y={12} width={42} height={20} rx={3} className={ACTIVE} strokeWidth={1.5} />
      {[17, 22, 27].map((y, i) => (
        <rect
          key={y}
          x={69}
          y={y}
          width={[32, 26, 18][i]}
          height={2}
          rx={1}
          className="fill-primary/45"
        />
      ))}
    </>
  );
}

function DebateAI() {
  return (
    <>
      {/* Two voices facing each other, one filled and one not: the student
          argues, the opponent argues back and does not fold. */}
      <path
        d="M14 10h48a3 3 0 013 3v13a3 3 0 01-3 3H30l-8 7v-7h-8a3 3 0 01-3-3V13a3 3 0 013-3z"
        className={ACTIVE}
        strokeWidth={1.5}
      />
      <path
        d="M106 22H62a3 3 0 00-3 3v13a3 3 0 003 3h28l8 7v-7h8a3 3 0 003-3V25a3 3 0 00-3-3z"
        className={SURFACE}
        strokeWidth={1.5}
      />
    </>
  );
}

function Crossword() {
  const filled = new Set(['1-0', '1-1', '1-2', '1-3', '0-2', '2-2', '3-2']);
  return (
    <>
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const on = filled.has(`${row}-${col}`);
          return (
            <rect
              key={`${row}-${col}`}
              x={26 + col * 14}
              y={6 + row * 11}
              width={13}
              height={10}
              rx={1.5}
              className={on ? ACTIVE : 'fill-muted stroke-border'}
              strokeWidth={1.25}
            />
          );
        }),
      )}
    </>
  );
}

const THUMBS: Record<string, () => React.ReactElement> = {
  'fraction-area-model': FractionAreaModel,
  'swiper-flashcard': SwiperFlashcard,
  'draft-meter': DraftMeter,
  'draw-the-curve': DrawTheCurve,
  'find-the-flaw': FindTheFlaw,
  'defend-claim': DefendClaim,
  'timeline-builder': TimelineBuilder,
  'drag-sort': DragSort,
  'drag-categorize': DragCategorize,
  flashcard: Flashcard,
  'narrated-card': NarratedCard,
  'step-reveal': StepReveal,
  'markdown-card': MarkdownCard,
  crossword: Crossword,
  'debate-ai': DebateAI,
  'writing-workshop': WritingWorkshop,
};

export function WidgetThumb({ slug }: { slug: string }) {
  const Drawing = THUMBS[slug];

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-muted/40">
      <svg viewBox={VIEW} className="block w-full" aria-hidden="true">
        {/* A widget with no drawing yet still gets the frame, so the grid keeps
            its rhythm rather than one card sitting shorter than the rest. */}
        {Drawing ? <Drawing /> : null}
      </svg>
    </div>
  );
}
