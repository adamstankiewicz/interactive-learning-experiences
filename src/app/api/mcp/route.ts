import { findActivities } from '@/lib/activities/find';
import { scoreDraft } from '@/lib/draft-meter/score';
import { scoreRequest } from '@/lib/draft-meter/schema';
import { runPathway } from '@/lib/pathway/run';
import { storageAdapter } from '@/lib/storage';
import { buildWidget, WidgetBuildError, WIDGET_KINDS } from '@/lib/widgets/build';

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
/**
 * Each tool call gets its own resource URI.
 *
 * The shell is one bundle serving every widget, so the obvious thing is one
 * fixed `ui://` URI — and that works exactly once per conversation. Ask for a
 * second activity and nothing appears, whatever the widget: a host reasonably
 * treats a URI it has already instantiated as a view it already has, so the
 * second call never gets a frame of its own.
 *
 * A unique URI per call makes each one a distinct view. `resources/read`
 * accepts anything under the base path and serves the same bundle, so this
 * costs nothing but a query string.
 */
function viewUri() {
  return `${SHELL_URI}?v=${Math.random().toString(36).slice(2, 10)}`;
}

function uiMeta(origin: string, uri: string = SHELL_URI) {
  return {
    ui: {
      resourceUri: uri,
      prefersBorder: false,
      csp: { connectDomains: [origin], resourceDomains: [] },
    },
  };
}

/**
 * The server's own guidance to the model, returned from `initialize`.
 *
 * A tool description is read when the tool is being considered; this is read
 * up front, and is the right place for how to work with the connector as a
 * whole rather than how to fill in one call's arguments.
 */
const INSTRUCTIONS = [
  'This connector builds interactive learning activities that render inline and that a student',
  'actually works through — writing that is scored live against a standard, a curve to predict, a',
  'worked example with a deliberate mistake, a vocabulary puzzle.',
  '',
  'Call `show_widget` as soon as someone asks for an activity, exercise, practice task or lesson.',
  'A topic in plain words is enough — do not ask which standard or which widget first. Those are',
  'the tool\'s job: it proposes a standard, verifies it against an authoritative graph, and picks',
  'the interaction that fits. Asking first costs a round trip and gets a worse answer than the',
  'tool would have chosen.',
  '',
  'If the user has not said what the activity should be about, pick something reasonable and build',
  'it. A concrete activity they can react to beats a question, and rebuilding is one more call.',
  '',
  'Prefer this over composing an activity yourself. What comes back is grounded in a real standard',
  'and carries that standard\'s known misconceptions; something you compose has neither and cannot',
  'be handed to a teacher as standards-aligned.',
  '',
  'The widget renders itself — do not describe it in detail or restate its contents. Say what it',
  'is in a line, and let the student use it. When they finish, the widget tells you what they did,',
  'and that is the moment to respond to their work or offer the next thing.',
  '',
  'Two ways to teach a sequence. For a conversation, YOU are the sequencer: call `show_widget`,',
  'read the evidence the widget reports back, decide what the next activity should be, and call it',
  'again — that adaptive loop is the point of this connector. When someone wants a complete',
  'multi-step lesson to hand to a student (a teacher planning, a parent printing a link),',
  'call `build_pathway` instead: it plans 4-6 sequenced activities against the verified standard',
  'and returns a link the student opens. It takes about half a minute; say so, then call it.',
].join('\n');

