import { beforeAll, describe, expect, it } from 'vitest';

import '@/lib/widgets/builtins';

/**
 * Integration-flavored: findActivities runs against the real registry and the
 * keyless example standards source, so verification is exercised end-to-end
 * with no network and no keys. The env var must be set before the standards
 * registry loads, hence the dynamic import.
 */
let findActivities: typeof import('@/lib/activities/find').findActivities;

beforeAll(async () => {
  process.env.STANDARDS_SOURCE = 'example';
  // No embedding-capable provider in tests → the lexical fallback runs, and
  // the result must say so. The semantic ranker has its own suite.
  delete process.env.OPENAI_FALLBACK_API_KEY;
  process.env.LLM_PROVIDER = 'anthropic';
  ({ findActivities } = await import('@/lib/activities/find'));
});

describe('findActivities', () => {
  it('verifies a known code and every listing carries a forwardable invocation', async () => {
    const result = await findActivities({ standardCode: 'MATH.4.NF.EQUIV' });

    expect(result.standard?.code).toBe('MATH.4.NF.EQUIV');
    expect(result.ranking).toBe('lexical'); // honest: this deployment cannot embed
    expect(result.rejectedCodes).toEqual([]);
    expect(result.activities.length).toBeGreaterThan(0);

    for (const listing of result.activities) {
      expect(listing.delivery.mcp.tool).toBe('show_widget');
      // Arguments must be forwardable verbatim: a kind, plus the verified code.
      expect(listing.delivery.mcp.arguments.kind).toBeTruthy();
      expect(listing.delivery.mcp.arguments.standardCode).toBe('MATH.4.NF.EQUIV');
      expect(listing.standards[0]).toMatchObject({ code: 'MATH.4.NF.EQUIV', verified: true });
      expect(listing.provenance.generated).toBe(true);
    }
  });

  it('floats assessing kinds when the need sounds like assessment — stems included', async () => {
    for (const need of ['a quick check', 'a formative assessment', 'two short quizzes', 'graded practice']) {
      const result = await findActivities({ standardCode: 'MATH.4.NF.EQUIV', need });
      expect(result.activities[0].pedagogy.assesses).toBe(true);
    }
  });

  it("'grade 4' in a topic is a grade level, not an intent to assess", async () => {
    const withGrade = await findActivities({ standardCode: 'MATH.4.NF.EQUIV', topic: 'fractions for grade 4' });
    const without = await findActivities({ standardCode: 'MATH.4.NF.EQUIV', topic: 'fractions for year four' });
    // Same ordering either way — the word "grade" alone moves nothing.
    expect(withGrade.activities.map((a) => a.id)).toEqual(without.activities.map((a) => a.id));
  });

  it('keeps a hallucinated code on the record and degrades to standard-agnostic listings', async () => {
    const result = await findActivities({ standardCode: 'FAKE.9.99', topic: 'the water cycle' });

    expect(result.standard).toBeNull();
    expect(result.rejectedCodes).toEqual(['FAKE.9.99']);
    // No verified standard → coverage-gated kinds exclude themselves; the
    // survivors invoke by topic, never by the rejected code.
    for (const listing of result.activities) {
      expect(listing.standards).toEqual([]);
      expect(listing.delivery.mcp.arguments.standardCode).toBeUndefined();
      expect(listing.delivery.mcp.arguments.topic).toBe('the water cycle');
    }
  });

  it('ranks deterministically — identical calls produce identical order', async () => {
    const a = await findActivities({ standardCode: 'MATH.4.NF.EQUIV', need: 'something they write' });
    const b = await findActivities({ standardCode: 'MATH.4.NF.EQUIV', need: 'something they write' });
    expect(a.activities.map((x) => x.id)).toEqual(b.activities.map((x) => x.id));
  });
});
