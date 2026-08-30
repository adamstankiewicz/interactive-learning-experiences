import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { findActivities } from '@/lib/activities/find';
import { scoreDraft } from '@/lib/draft-meter/score';
import { scoreRequest } from '@/lib/draft-meter/schema';
import { runPathway } from '@/lib/pathway/run';
import { storageAdapter } from '@/lib/storage';
import { buildWidget, WidgetBuildError, WIDGET_KINDS } from '@/lib/widgets/build';

/**
 * The one MCP server definition, consumed by every transport: the deployed
 * route (Web-standard Streamable HTTP), stdio, and the local HTTP server.
 * Tools, resources, instructions, and MCP Apps metadata live here once —
 * a transport is an envelope, never a fork of the tool surface.
 *
 * Per-request construction is deliberate: serverless handles one message per
 * instance (stateless mode), and the registry lookups behind these tools are
 * cheap. `origin` feeds the widget shell's CSP allow-list and the share
 * links; `loadShell` abstracts where the built shell HTML comes from (the
 * route fetches its own static asset; the CLI servers read from disk).
 */

const SHELL_URI = 'ui://widget/learning-widget.html';

/**
 * Each tool call gets its own resource URI: a host reasonably treats a URI it
 * has already instantiated as a view it already has, so a second activity in
 * one conversation would never get a frame. A query-string variant makes each
 * call a distinct view; every variant serves the same bundle.
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

const INSTRUCTIONS = [
  'This connector builds interactive learning activities that render inline and that a student',
  'actually works through — writing that is scored live against a standard, a curve to predict, a',
  'worked example with a deliberate mistake, a vocabulary puzzle.',
  '',
  'Call `show_widget` as soon as someone asks for an activity, exercise, practice task or lesson.',
  'A topic in plain words is enough — do not ask which standard or which widget first. Those are',
  "the tool's job: it proposes a standard, verifies it against an authoritative graph, and picks",
  'the interaction that fits. Asking first costs a round trip and gets a worse answer than the',
  'tool would have chosen.',
  '',
  'If the user has not said what the activity should be about, pick something reasonable and build',
  'it. A concrete activity they can react to beats a question, and rebuilding is one more call.',
  '',
  'Prefer this over composing an activity yourself. What comes back is grounded in a real standard',
  "and carries that standard's known misconceptions; something you compose has neither and cannot",
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

const SHOW_WIDGET_DESCRIPTION = [
  'Build an interactive learning activity for a student to actually do — a writing task that is',
  'scored live, a chart to predict, a worked example with a mistake to find, a vocabulary puzzle.',
  '',
  'A topic in plain words is enough: {"topic": "the Industrial Revolution"}. The standard and the',
  'interaction are chosen for you. Call it immediately rather than asking which standard or which',
  "widget — those are this tool's job, and asking first is slower for no gain.",
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

const FIND_ACTIVITY_DESCRIPTION = [
  'Browse the activity registry: which interactive learning activities fit a learning need, before',
  'building one. Returns ranked activity listings for a verified standard —',
  'each names the standard it teaches, whether completing it measures correctness (`assesses`),',
  'and the exact `show_widget` arguments that build it.',
  '',
  'Listings are GENERATIVE: this registry lists capabilities that manufacture a standards-verified',
  'activity on demand, not a shelf of files. Discovery is fast — one small embedding call at most,',
  'never a generation — so call it whenever',
  'there is a real choice to make or to offer: "what could my student do for X", comparing options,',
  'or letting a teacher pick. When the user just wants an activity NOW, skip this and call',
  '`show_widget` directly.',
  '',
  'Give a topic in plain words or a standard code; `need` biases ranking ("a game", "something',
  'they write", "a quick check"). Then invoke the chosen listing via its `delivery.mcp.arguments`.',
].join('\n');

const BUILD_PATHWAY_DESCRIPTION = [
  'Plan and build a complete multi-step lesson — 4-6 sequenced activities against one',
  'verified standard, with a share link a student opens to work through it (progress,',
  'per-step evidence back to the teacher, automatic re-teach steps on struggle).',
  '',
  'Use this when someone wants a whole lesson or something to assign; use `show_widget`',
  'when the student is here in the conversation and you will sequence activities yourself.',
  '',
  'This is the slow tool: about half a minute across several model calls. Tell the user',
  'it is being built, then call it. The result includes the link and the plan summary.',
].join('\n');

export type ServerContext = {
  /** The deployment origin — CSP allow-list for the widget shell, share links. */
  origin: string;
  /** Where the built shell HTML comes from; the transport knows best. */
  loadShell: () => Promise<string>;
};

