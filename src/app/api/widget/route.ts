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
  let body: { standardCode?: unknown; kind?: unknown; jurisdiction?: unknown };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  try {
    const built = await buildWidget({
      standardCode: String(body.standardCode ?? ''),
      kind: String(body.kind ?? ''),
      jurisdiction: typeof body.jurisdiction === 'string' ? body.jurisdiction : undefined,
    });
    return json(built);
  } catch (error) {
    if (error instanceof WidgetBuildError) return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : 'Could not build that widget.';
    return json({ error: message }, 502);
  }
}
