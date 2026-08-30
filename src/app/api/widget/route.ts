import { randomUUID } from 'node:crypto';

import { toA2UISurface, A2UI_SUPPORTED_KINDS } from '@/lib/a2learn/a2ui';
import { buildWidget, WidgetBuildError } from '@/lib/widgets/build';

export const maxDuration = 60;

/**
 * One widget from a standard code and a kind. The work lives in
 * `lib/widgets/build.ts`, shared with the MCP server at `/api/mcp`.
 */

/** CORS is open here for the same reason it is on `/api/score`: see that file. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

export async function POST(request: Request) {
  let body: { standardCode?: unknown; kind?: unknown; jurisdiction?: unknown; format?: unknown };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  // `format: "a2ui"` asks for the built widget's A2UI surface alongside the
  // spec. Refuse an unmappable kind before spending a model call on it.
  const wantsA2UI = body.format === 'a2ui';
  if (wantsA2UI && body.kind && !A2UI_SUPPORTED_KINDS.includes(String(body.kind) as never)) {
    return json(
      {
        error: `Kind "${String(body.kind)}" has no A2UI mapping yet. Mapped kinds: ${A2UI_SUPPORTED_KINDS.join(', ')}.`,
      },
      422,
    );
  }

  try {
    const built = await buildWidget({
      standardCode: String(body.standardCode ?? ''),
      kind: String(body.kind ?? ''),
      jurisdiction: typeof body.jurisdiction === 'string' ? body.jurisdiction : undefined,
    });
    if (wantsA2UI) {
      const surface = toA2UISurface(built.widget, `a2learn-${randomUUID()}`);
      if (!surface) {
        // The build chose an unmapped kind (possible when `kind` was omitted).
        return json(
          {
            ...built,
            a2ui: null,
            a2uiNote: `Kind "${built.widget.kind}" has no A2UI mapping yet. Mapped kinds: ${A2UI_SUPPORTED_KINDS.join(', ')}.`,
          },
        );
      }
      return json({ ...built, a2ui: surface });
    }
    return json(built);
  } catch (error) {
    if (error instanceof WidgetBuildError) return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : 'Could not build that widget.';
    return json({ error: message }, 502);
  }
}
