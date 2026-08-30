import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { buildMcpServer } from '@/lib/mcp/server';
import { WIDGET_KINDS } from '@/lib/widgets/build';

// Long enough for `build_pathway` (~30s across five model calls), not just
// the single-call `show_widget`.
export const maxDuration = 120;

/**
 * The MCP server, deployed with the app.
 *
 * Running this as a route rather than a separate process is what turns
 * "clone the repo, build the bundle, run two servers, point a connector at
 * your own laptop" into "add this URL". Anyone can use it; nobody installs
 * anything.
 *
 * The protocol lives in the official SDK: `buildMcpServer` defines the tool
 * surface once for every transport, and this route is only the Web-standard
 * Streamable HTTP envelope — stateless, one server instance per request,
 * which is exactly the serverless shape. (This replaced a hand-written
 * JSON-RPC dispatcher: the SDK's web-standard transport and `_meta`
 * passthrough made both original reasons for hand-rolling obsolete.)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
};

/** Where the built shell lives. `mcp/build.mjs` writes it into `public/`. */
const SHELL_PATH = '/widget-shell.html';

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** A GET here is a human checking the URL works, not a client. Say something useful. */
export async function GET(request: Request) {
  return Response.json(
    {
      name: 'interactive-learning-widgets',
      transport: 'streamable-http',
      hint: 'Add this URL as a custom connector in Claude, then ask for a learning widget.',
      widgetKinds: WIDGET_KINDS,
      shell: new URL(SHELL_PATH, request.url).href,
    },
    { headers: CORS },
  );
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  const server = buildMcpServer({
    origin,
    // Served from `public/` rather than read off disk: on a serverless
    // deployment the static asset is the thing guaranteed to be there.
    loadShell: async () => {
      const shell = await fetch(new URL(SHELL_PATH, request.url));
      if (!shell.ok) {
        throw new Error('The widget shell is missing — run `pnpm mcp:build` and redeploy.');
      }
      return shell.text();
    },
  });

  // Stateless: no session id generator — each request is complete in itself.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  const response = await transport.handleRequest(request);

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}
