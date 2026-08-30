/**
 * What the widget says back into the conversation it is sitting in.
 *
 * When a widget renders inside a chat host as an MCP App (SEP-1865), the host
 * has no idea what happened inside the iframe — it handed over a spec and got
 * a picture back. `ui/update-model-context` is the channel for the widget to
 * report, in plain language, what the student actually did, so the assistant
 * can respond to it: notice the misconception, choose what comes next, or just
 * acknowledge the work.
 *
 * That is the feedback edge the architecture was drawn around. Without it the
 * widget is a dead end in the transcript; with it, progress lives in the
 * conversation rather than in a bespoke progress bar bolted inside the frame.
 *
 * Three deliberate properties:
 *
 * - **A no-op everywhere else.** On the web app, on the demo pages, and in
 *   tests there is no host listening, so this posts nothing and costs nothing.
 *   Widgets can call it unconditionally.
 * - **No dependency on the MCP shell.** It writes the same JSON-RPC envelope
 *   the shell's HostBridge writes, rather than importing it — the shell lives
 *   on its own branch, and coupling the widgets to it would mean neither could
 *   move without the other. The host is the thing that listens; both sides
 *   speaking the same wire format is all the coordination needed.
 * - **Written for a reader, not a log.** The host feeds this to a language
 *   model, so it is a sentence about a student, not a JSON blob. "Located the
 *   flawed step on the second try, then misdiagnosed it as a sample-size
 *   problem" is something an assistant can act on; `{attempts: 2}` is not.
 */

let lastSent: string | null = null;
let nextId = 1;

/** True only inside a frame — i.e. plausibly hosted by a chat client. */
function isEmbedded(): boolean {
  try {
    return typeof window !== 'undefined' && window.parent !== window;
  } catch {
    // A cross-origin parent can throw on access; that also means embedded.
    return true;
  }
}

/**
 * Tell the conversation what just happened.
 *
 * Repeats are dropped: a widget that re-renders, or a student who checks the
 * same answer twice, should not narrate itself twice into the transcript.
 */
export function reportToConversation(text: string, detail?: Record<string, unknown>): void {
  const message = text.trim();
  if (!message || !isEmbedded()) return;

  // Prose leads — it is what the model responds to. The optional structured
  // block rides along for exact fields (the same convention the shell's
  // completion reporter uses; the cap and over-long fence are mirrored there
  // too, since the two files deliberately share a wire format, not code).
  const content: { type: 'text'; text: string }[] = [{ type: 'text', text: message }];
  let detailBlock: string | null = null;
  if (detail) {
    let json = JSON.stringify(detail);
    if (json.length > 4000) json = `${json.slice(0, 4000)}… (truncated)`;
    const longestRun = json.match(/`+/g)?.reduce((max, run) => Math.max(max, run.length), 0) ?? 0;
    const fence = '`'.repeat(Math.max(3, longestRun + 1));
    detailBlock = `${fence}json\n${json}\n${fence}`;
    content.push({ type: 'text', text: detailBlock });
  }

  // Dedupe on everything sent, not just the prose — identical sentences with
  // different structured detail are different reports.
  const dedupeKey = detailBlock ? `${message}\n${detailBlock}` : message;
  if (dedupeKey === lastSent) return;
  lastSent = dedupeKey;

  window.parent?.postMessage(
    {
      jsonrpc: '2.0',
      id: nextId++,
      method: 'ui/update-model-context',
      params: { content },
    },
    '*',
  );
}

/** Test seam: forget what was last said, so a fresh attempt reports again. */
export function resetConversationReports(): void {
  lastSent = null;
}
