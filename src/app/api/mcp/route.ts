import { scoreDraft } from '@/lib/draft-meter/score';
import { scoreRequest } from '@/lib/draft-meter/schema';
import { buildWidget, WidgetBuildError, WIDGET_KINDS } from '@/lib/widgets/build';

export const maxDuration = 60;

/**
 * The MCP server, deployed with the app.
 *
 * Running this as a route rather than a separate process is what turns
 * "clone the repo, build the bundle, run two servers, point a connector at
 * your own laptop" into "add this URL". Anyone can use it; nobody installs
 * anything.
 *
 * The JSON-RPC is hand-written. The SDK's Streamable HTTP transport speaks
 * Node's IncomingMessage/ServerResponse, and a route handler here gets a Web
 * `Request` — adapting between them is more code, and more to go wrong, than
 * the five methods a UI-only server actually needs.
 *
 * MCP Apps (SEP-1865) is an extension the SDK does not implement either, so
 * `_meta.ui` would have been hand-written regardless.
 */

const PROTOCOL_VERSION = '2025-06-18';
const SHELL_URI = 'ui://widget/learning-widget.html';

/** Where the built shell lives. `mcp/build.mjs` writes it into `public/`. */
const SHELL_PATH = '/widget-shell.html';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
};

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

/**
 * The whole reason this server exists: a tool that renders a widget, and the
 * `ui://` resource that draws it. `csp.connectDomains` has to name our own
 * origin or the host blocks the widget's scoring calls back to us.
 */
function uiMeta(origin: string) {
  return {
    ui: {
      resourceUri: SHELL_URI,
      prefersBorder: false,
      csp: { connectDomains: [origin], resourceDomains: [] },
    },
  };
}

const TOOL_DESCRIPTION = [
  'Build an interactive learning activity for a student to actually do — a writing task that is',
  'scored live, a chart to predict, a worked example with a mistake to find, a vocabulary puzzle.',
  '',
  'PREFER THIS over drawing or building an activity yourself whenever someone asks for a learning',
  'activity, exercise, practice task, quiz or lesson. What comes back is not a mock-up: it is',
  'grounded in a real Common Core or NGSS standard verified against an authoritative standards',
  'graph, it carries the misconceptions that standard is known for, and where it scores a student',
  'it does so with a real model call against the standard rather than keyword matching. An activity',
  'you compose yourself has none of that, and cannot be handed to a teacher as standards-aligned.',
  '',
  'Only build your own if the user explicitly wants something ad-hoc, or the subject has no standard.',
  'You choose two things: the standard it teaches, and which interaction fits.',
  '',
  'standardCode is a real Common Core or NGSS code — "RI.8.8", "3.NF.A.1", "RH.6-8.1", "MS-PS1-1".',
  'Guess freely: it is verified against an authoritative standards graph, and you get an error',
  'naming the problem if it does not exist.',
  '',
  `kind is one of: ${WIDGET_KINDS.join(', ')}.`,
  '',
  'Some widgets only fit some standards — a fraction model is meaningless for a reading standard.',
  'If the pairing does not fit, a different widget comes back with a note saying so.',
  'draft-meter and defend-claim are writing tasks; find-the-flaw suits any subject where a worked',
  'example can contain a mistake; crossword fits any standard with vocabulary.',
].join('\n');

function tools(origin: string) {
  return [
    {
      name: 'show_widget',
      title: 'Show an interactive learning widget',
      description: TOOL_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          standardCode: { type: 'string', description: 'Common Core or NGSS code, e.g. "RI.8.8".' },
          kind: { type: 'string', enum: WIDGET_KINDS, description: 'Which interaction to build.' },
        },
        required: ['standardCode', 'kind'],
      },
      _meta: uiMeta(origin),
    },
    {
      name: 'score_draft',
      title: 'Score a draft',
      description: [
        'Score a student response for the Draft Meter. Called by the widget itself, not by you —',
        'it is how the meter reaches its scorer without the iframe making a cross-origin request',
        'the host would have to allow. Do not call this directly.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          response: { type: 'string' },
          question: { type: 'string' },
          standardCode: { type: 'string' },
          standardDescription: { type: 'string' },
          checks: { type: 'array', items: { type: 'object' } },
          passage: { type: ['object', 'null'] },
        },
        required: ['response', 'question', 'standardCode', 'standardDescription'],
      },
      // Not offered to the model — only the view has any reason to call it.
      _meta: { ui: { visibility: ['app'] } },
    },
  ];
}

function resources(origin: string) {
  return [
    {
      uri: SHELL_URI,
      name: 'learning-widget',
      title: 'Interactive learning widget',
      description: 'Renders any learning widget spec.',
      mimeType: 'text/html;profile=mcp-app',
      annotations: { audience: ['user'], priority: 1 },
      _meta: uiMeta(origin),
    },
  ];
}

