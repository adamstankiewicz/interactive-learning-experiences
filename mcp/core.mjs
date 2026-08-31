/**
 * Loads the bundled server definition for the CLI transports.
 *
 * `src/lib/mcp/server.ts` is the one source of the tool surface; this file
 * only adapts it to plain-node life: the bundle from `pnpm mcp:build`, the
 * shell read from disk, and the API origin from env.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const API_ORIGIN = process.env.WIDGET_API_ORIGIN ?? 'http://localhost:3100';

const corePath = join(root, 'dist', 'server-core.mjs');
const shellPath = join(root, 'dist', 'widget-shell.html');

for (const [path, what] of [[corePath, 'server bundle'], [shellPath, 'widget shell']]) {
  if (!existsSync(path)) {
    console.error(`[mcp] ${what} missing at ${path} — run: pnpm mcp:build`);
    process.exit(1);
  }
}

const { buildMcpServer } = await import(pathToFileURL(corePath).href);

export function createServer() {
  return buildMcpServer({
    origin: API_ORIGIN,
    loadShell: async () => readFileSync(shellPath, 'utf8'),
  });
}
