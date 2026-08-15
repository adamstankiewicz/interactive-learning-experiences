/**
 * The server definition, independent of transport.
 *
 * Two transports use this: `server.mjs` (stdio, for a local config entry) and
 * `server-http.mjs` (Streamable HTTP, for adding as a custom connector). The
 * stdio path is not rendering its UI in Claude Desktop — every MCP App that
 * does render there is a remote connector — so the HTTP one exists to test
 * whether that is the reason.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = dirname(fileURLToPath(import.meta.url));
const SHELL_URI = 'ui://widget/learning-widget.html';
const API_ORIGIN = process.env.WIDGET_API_ORIGIN ?? 'http://localhost:3100';

function shellHtml() {
  const html = readFileSync(join(root, 'dist', 'widget-shell.html'), 'utf8');
  // The bundle is built with a default origin; rewrite it so one build can be
  // pointed at whichever dev server is actually running.
  return html.replace(/window\.__API_ORIGIN__ = window\.__API_ORIGIN__ \|\| '[^']*'/, `window.__API_ORIGIN__ = '${API_ORIGIN}'`);
}

export function createServer() {
  const server = new McpServer({ name: 'interactive-learning-widgets', version: '0.1.0' });

/**
 * `_meta.ui` goes on the RESOURCE, not only on the tool.
 *
 * This is the piece that was missing first time round, found by listing what
 * the shipping first-party apps declare: Atlassian's Jira widget and Slack's
 * message form both carry it here. And the CSP keys are `connectDomains` /
 * `resourceDomains` — not the `connect` that seemed the obvious guess, which
 * meant our scoring origin was never actually allow-listed.
 */
const UI_META = {
  ui: {
    resourceUri: SHELL_URI,
    prefersBorder: false,
    csp: {
      connectDomains: [API_ORIGIN],
      resourceDomains: [],
    },
  },
};

  server.registerResource(
  'learning-widget',
  SHELL_URI,
  {
    title: 'Interactive learning widget',
    description: 'Renders any learning widget spec — draft meter, crossword, drag activities.',
    mimeType: 'text/html;profile=mcp-app',
    annotations: { audience: ['user'], priority: 1 },
    _meta: UI_META,
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
    'show_widget',
    {
      title: 'Show an interactive learning widget',
      description: [
        'Render an interactive learning activity inline, for a student to actually do.',
        'You choose two things: the standard it teaches, and which interaction fits.',
        '',
        'standardCode is a real Common Core or NGSS code — "RI.8.8", "3.NF.A.1", "RH.6-8.1",',
        '"MS-PS1-1". Guess freely: it is verified against an authoritative standards graph and',
        'you will get an error naming the problem if it does not exist.',
        '',
        'kind is one of:',
        '  draft-meter        short written argument, live-scored as the student types',
        '  defend-claim       pick a side on a contested historical claim and defend it',
        '  find-the-flaw      spot the one deliberate mistake in a worked example',
        '  draw-the-curve     predict a shape by dragging points, then see the real curve',
        '  crossword          vocabulary puzzle from the standard\'s own terms',
        '  drag-sort          order items along one dimension',
        '  drag-categorize    sort items into 2-4 named buckets',
        '  swiper-flashcard   binary sort of statements, true/false style',
        '  flashcard          two-sided recall cards',
        '  timeline-builder   place events on a timeline',
        '  step-reveal        a worked process unfolded one step at a time',
        '  narrated-card      a short explainer',
        '  markdown-card      static text',
        '  fraction-area-model  partition a whole to build a fraction (fractions only)',
        '',
        'Some widgets only fit some standards — a fraction model is meaningless for a reading',
        'standard. If the pairing does not fit, a different widget is returned with a note saying so.',
      ].join('\n'),
      inputSchema: {
        standardCode: z.string().describe('Common Core or NGSS code, e.g. "RI.8.8" or "MS-PS1-1".'),
        kind: z.string().describe('Which interaction to build. See the list in the description.'),
      },
      _meta: UI_META,
    },
    async ({ standardCode, kind }) => {
      // The widget is built by the app itself, not here: this server stays a
      // thin adapter, so a widget added to the app appears in chat with no
      // change on this side.
      const response = await fetch(`${API_ORIGIN}/api/widget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standardCode, kind }),
      });

      const data = await response.json();

      if (!response.ok || !data.widget) {
        return {
          content: [{ type: 'text', text: data.error ?? 'Could not build that widget.' }],
          isError: true,
        };
      }

      const summary = [
        `${data.widget.kind} for ${data.standard.code} — ${data.standard.description}`,
        data.note ? `Note: ${data.note}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { spec: data.widget },
        _meta: UI_META,
      };
    },
  );

  return server;
}