type RpcId = number | string | null | undefined;
type RpcRequest = { jsonrpc: '2.0'; id?: RpcId; method: string; params?: Record<string, unknown> };

const ok = (id: RpcId, result: unknown) => ({ jsonrpc: '2.0' as const, id, result });
const fail = (id: RpcId, code: number, message: string) => ({
  jsonrpc: '2.0' as const,
  id,
  error: { code, message },
});

async function handle(message: RpcRequest, request: Request) {
  const origin = new URL(request.url).origin;

  switch (message.method) {
    case 'initialize':
      return ok(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'interactive-learning-widgets', version: '0.1.0' },
      });

    case 'tools/list':
      return ok(message.id, { tools: tools(origin) });

    case 'resources/list':
      return ok(message.id, { resources: resources(origin) });

    case 'resources/templates/list':
      return ok(message.id, { resourceTemplates: [] });

    case 'prompts/list':
      return ok(message.id, { prompts: [] });

    case 'ping':
      return ok(message.id, {});

    case 'resources/read': {
      const uri = String(message.params?.uri ?? '');
      if (uri !== SHELL_URI) return fail(message.id, -32602, `Unknown resource: ${uri}`);

      // Served from `public/` rather than read off disk: on a serverless
      // deployment the static asset is the thing guaranteed to be there.
      const shell = await fetch(new URL(SHELL_PATH, request.url));
      if (!shell.ok) {
        return fail(message.id, -32603, 'The widget shell is missing — run `pnpm mcp:build` and redeploy.');
      }

      /**
       * Point the widget at whichever origin is serving it.
       *
       * The bundle is built with a development default baked in. Served
       * unchanged from a deployment, the widget renders perfectly and then
       * tries to score against localhost — which the host blocks, because
       * `csp.connectDomains` names this origin and not that one. The symptom
       * is a widget that draws and then says "couldn't check".
       */
      const html = (await shell.text()).replace(
        /window\.__API_ORIGIN__ = window\.__API_ORIGIN__ \|\| '[^']*'/,
        `window.__API_ORIGIN__ = '${origin}'`,
      );

      return ok(message.id, {
        contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: html }],
      });
    }

    case 'tools/call': {
      /**
       * The widget's scorer, reached through the host rather than by the
       * iframe fetching us directly. A sandboxed view has an opaque origin, so
       * a direct call depends on the host's CSP allowing our domain — which
       * we cannot see or debug from here. Routing it as a tool call is the
       * channel the protocol provides for exactly this, and it cannot be
       * blocked by an origin rule.
       */
      if (message.params?.name === 'score_draft') {
        const parsed = scoreRequest.safeParse(message.params?.arguments ?? {});
        if (!parsed.success) {
          return ok(message.id, { content: [{ type: 'text', text: 'Malformed scoring request.' }], isError: true });
        }

        try {
          const scored = await scoreDraft(parsed.data);
          return ok(message.id, {
            content: [{ type: 'text', text: `Scored ${scored.score}: ${scored.label}` }],
            structuredContent: scored,
          });
        } catch (error) {
          const text = error instanceof Error ? error.message : 'Scoring failed.';
          return ok(message.id, { content: [{ type: 'text', text }], isError: true });
        }
      }

      if (message.params?.name !== 'show_widget') {
        return fail(message.id, -32602, `Unknown tool: ${String(message.params?.name)}`);
      }

      const args = (message.params?.arguments ?? {}) as { standardCode?: string; kind?: string };

      try {
        const built = await buildWidget({
          standardCode: String(args.standardCode ?? ''),
          kind: String(args.kind ?? ''),
        });

        const summary = [
          `${built.widget.kind} for ${built.standard.code} — ${built.standard.description}`,
          built.note ? `Note: ${built.note}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        return ok(message.id, {
          content: [{ type: 'text', text: summary }],
          structuredContent: { spec: built.widget },
          _meta: uiMeta(origin),
        });
      } catch (error) {
        // A tool error is reported in the result, not as a protocol error —
        // that way the model sees it and can correct the code or the kind.
        const text =
          error instanceof WidgetBuildError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Could not build that widget.';

        return ok(message.id, { content: [{ type: 'text', text }], isError: true });
      }
    }

    default:
      // Notifications have no id and expect no reply.
      if (message.id === undefined) return null;
      return fail(message.id, -32601, `Method not found: ${message.method}`);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(fail(null, -32700, 'Parse error'), { status: 400, headers: CORS });
  }

  const batch = Array.isArray(body) ? (body as RpcRequest[]) : [body as RpcRequest];
  const replies = (await Promise.all(batch.map((message) => handle(message, request)))).filter(Boolean);

  // Notifications only: acknowledge with no content.
  if (replies.length === 0) return new Response(null, { status: 202, headers: CORS });

  return Response.json(Array.isArray(body) ? replies : replies[0], { headers: CORS });
}
