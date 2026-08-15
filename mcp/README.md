# Widgets inside a chat

Renders our learning widgets inside Claude, via
[MCP Apps (SEP-1865)](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp).

## Install

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`
(`%APPDATA%\\Claude\\` on Windows), then restart Claude:

```json
{
  "mcpServers": {
    "learning-widgets": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://interactive-learning-experiences.vercel.app/api/mcp"]
    }
  }
}
```

Then ask for an activity — *"show me a find-the-flaw for MS-PS1-1"*, *"a crossword for
RI.8.8"*, *"a draft meter for RH.6-8.1"*. The widget appears inline and is live: the
draft meter really scores what you type, against the real standard.

Nothing to clone and nothing to run locally — `mcp-remote` just forwards to the
deployment. Open the URL in a browser to check it is up; it answers with the widget
kinds it knows.

Claude Desktop has no "add custom connector" button in this build, which is why this
goes through the config file rather than the UI.

## The idea

**One resource, not one per widget.** Widgets are already `spec -> registry ->
component`, so a single HTML bundle carrying the registry renders every widget we
have and every one we add. The tool only produces a spec and points at that shell.

```
src/app/api/mcp/route.ts    the MCP server, deployed with the app
src/lib/widgets/build.ts    one widget from a standard code + a kind
mcp/shell.tsx               mounts the widget; talks to the host
mcp/host-bridge.ts          JSON-RPC over postMessage
mcp/build.mjs               bundles to one self-contained HTML file
public/widget-shell.html    the built bundle (committed — see below)
```

`show_widget(standardCode, kind)` is the only tool. **A widget added to the app
needs no change here** — but the bundle does have to be rebuilt:

```bash
pnpm mcp:build      # next build && node mcp/build.mjs
```

That writes `public/widget-shell.html`, which is committed on purpose: `next build`
copies `public/` before this script could run, so a serverless build has no chance
to produce it. Forget this step and new widgets render as *"No renderer registered"*.

## Working on it locally

```bash
pnpm mcp:build
PORT=3100 pnpm dev
```

Point a connector at `http://localhost:3100/api/mcp`.

Faster than asking Claude, for checking a widget renders at all:

```bash
python3 -m http.server 3200 --directory mcp
open 'http://localhost:3200/harness.html?kind=draw-the-curve&code=RH.6-8.7'
```

`harness.html` simulates a host — same iframe sandbox, same message sequence — and
builds a real spec through `/api/widget`. A failure there is ours; a failure only in
Claude is the host's.

## Things that cost hours, written down

**A stdio server renders UI fine** — an earlier version of this file claimed
otherwise. When the widget was not rendering, the cause was the declaration below,
not the transport; both were changed at once and the transport got the credit.
`resources/read` in `~/Library/Logs/Claude/mcp-server-<name>.log` is the fact that
settles it: if the host never read the resource, the declaration is wrong.

**`_meta.ui` goes on the resource, not only the tool**, and the CSP keys are
`connectDomains` / `resourceDomains`. Both were found by listing what the shipping
first-party connectors declare, not from documentation.

**The view must send `ui/notifications/initialized`** or the host never sends it the
tool result, and the widget sits empty. The spec arrives via
`ui/notifications/tool-result`.

**CORS is mandatory.** A sandboxed iframe has an opaque origin, so every call the
widget makes to `/api/score` is cross-origin.

**The host hands the app its own CSS variables** through
`ui/notifications/host-context-changed`. Adopting them is most of why a widget looks
native rather than embedded — though our design system switches on a `.dark` class,
so the shell reads the host's background colour and decides for itself.

There is no client library for any of this: `@modelcontextprotocol/app-sdk` does not
exist, and the TS SDK knows nothing about `ui://`. `mcp/host-bridge.ts` is
hand-rolled from the wire format.

## Not done yet

- Widgets emit telemetry into a context with no provider, so nothing a student does
  in chat reaches the database. No session, no mastery.
- `ui/update-model-context` — the widget telling the conversation what the student
  did — is supported by the bridge and called by nothing. That is the feedback loop.
- The tool builds one widget. A `build_lesson` returning a whole pathway would be
  the obvious next tool.
