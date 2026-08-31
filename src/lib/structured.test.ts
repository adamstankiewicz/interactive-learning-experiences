import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { salvageFencedOutput } from '@/lib/structured';

const schema = z.object({ answer: z.string() });

describe('salvageFencedOutput', () => {
  it('recovers valid JSON from a markdown fence', async () => {
    const error = { text: '```json\n{ "answer": "yes" }\n```' };
    expect(await salvageFencedOutput(schema, error)).toEqual({ answer: 'yes' });
  });

  it('recovers from a bare fence without a language tag', async () => {
    const error = { text: '```\n{ "answer": "yes" }\n```' };
    expect(await salvageFencedOutput(schema, error)).toEqual({ answer: 'yes' });
  });

  it('never loosens validation — fenced but invalid stays rejected', async () => {
    expect(await salvageFencedOutput(schema, { text: '```json\n{ "wrong": 1 }\n```' })).toBeNull();
    expect(await salvageFencedOutput(schema, { text: '```json\nnot json\n```' })).toBeNull();
  });

  it('ignores errors without fenced text', async () => {
    expect(await salvageFencedOutput(schema, { text: '{ "answer": "yes" }' })).toBeNull();
    expect(await salvageFencedOutput(schema, new Error('boom'))).toBeNull();
  });

  it('ignores text with prose around the fence', async () => {
    const error = { text: 'Here is your JSON:\n```json\n{ "answer": "yes" }\n```\nHope that helps!' };
    expect(await salvageFencedOutput(schema, error)).toBeNull();
  });
});
