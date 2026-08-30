import { describe, expect, it, vi } from 'vitest';

import type { PathwayEvent } from '@/lib/pathway/events';

vi.mock('@/lib/pathway/generate', () => ({
  streamPathway: vi.fn(),
}));

import { streamPathway } from '@/lib/pathway/generate';
import { runPathway } from '@/lib/pathway/run';

const anchor = { standard: { code: 'MATH.4.NF.EQUIV' } } as never;
const plan = { bigIdea: 'x', steps: [{ title: 'a' }, { title: 'b' }] } as never;

function feed(events: Partial<PathwayEvent>[]) {
  vi.mocked(streamPathway).mockImplementation(async function* () {
    for (const event of events) yield event as PathwayEvent;
  });
}

describe('runPathway', () => {
  it('collects the stream into the same shape the NDJSON route accumulates', async () => {
    feed([
      { type: 'verdict', code: 'FAKE.1', resolved: false },
      { type: 'verdict', code: 'MATH.4.NF.EQUIV', resolved: true },
      { type: 'anchor', anchor } as never,
      { type: 'plan', plan } as never,
      { type: 'step-widget', stepIndex: 0, widget: { kind: 'flashcard' } } as never,
      { type: 'step-widget', stepIndex: 1, widget: { kind: 'drag-sort' }, note: 'fell back' } as never,
      { type: 'done' } as never,
    ]);

    const run = await runPathway('topic');
    expect(run.anchor).toBe(anchor);
    expect(run.plan).toBe(plan);
    expect(run.rejected).toEqual(['FAKE.1']);
    expect(run.stepWidgets[1]).toMatchObject({ kind: 'drag-sort' });
    // Substitution notes survive collection — the caller reports them, never hides them.
    expect(run.stepWidgetNotes).toEqual({ 1: 'fell back' });
  });

  it('throws when the run produces no pathway instead of returning a hollow result', async () => {
    feed([{ type: 'done' } as never]);
    await expect(runPathway('topic')).rejects.toThrow(/did not produce a pathway/);
  });

  it('passes teacher context through to the pipeline', async () => {
    feed([
      { type: 'anchor', anchor } as never,
      { type: 'plan', plan } as never,
    ]);
    await runPathway('topic', '4', { teacherNote: 'they confuse thirds and fourths' });
    expect(vi.mocked(streamPathway)).toHaveBeenCalledWith(
      'topic',
      '4',
      null,
      'they confuse thirds and fourths',
      undefined,
    );
  });
});