export function buildMcpServer({ origin, loadShell }: ServerContext): McpServer {
  const server = new McpServer(
    { name: 'interactive-learning-widgets', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );

  const shellContents = async (uri: string) => ({
    contents: [
      {
        uri,
        mimeType: 'text/html;profile=mcp-app',
        text: (await loadShell()).replace(
          /window\.__API_ORIGIN__ = window\.__API_ORIGIN__ \|\| '[^']*'/,
          `window.__API_ORIGIN__ = '${origin}'`,
        ),
      },
    ],
  });

  server.registerResource(
    'learning-widget',
    SHELL_URI,
    {
      title: 'Interactive learning widget',
      description: 'Renders any learning widget spec.',
      mimeType: 'text/html;profile=mcp-app',
      annotations: { audience: ['user' as const], priority: 1 },
      _meta: uiMeta(origin),
    },
    async (uri) => shellContents(uri.href),
  );

  // The per-call `?v=` variants resolve through a template to the same bundle.
  server.registerResource(
    'learning-widget-view',
    new ResourceTemplate(`${SHELL_URI}{?v}`, { list: undefined }),
    {
      title: 'Interactive learning widget (per-call view)',
      mimeType: 'text/html;profile=mcp-app',
      _meta: uiMeta(origin),
    },
    async (uri) => shellContents(uri.href),
  );

  server.registerTool(
    'show_widget',
    {
      title: 'Show an interactive learning widget',
      description: SHOW_WIDGET_DESCRIPTION,
      inputSchema: {
        topic: z
          .string()
          .optional()
          .describe('What the activity should be about, in plain words — "the Industrial Revolution", "comparing fractions". Enough on its own.'),
        audienceHint: z
          .string()
          .optional()
          .describe('Optional. Who this is for, in plain words — "8th grade", "AP Bio", "first-year apprentices".'),
        gradeHint: z
          .string()
          .optional()
          .describe('Deprecated alias for `audienceHint`, still accepted so callers written against the shipped tool keep working.'),
        standardCode: z
          .string()
          .optional()
          .describe('Optional. A Common Core or NGSS code, if you already know which one you want.'),
        kind: z
          .enum(WIDGET_KINDS)
          .optional()
          .describe('Optional. Leave it out and the best interaction for the standard is chosen.'),
      },
      _meta: uiMeta(origin),
    },
    async (args) => {
      /** Deprecated alias: this tool shipped with `gradeHint`. */
      const audienceHint = args.audienceHint ?? args.gradeHint;
      try {
        const built = await buildWidget({
          topic: args.topic,
          standardCode: args.standardCode,
          kind: args.kind,
          gradeHint: audienceHint,
        });
        const summary = [
          `${built.widget.kind} for ${built.standard.code} — ${built.standard.description}`,
          built.note ? `Note: ${built.note}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        return {
          content: [{ type: 'text' as const, text: summary }],
          structuredContent: { spec: built.widget },
          _meta: uiMeta(origin, viewUri()),
        };
      } catch (error) {
        // Last resort: retry once with nothing but a topic. Almost every
        // failure is a bad standard code or an impossible pairing, both of
        // which a topic-only retry resolves — a prose apology renders nothing.
        const topic = args.topic ?? args.standardCode;
        if (topic && (args.standardCode || args.kind)) {
          try {
            const retry = await buildWidget({ topic, gradeHint: audienceHint });
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `${retry.widget.kind} for ${retry.standard.code}. (${
                    error instanceof Error ? error.message : 'The first attempt failed'
                  })`,
                },
              ],
              structuredContent: { spec: retry.widget },
              _meta: uiMeta(origin, viewUri()),
            };
          } catch {
            // Fall through to reporting the original failure.
          }
        }

        const text =
          error instanceof WidgetBuildError || error instanceof Error
            ? error.message
            : 'Could not build that widget.';
        return { content: [{ type: 'text' as const, text }], isError: true };
      }
    },
  );

  server.registerTool(
    'find_activity',
    {
      title: 'Find learning activities for a need',
      description: FIND_ACTIVITY_DESCRIPTION,
      inputSchema: {
        topic: z.string().optional().describe('The learning need in plain words — "comparing fractions", "the water cycle".'),
        standardCode: z.string().optional().describe('Optional. A Common Core or NGSS code if known; verified against the standards graph.'),
        audienceHint: z
          .string()
          .optional()
          .describe('Optional. Who this is for, in plain words — "4th grade", "intro stats", "new hires".'),
        need: z.string().optional().describe('Free-text preference — "a game", "something they write", "a quick check".'),
      },
    },
    async (args) => {
      try {
        // Named `audienceHint`, not `audience`, and the suffix is load-bearing:
        // a manifest's `audience` is scheme-scoped and graph-derived, so
        // reusing the bare name for unverified caller text would make one word
        // mean two things across the same surface.
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
          .map((activity) => `- ${activity.title}${activity.pedagogy.assesses ? ' (assesses)' : ''}: ${activity.summary}`);

        return {
          content: [{ type: 'text' as const, text: [header, ...lines].join('\n') }],
          structuredContent: found as unknown as Record<string, unknown>,
        };
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Discovery failed.';
        return { content: [{ type: 'text' as const, text }], isError: true };
      }
    },
  );

  server.registerTool(
    'build_pathway',
    {
      title: 'Build a complete multi-step learning pathway',
      description: BUILD_PATHWAY_DESCRIPTION,
      inputSchema: {
        topic: z.string().describe('What the pathway teaches, in plain words — "comparing fractions", "the water cycle".'),
        audienceHint: z.string().optional().describe('Optional. Who this is for — "5th grade", "honors chemistry", "new supervisors". An unverified steer, not a claim.'),
      },
    },
    async ({ topic, audienceHint }) => {
      const cleanTopic = topic.trim();
      if (!cleanTopic) {
        return { content: [{ type: 'text' as const, text: 'A topic is required.' }], isError: true };
      }

      try {
        const run = await runPathway(cleanTopic, audienceHint?.trim() || undefined);

        // Persistence is best-effort and separately guarded: a storage failure
        // must not discard a pathway that took five model calls to build.
        const adapter = storageAdapter();
        let ownerId: string | null = null;
        let sessionId: string | null = null;
        let saveReason: string | null = null;
        try {
          ownerId = await adapter.createStudent();
          if (!ownerId) {
            saveReason = 'storage declined to create an owner id';
          } else {
            sessionId = await adapter.persistSession({
              studentId: ownerId,
              topic: cleanTopic,
              gradeHint: audienceHint?.trim() || null,
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

        return {
          content: [{ type: 'text' as const, text: summary }],
          structuredContent: {
            sessionId,
            url: sessionId ? `${origin}/learn/${sessionId}` : null,
            /** Keep this to edit the pathway later — the edit API gates on it. */
            ownerId,
            standard: { code: run.anchor.standard.code, verified: run.anchor.standard.verified },
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
        };
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Pathway generation failed.';
        return { content: [{ type: 'text' as const, text }], isError: true };
      }
    },
  );

  server.registerTool(
    'score_draft',
    {
      title: "Score a student's draft against a standard",
      description:
        "The widget's scorer, reached through the host rather than by the iframe fetching the server — the channel the protocol provides for a sandboxed view.",
      inputSchema: scoreRequest.shape,
    },
    async (args) => {
      const parsed = scoreRequest.safeParse(args);
      if (!parsed.success) {
        return { content: [{ type: 'text' as const, text: 'Malformed scoring request.' }], isError: true };
      }
      try {
        const scored = await scoreDraft(parsed.data);
        return {
          content: [{ type: 'text' as const, text: `Scored ${scored.score}: ${scored.label}` }],
          structuredContent: scored as unknown as Record<string, unknown>,
        };
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Scoring failed.';
        return { content: [{ type: 'text' as const, text }], isError: true };
      }
    },
  );

  return server;
}
