/**
 * Bundle the widget shell into a single self-contained HTML file.
 *
 * That file is what an MCP host renders: a sandboxed iframe has no access to
 * our stylesheet or our JS chunks, so everything has to be inlined.
 *
 * The CSS is compiled standalone from `mcp/shell.css`, which imports the
 * app's own globals.css — one theme source, no dependency on a finished
 * `next build`, and no @font-face to strip because next/font never runs
 * here. That independence is what lets this run as a `prebuild` step: the
 * shell is a build product now, not a committed artifact anyone can forget
 * to regenerate.
 *
 *   node mcp/build.mjs   (runs automatically before `pnpm dev` / `pnpm build`)
 */
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'mcp', 'dist');
mkdirSync(outDir, { recursive: true });

/**
 * Zod is 320KB of this bundle — 37% — and the shell never needs it.
 *
 * Specs reach the iframe from our own MCP server, so re-validating them in the
 * browser re-checks work already done server-side, where the model output
 * actually crosses a trust boundary. It cannot simply be dropped, though: the
 * widget definition modules import `pathway/schema.ts` for their spec types,
 * and those schemas are built at module scope.
 *
 * So it is replaced with a proxy that absorbs the whole chainable API and
 * returns itself. `z.object({...}).describe('x').nullable()` becomes a no-op.
 * Nothing in the shell calls `.parse()`; if that ever changes, this stub is
 * where the surprise will come from.
 */
const stubZod = {
  name: 'stub-zod',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^zod$/ }, () => ({ path: 'zod', namespace: 'stub-zod' }));
    pluginBuild.onLoad({ filter: /.*/, namespace: 'stub-zod' }, () => ({
      contents: `
        const hit = () => proxy;
        const proxy = new Proxy(hit, {
          get: (_t, prop) => (prop === 'then' ? undefined : proxy),
          apply: () => proxy,
        });
        export const z = proxy;
        export default proxy;
      `,
      loader: 'js',
    }));
  },
};

const result = await build({
  plugins: [stubZod],
  entryPoints: [join(root, 'mcp', 'shell.tsx')],
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  minify: true,
  write: false,
  tsconfig: join(root, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'empty' },
  logLevel: 'error',
});

const js = result.outputFiles[0].text;

// Compile the shell's stylesheet with the Tailwind CLI. Deterministic by
// construction: same sources in, same bytes out, on any machine — and no
// dependency on a finished `next build`.
const cssOut = join(outDir, 'shell.css');
execFileSync('pnpm', ['exec', 'tailwindcss', '-i', join(root, 'mcp', 'shell.css'), '-o', cssOut, '--minify'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
});
const css = readFileSync(cssOut, 'utf8');

/** Renders standalone in a browser; an MCP host will supply the spec instead. */
const DEMO_SPEC = {
  kind: 'draft-meter',
  learningComponentId: null,
  question: 'Does this argument hold up? Say what you think — and point to what in the editorial makes you say so.',
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
    { id: 'source', label: 'evidence from the text', lookFor: 'Points at a specific claim in the editorial.', essential: false },
    { id: 'why', label: 'why it does or does not fit', lookFor: 'Explains whether that evidence is relevant and sufficient.', essential: false },
  ],
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Widget shell</title>
<!-- Fonts, transparency, and every theme token come from mcp/shell.css —
     one stylesheet owns the shell's presentation. -->
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<div id="mcp-app-root" data-props="{}" hidden></div>
<script>
  // A host will replace this. Standalone, it is what makes the file openable.
  window.__WIDGET_SPEC__ = ${JSON.stringify(DEMO_SPEC)};
  window.__API_ORIGIN__ = window.__API_ORIGIN__ || 'http://localhost:3100';
</script>
<script>${js}</script>
</body>
</html>
`;

const out = join(outDir, 'widget-shell.html');
writeFileSync(out, html);

// Also into public/, which is what the deployed MCP route serves as the
// ui:// resource. Committed, because a serverless build has no chance to
// produce it: `next build` copies public/ and this script runs after.
const published = join(root, 'public', 'widget-shell.html');
writeFileSync(published, html);
console.log(`${out}\n${published}  ${(html.length / 1024).toFixed(0)} KB  (js ${(js.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB)`);