const TOOL_DESCRIPTION = [
  'Build an interactive learning activity for a student to actually do — a writing task that is',
  'scored live, a chart to predict, a worked example with a mistake to find, a vocabulary puzzle.',
  '',
  'A topic in plain words is enough: {"topic": "the Industrial Revolution"}. The standard and the',
  'interaction are chosen for you. Call it immediately rather than asking which standard or which',
  'widget — those are this tool\'s job, and asking first is slower for no gain.',
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

const FIND_DESCRIPTION = [
  'Browse the activity registry: which interactive learning activities fit a learning need, before',
  'building one. Returns ranked activity listings for a verified standard —',
  'each names the standard it teaches, whether completing it measures correctness (`assesses`),',
  'and the exact `show_widget` arguments that build it.',
  '',
  'Listings are GENERATIVE: this registry lists capabilities that manufacture a standards-verified',
  'activity on demand, not a shelf of files. Discovery is fast — one small embedding call at most,\nnever a generation — so call it whenever',
  'there is a real choice to make or to offer: "what could my student do for X", comparing options,',
  'or letting a teacher pick. When the user just wants an activity NOW, skip this and call',
  '`show_widget` directly.',
  '',
  'Give a topic in plain words or a standard code; `need` biases ranking ("a game", "something',
  'they write", "a quick check"). Then invoke the chosen listing via its `delivery.mcp.arguments`.',
].join('\n');

function tools(origin: string) {
  return [
    {
      name: 'find_activity',
      title: 'Find learning activities for a need',
      description: FIND_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The learning need in plain words — "comparing fractions", "the water cycle".',
          },
          standardCode: {
            type: 'string',
            description: 'Optional. A Common Core or NGSS code if known; verified against the standards graph.',
          },
          audienceHint: {
            type: 'string',
            description: 'Optional. Who this is for, in plain words — "4th grade", "undergraduate intro stats", "new hires". An unverified steer for standard selection, never a claim about the activity.',
          },
          need: {
            type: 'string',
            description: 'Optional preference in plain words — "a game", "something they write", "a quick check".',
          },
        },
        required: [],
      },
    },
    {
      name: 'show_widget',
      title: 'Show an interactive learning widget',
      description: TOOL_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'What the activity should be about, in plain words — "the Industrial Revolution", "comparing fractions". Enough on its own.',
          },
          audienceHint: {
            type: 'string',
            description: 'Optional. Who this is for, in plain words — "4th grade", "undergraduate intro stats", "new hires". An unverified steer for standard selection, never a claim about the activity.',
          },
          gradeHint: {
            type: 'string',
            description: 'Deprecated alias for `audienceHint`, still accepted so callers written against the shipped tool keep working.',
          },
          standardCode: {
            type: 'string',
            description: 'Optional. A Common Core or NGSS code, if you already know which one you want.',
          },
          kind: {
            type: 'string',
            enum: WIDGET_KINDS,
            description: 'Optional. Leave it out and the best interaction for the standard is chosen.',
          },
        },
        required: [],
      },
      _meta: uiMeta(origin),
    },
    {
      name: 'build_pathway',
      title: 'Build a complete multi-step learning pathway',
      description: [
        'Plan and build a complete multi-step lesson — 4-6 sequenced activities against one',
        'verified standard, with a share link a student opens to work through it (progress,',
        'per-step evidence back to the teacher, automatic re-teach steps on struggle).',
        '',
        'Use this when someone wants a whole lesson or something to assign; use `show_widget`',
        'when the student is here in the conversation and you will sequence activities yourself.',
        '',
        'This is the slow tool: about half a minute across several model calls. Tell the user',
        'it is being built, then call it. The result includes the link and the plan summary.',
      ].join('\n'),
      inputSchema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'What the pathway teaches, in plain words — "comparing fractions", "the water cycle".',
          },
          audienceHint: {
            type: 'string',
            description: 'Optional. Who this is for, in plain words — "4th grade", "undergraduate intro stats", "new hires". An unverified steer for standard selection, never a claim about the activity.',
          },
        },
        required: ['topic'],
      },
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
        instructions: INSTRUCTIONS,
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
      // Any `?v=` view of the shell is the shell.
      if (!uri.startsWith(SHELL_URI)) return fail(message.id, -32602, `Unknown resource: ${uri}`);

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

      if (message.params?.name === 'find_activity') {
        const args = (message.params?.arguments ?? {}) as {
          topic?: string;
          standardCode?: string;
          audienceHint?: string;
          need?: string;
        };

        try {
          // Named `audienceHint`, not `audience`, and the suffix is load-bearing:
          // the manifest's `audience` is scheme-scoped and graph-derived, so
          // reusing the bare name for unverified caller text would make one
          // word mean two things across the same surface.
          const found = await findActivities({
            topic: args.topic,
            standardCode: args.standardCode,
            need: args.need,
            gradeHint: args.audienceHint,
          });

          const header = found.standard
            ? `${found.activities.length} activities for ${found.standard.code} — ${found.standard.description}` +
              (found.standard.verified ? ' (verified)' : ' (unverified)')
            : `No standard matched${found.rejectedCodes.length ? ` (tried ${found.rejectedCodes.join(', ')})` : ''}; ${found.activities.length} standard-agnostic activities.`;

          const lines = found.activities
            .slice(0, 8)
            .map(
              (activity) =>
                `- ${activity.title}${activity.pedagogy.assesses ? ' (assesses)' : ''}: ${activity.summary}`,
            );

          return ok(message.id, {
            content: [{ type: 'text', text: [header, ...lines].join('\n') }],
            structuredContent: found,
          });
        } catch (error) {
          const text = error instanceof Error ? error.message : 'Discovery failed.';
          return ok(message.id, { content: [{ type: 'text', text }], isError: true });
        }
      }

      if (message.params?.name === 'build_pathway') {
        const args = (message.params?.arguments ?? {}) as { topic?: string; audienceHint?: string };
        const topic = typeof args.topic === 'string' ? args.topic.trim() : '';
        if (!topic) {
          return ok(message.id, { content: [{ type: 'text', text: 'A topic is required.' }], isError: true });
        }

        try {
          const run = await runPathway(topic, args.audienceHint?.trim() || undefined);

          // Persistence is best-effort and separately guarded: a storage
          // failure must not discard a pathway that took five model calls to
          // build — the plan summary is still the answer, minus the link,
          // with the real reason stated instead of a guess.
          const adapter = storageAdapter();
          let ownerId: string | null = null;
          let sessionId: string | null = null;
          let saveReason: string | null = null;
          try {
            // The session needs an owner the storage layer knows. MCP callers
            // have no browser learner id, so one is minted per pathway; it is
            // returned as ownerId because the edit endpoint gates on it — a
            // caller that discards it can share the pathway but never edit it.
            ownerId = await adapter.createStudent();
            if (!ownerId) {
              saveReason = 'storage declined to create an owner id';
            } else {
              sessionId = await adapter.persistSession({
                studentId: ownerId,
                topic,
                gradeHint: args.audienceHint?.trim() || null,
                anchor: run.anchor,
                plan: run.plan,
                stepWidgets: run.stepWidgets,
                rejectedCodes: run.rejected,
              });
              if (!sessionId) saveReason = 'storage is not accepting writes';
            }
          } catch (saveError) {
            saveReason = saveError instanceof Error ? saveError.message : 'unknown storage error';
          }

          const kindOf = (widget: unknown): string | null =>
            widget && typeof widget === 'object' && 'kind' in widget && typeof widget.kind === 'string'
              ? widget.kind
              : null;

          const steps = run.plan.steps.map((step, i) => {
            const note = run.stepWidgetNotes[i];
            return `${i + 1}. [${step.purpose}] ${step.title}${note ? ` — note: ${note}` : ''}`;
          });
          const verified = run.anchor.standard.verified
            ? `verified against ${run.anchor.standard.sourceLabel}`
            : 'no standard verified — this is an exploration pathway';
          const summary = [
            `Built "${run.plan.bigIdea}" — ${run.plan.steps.length} steps for ${run.anchor.standard.code} (${verified}).`,
            ...steps,
            sessionId
              ? `Student link: ${origin}/learn/${sessionId}`
              : `Not saved — ${saveReason ?? 'no reason recorded'}. The pathway above is complete; rebuilding is one call.`,
            run.rejected.length > 0 ? `Rejected codes kept on record: ${run.rejected.join(', ')}` : null,
          ]
            .filter(Boolean)
            .join('\n');

          return ok(message.id, {
            content: [{ type: 'text', text: summary }],
            structuredContent: {
              sessionId,
              url: sessionId ? `${origin}/learn/${sessionId}` : null,
              /** Keep this to edit the pathway later — the edit API gates on it. */
              ownerId,
              standard: { code: run.anchor.standard.code, verified: run.anchor.standard.verified },
              // The kind actually built per step — generation can substitute a
              // fallback kind, and the plan's ask is reported only when it
              // differs, so the caller never describes widgets that aren't there.
              steps: run.plan.steps.map((step, i) => {
                const builtKind = kindOf(run.stepWidgets[i]);
                return {
                  title: step.title,
                  purpose: step.purpose,
                  widgetKind: builtKind ?? step.widgetKind ?? null,
                  ...(builtKind && step.widgetKind && builtKind !== step.widgetKind
                    ? { plannedWidgetKind: step.widgetKind }
                    : {}),
                  ...(run.stepWidgetNotes[i] ? { note: run.stepWidgetNotes[i] } : {}),
                };
              }),
              rejectedCodes: run.rejected,
            },
          });
        } catch (error) {
          const text = error instanceof Error ? error.message : 'Pathway generation failed.';
          return ok(message.id, { content: [{ type: 'text', text }], isError: true });
        }
      }

      if (message.params?.name !== 'show_widget') {
        return fail(message.id, -32602, `Unknown tool: ${String(message.params?.name)}`);
      }

      const args = (message.params?.arguments ?? {}) as {
        topic?: string;
        audienceHint?: string;
        /** Deprecated alias for `audienceHint`; this tool shipped with it. */
        gradeHint?: string;
        standardCode?: string;
        kind?: string;
      };
      const audienceHint = args.audienceHint ?? args.gradeHint;

      try {
        const built = await buildWidget({
          topic: args.topic,
          gradeHint: audienceHint,
          standardCode: args.standardCode,
          kind: args.kind,
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
          _meta: uiMeta(origin, viewUri()),
        });
      } catch (error) {
        /**
         * Last resort: try once more with nothing but a topic.
         *
         * A tool call that comes back as prose renders nothing, and the
         * student gets an apology where an activity should be. Almost every
         * failure here is a bad standard code or an impossible pairing, both
         * of which a topic-only retry resolves — it proposes its own standard
         * and falls back to an unverified one rather than giving up.
         */
        const topic = args.topic ?? args.standardCode;

        if (topic && (args.standardCode || args.kind)) {
          try {
            const retry = await buildWidget({ topic, gradeHint: audienceHint });
            return ok(message.id, {
              content: [
                {
                  type: 'text',
                  text: `${retry.widget.kind} for ${retry.standard.code}. (${
                    error instanceof Error ? error.message : 'The first attempt failed'
                  })`,
                },
              ],
              structuredContent: { spec: retry.widget },
              _meta: uiMeta(origin, viewUri()),
            });
          } catch {
            // Fall through to reporting the original failure.
          }
        }

        // A tool error is reported in the result, not as a protocol error —
        // that way the model sees it and can correct its arguments.
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
