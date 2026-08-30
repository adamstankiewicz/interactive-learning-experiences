/**
 * The one safe way to put a structured detail block into model context.
 *
 * Payloads carry model-generated text of unbounded size that can legitimately
 * contain ``` — a fence the content can close is a fence the content can
 * escape, spilling data into the transcript as prose. So: cap the size, then
 * fence with more backticks than the longest run inside.
 *
 * Shared by the widget-side reporter (src/lib/mcp/report.ts) and the shell's
 * host bridge (mcp/host-bridge.ts) — the two deliberately share this pure
 * helper and nothing else, so neither drags the other's runtime along.
 */
const MAX_DETAIL_CHARS = 4000;

export function fencedDetailBlock(detail: Record<string, unknown>): string {
  let json = JSON.stringify(detail);
  if (json.length > MAX_DETAIL_CHARS) json = `${json.slice(0, MAX_DETAIL_CHARS)}… (truncated)`;
  const longestRun = json.match(/`+/g)?.reduce((max, run) => Math.max(max, run.length), 0) ?? 0;
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}json\n${json}\n${fence}`;
}
