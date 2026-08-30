import { describe, expect, it } from 'vitest';

import { POST } from './route';

/**
 * Protocol-level integration: drive the deployed endpoint's handler with real
 * Requests and assert the wire contract — the part a host depends on before
 * any model call happens. Tool *execution* is covered by unit tests
 * (find.test.ts, run.test.ts) and the eval-harness roadmap; this file pins
 * the envelope.
 */
function rpc(body: unknown) {
  return POST(
    new Request('https://example.test/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('/api/mcp protocol surface', () => {
  it('initializes with instructions and capabilities', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    const json = await res.json();
    expect(json.result.serverInfo.name).toBe('interactive-learning-widgets');
    expect(json.result.capabilities).toHaveProperty('tools');
    expect(json.result.instructions).toContain('show_widget');
  });

  it('lists the full tool surface with MCP Apps metadata on the renderer', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const { result } = await res.json();
    const names = result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining(['show_widget', 'find_activity', 'build_pathway', 'score_draft']),
    );
    const show = result.tools.find((tool: { name: string }) => tool.name === 'show_widget');
    expect(show._meta.ui.resourceUri).toMatch(/^ui:\/\//);
  });

  it('takes audienceHint, not a grade, and keeps the alias show_widget shipped with', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 21, method: 'tools/list' });
    const { result } = await res.json();
    const props = (name: string) =>
      result.tools.find((tool: { name: string }) => tool.name === name).inputSchema.properties;

    // Segment-neutral by name: nothing in the surface presumes the learner
    // is in a grade, so a higher-ed or workplace deployment has an honest
    // argument to pass instead of one that lies.
    for (const name of ['show_widget', 'find_activity', 'build_pathway']) {
      expect(props(name).audienceHint?.type).toBe('string');
      // `audience` on a manifest is scheme-scoped and graph-derived. The tool
      // input is unverified caller text, so it must not borrow the bare name.
      expect(props(name)).not.toHaveProperty('audience');
    }

    // These two are new here, so they never carried the old name.
    expect(props('find_activity')).not.toHaveProperty('gradeHint');
    expect(props('build_pathway')).not.toHaveProperty('gradeHint');

    // show_widget shipped with `gradeHint`; removing it would break callers
    // written against the deployed tool, so it stays accepted.
    expect(props('show_widget')).toHaveProperty('gradeHint');
  });

  it('serves the shell resource listing', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
    const { result } = await res.json();
    expect(result.resources[0].mimeType).toBe('text/html;profile=mcp-app');
  });

  it('rejects unknown methods and unknown tools without throwing', async () => {
    const method = await rpc({ jsonrpc: '2.0', id: 4, method: 'no/such-method' });
    expect((await method.json()).error.code).toBe(-32601);

    const tool = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'no_such_tool' } });
    expect((await tool.json()).error.code).toBe(-32602);
  });

  it('answers malformed bodies with a parse error, not a crash', async () => {
    const res = await POST(
      new Request('https://example.test/api/mcp', { method: 'POST', body: 'not json' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(-32700);
  });

  it('requires a topic before spending a build_pathway run', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'build_pathway', arguments: {} },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/topic/i);
  });
});
