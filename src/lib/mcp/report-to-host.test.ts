import { describe, expect, it } from 'vitest';

import { fencedDetailBlock } from '@/lib/mcp/fence';
import { reportCompletionToHost } from '../../../mcp/report-to-host';

type Sent = { text: string; detail?: Record<string, unknown> };

function harness() {
  const sent: Sent[] = [];
  const bridge = {
    updateModelContext(text: string, detail?: Record<string, unknown>) {
      sent.push({ text, detail });
      return Promise.resolve(undefined);
    },
  };
  // The tracker only calls updateModelContext; the rest of HostBridge is irrelevant here.
  return { sent, tracker: reportCompletionToHost(bridge as never) };
}

const wrong = (kind = 'drag-sort', payload?: Record<string, unknown>) => ({
  eventType: 'answer_checked',
  widgetKind: kind,
  correct: false,
  payload,
});

describe('reportCompletionToHost', () => {
  it('reports completion once, with the structured result riding along', () => {
    const { sent, tracker } = harness();
    tracker.track(wrong());
    tracker.track({ eventType: 'widget_completed', widgetKind: 'drag-sort', correct: true, payload: { score: 80 } });
    tracker.track({ eventType: 'widget_completed', widgetKind: 'drag-sort', correct: true });

    expect(sent).toHaveLength(1);
    expect(sent[0].detail).toMatchObject({ type: 'widget_result', completed: true, correct: true, attempts: 1, score: 80 });
  });

  it('fires the struggle signal once after three consecutive wrong checks', () => {
    const { sent, tracker } = harness();
    tracker.track(wrong());
    tracker.track(wrong());
    expect(sent).toHaveLength(0);
    tracker.track(wrong());
    expect(sent).toHaveLength(1);
    expect(sent[0].detail).toMatchObject({ type: 'widget_progress', completed: false, attempts: 3 });
    tracker.track(wrong());
    expect(sent).toHaveLength(1);
  });

  it('does not read steady multi-part progress as struggle (the crossword case)', () => {
    const { sent, tracker } = harness();
    // correct:false means "not finished yet" while solved climbs — progress, not stuckness.
    tracker.track(wrong('crossword', { solved: 1 }));
    tracker.track(wrong('crossword', { solved: 2 }));
    tracker.track(wrong('crossword', { solved: 3 }));
    tracker.track(wrong('crossword', { solved: 4 }));
    expect(sent).toHaveLength(0);
  });

  it('a right answer resets the wrong streak', () => {
    const { sent, tracker } = harness();
    tracker.track(wrong());
    tracker.track(wrong());
    tracker.track({ eventType: 'answer_checked', widgetKind: 'drag-sort', correct: true });
    tracker.track(wrong());
    tracker.track(wrong());
    expect(sent).toHaveLength(0);
  });

  it('reset() gives a new widget fresh counters and a fresh voice', () => {
    const { sent, tracker } = harness();
    tracker.track({ eventType: 'widget_completed', widgetKind: 'flashcard', correct: null });
    expect(sent).toHaveLength(1);
    tracker.reset();
    tracker.track({ eventType: 'widget_completed', widgetKind: 'crossword', correct: true });
    expect(sent).toHaveLength(2);
    expect(sent[1].detail).toMatchObject({ kind: 'crossword', attempts: 0 });
  });
});

describe('fencedDetailBlock', () => {
  it('fences with more backticks than the content contains', () => {
    const block = fencedDetailBlock({ note: 'code: ```js\nalert(1)\n``` end' });
    const opening = block.split('json')[0];
    expect(opening.length).toBeGreaterThanOrEqual(4);
    // The fence must not appear inside the body it wraps.
    const body = block.slice(block.indexOf('\n') + 1, block.lastIndexOf('\n'));
    expect(body.includes(opening)).toBe(false);
  });

  it('caps unbounded payloads', () => {
    const block = fencedDetailBlock({ text: 'x'.repeat(10_000) });
    expect(block.length).toBeLessThan(4200);
    expect(block).toContain('(truncated)');
  });
});
