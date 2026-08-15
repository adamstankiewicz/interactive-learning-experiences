/**
 * stdio transport — for a `claude_desktop_config.json` entry.
 *
 *   node mcp/server.mjs
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './app.mjs';

await createServer().connect(new StdioServerTransport());
