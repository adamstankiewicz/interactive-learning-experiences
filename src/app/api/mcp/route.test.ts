import { describe, expect, it } from 'vitest';

import { POST } from './route';

/**
 * Protocol-level integration: drive the deployed endpoint's handler with real
 * Requests and assert the wire contract — the part a host depends on before
 * any model call happens. Tool *execution* is covered by unit tests
 * (find.test.ts, run.test.ts) and the eval-harness roadmap; this file pins
 * the envelope.
 */
async function rpc(body: unknown) {
  // A protocol-correct client: Streamable HTTP requires both Accept types,
  // and the response may arrive as SSE — normalize either to the JSON-RPC
  // payload so assertions read one shape.
  const res = await POST(
    new Request('https://example.test/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  const payload = res.headers.get('content-type')?.includes('text/event-stream')
    ? JSON.parse(
        text
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .pop() ?? 'null',
      )
    : text
      ? JSON.parse(text)
      : null;
  return { status: res.status, json: payload };
}

describe('/api/mcp protocol surface', () => {
  it('initializes with instructions and capabilities', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
    });
    expect(json.result.serverInfo.name).toBe('interactive-learning-widgets');
    expect(json.result.capabilities).toHaveProperty('tools');
    expect(json.result.instructions).toContain('show_widget');
  });

  it('lists the full tool surface with MCP Apps metadata on the renderer', async () => {
    const { json } = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const { result } = json;
    const names = result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining(['show_widget', 'find_activity', 'build_pathway', 'score_draft']),
    );
    const show = result.tools.find((tool: { name: string }) => tool.name === 'show_widget');
    expect(show._meta.ui.resourceUri).toMatch(/^ui:\/\//);
  });

  it('takes an audience hint, not a grade, and keeps the alias show_widget shipped with', async () => {
    const { json } = await rpc({ jsonrpc: '2.0', id: 21, method: 'tools/list' });
    const { result } = json;
    const props = (name: string) =>
      result.tools.find((tool: { name: string }) => tool.name === name).inputSchema.properties;

    // Segment-neutral by name: nothing in the surface presumes the learner
    // is in a grade, so a higher-ed or workplace deployment has an honest
    // argument to pass instead of one that lies. The `Hint` suffix is part
    // of the contract too — `audience` stays reserved for the scheme-scoped,
    // graph-verified field on emitted manifests.
    for (const name of ['show_widget', 'find_activity', 'build_pathway']) {
      expect(props(name).audienceHint?.type).toBe('string');
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
    const { json } = await rpc({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
    const { result } = json;
    expect(result.resources[0].mimeType).toBe('text/html;profile=mcp-app');
  });

  it('rejects unknown methods and unknown tools without throwing', async () => {
    const method = await rpc({ jsonrpc: '2.0', id: 4, method: 'no/such-method' });
    expect(method.json.error.code).toBe(-32601);

    // The SDK reports an unknown tool as a tool-result error (isError with
    // the -32602 text), not a protocol error — the model sees it and corrects.
    const tool = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } });
    expect(tool.json.result.isError).toBe(true);
    expect(tool.json.result.content[0].text).toContain('-32602');
  });

  it('answers malformed bodies with a parse error, not a crash', async () => {
    const res = await POST(
      new Request('https://example.test/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(-32700);
  });

  it('requires a topic before spending a build_pathway run', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'build_pathway', arguments: { topic: '  ' } },
    });
    // A missing required arg is a schema error (-32602) from the SDK; a
    // present-but-blank topic is the tool's own honest refusal.
    expect(json.result?.isError ?? (json.error?.code === -32602)).toBe(true);
  });
});
