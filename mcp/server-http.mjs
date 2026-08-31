/**
 * Streamable HTTP transport — for adding as a *custom connector*.
 *
 * Why this exists: the stdio server registers fine in Claude Desktop (it
 * appears, its tools are listed, the tool is called) but the host never reads
 * the `ui://` resource, and Claude falls back to rebuilding the widget with
 * its own `visualize` tool.
 *
 * The one thing every MCP App that *does* render on this machine has in
 * common — Slack, Atlassian, Amplitude, Figma — is that it is a remote
 * connector, not a local stdio server. This is the experiment that tests
 * whether that is the reason.
 *
 *   node mcp/server-http.mjs          # http://localhost:3300/mcp
 *
 * Then add it in Claude: Settings -> Connectors -> Add custom connector.
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createHttpServer } from 'node:http';

import { createServer } from './core.mjs';

const PORT = Number(process.env.MCP_HTTP_PORT ?? 3300);

/**
 * Stateless: a fresh server and transport per request. Simpler than session
 * management and perfectly adequate here, where nothing is held between calls.
 */
const httpServer = createHttpServer(async (req, res) => {
  // A connector's browser-side view may preflight; allow it rather than debug
  // a CORS failure that has nothing to do with the thing being tested.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (!req.url?.startsWith('/mcp')) {
    res.writeHead(404).end('Not found');
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
  });

  try {
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('[mcp-http]', error);
    if (!res.headersSent) res.writeHead(500).end('Internal error');
  }
});

httpServer.listen(PORT, () => {
  console.error(`MCP (streamable http) on http://localhost:${PORT}/mcp`);
});
