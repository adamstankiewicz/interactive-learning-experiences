/**
 * The MCP server that puts our widgets inside a chat.
 *
 * One resource, not one per widget. `ui://widget/shell` is the bundle from
 * `build.mjs`, which contains the whole widget registry — so every widget we
 * have and every one we add renders through the same resource. The tool's job
 * is only to produce a spec and point at that shell.
 *
 *   pnpm build && node mcp/build.mjs      # produce the shell
 *   node mcp/server.mjs                   # run this (stdio)
 *
 * MCP Apps (SEP-1865) is an extension, not part of the SDK: `_meta.ui` is
 * hand-written below because `registerTool`/`registerResource` know nothing
 * about it.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = dirname(fileURLToPath(import.meta.url));
const SHELL_URI = 'ui://widget/shell';
const API_ORIGIN = process.env.WIDGET_API_ORIGIN ?? 'http://localhost:3100';

function shellHtml() {
  const html = readFileSync(join(root, 'dist', 'widget-shell.html'), 'utf8');
  // The bundle is built with a default origin; rewrite it so one build can be
  // pointed at whichever dev server is actually running.
  return html.replace(/window\.__API_ORIGIN__ = window\.__API_ORIGIN__ \|\| '[^']*'/, `window.__API_ORIGIN__ = '${API_ORIGIN}'`);
}

/** Stand-in for a pathway. Step 3 is calling the real generator for these. */
const DEMO_SPEC = {
  kind: 'draft-meter',
  learningComponentId: null,
  question:
    'Does this argument hold up? Say what you think — and point to what in the editorial makes you say so.',
  placeholder: 'The editorial says…',
  standardCode: 'RI.8.8',
  standardDescription:
    'Delineate and evaluate the argument and specific claims in a text, assessing whether the reasoning is sound and the evidence is relevant and sufficient.',
  standardForStudents:
    'You’re judging someone else’s argument. Say whether it holds up, point at a specific bit of the editorial, and explain why that bit does or doesn’t prove their point.',
  passage: {
    source: 'School newspaper editorial',
    text: 'Phones should be banned from every classroom in this school. Last year, test scores in Ms. Alvarez’s class dropped by six points. A study of one thousand adults found that most people check their phones over eighty times a day. Clearly, phones are the reason our school is struggling.',
  },
  checks: [
    { id: 'position', label: 'a position', lookFor: 'Says whether the argument holds up.', essential: false },
    {
      id: 'source',
      label: 'evidence from the text',
      lookFor: 'Points at a specific claim in the editorial.',
      essential: false,
    },
    {
      id: 'why',
      label: 'why it does or does not fit',
      lookFor: 'Explains whether that evidence is relevant and sufficient.',
      essential: false,
    },
  ],
};

const server = new McpServer({ name: 'interactive-learning-widgets', version: '0.1.0' });

server.registerResource(
  'widget-shell',
  SHELL_URI,
  {
    title: 'Interactive widget shell',
    description: 'Renders any learning widget spec.',
    mimeType: 'text/html;profile=mcp-app',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'text/html;profile=mcp-app',
        text: shellHtml(),
      },
    ],
  }),
);

server.registerTool(
  'show_draft_meter',
  {
    title: 'Show a Draft Meter',
    description:
      'Display an interactive Draft Meter: the student writes a short response and a live meter scores it against a standard. Use when a student wants to practise writing an argument or analysing a source.',
    inputSchema: {
      topic: z
        .string()
        .optional()
        .describe('Optional topic. Ignored by the spike, which always returns the sample editorial.'),
    },
    // MCP Apps: this is the whole declaration that turns a tool into a UI.
    _meta: {
      ui: {
        resourceUri: SHELL_URI,
        visibility: ['model', 'app'],
        // The host blocks connections to undeclared origins, so the scoring
        // endpoint has to be named here or the meter cannot score.
        csp: { connect: [API_ORIGIN] },
        prefersBorder: false,
      },
    },
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: 'Draft Meter ready — a short editorial to evaluate, scored live as the student types.',
      },
    ],
    structuredContent: { spec: DEMO_SPEC },
    _meta: { ui: { resourceUri: SHELL_URI } },
  }),
);

await server.connect(new StdioServerTransport());
