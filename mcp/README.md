# Widgets inside a chat (MCP Apps spike)

Renders our widgets inside Claude, via [MCP Apps (SEP-1865)](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp).

## The idea

**One resource, not one per widget.** Widgets are already `spec -> registry ->
component`, so a single HTML bundle containing the registry renders every widget
we have and every one we add. The tool's job is only to produce a spec and point
at that shell.

```
mcp/shell.tsx     mounts WidgetRenderer; takes a spec from the host or window
mcp/build.mjs     bundles it to one self-contained HTML file
mcp/server.mjs    MCP server: ui:// resource + a tool that returns a spec
```

## Run it

```bash
pnpm build && node mcp/build.mjs   # produce mcp/dist/widget-shell.html
PORT=3100 pnpm dev                 # the scoring API the widget calls
```

Open `mcp/dist/widget-shell.html` in a browser — it works standalone, no MCP
involved. That is the fastest way to iterate on the shell.

### Two ways to connect it

**A — custom connector. This is the one that works.**

The stdio route below registers fine and its tool gets called, but Claude never
reads the `ui://` resource and falls back to rebuilding the widget with its own
`visualize` tool. Every MCP App that *does* render on a desktop install —
Slack, Atlassian, Amplitude, Figma — is a remote connector, and adding ours as
one is what made it render. If your widget is not appearing, this is almost
certainly why.

```bash
node mcp/server-http.mjs     # http://localhost:3300/mcp
```

Then in Claude: **Settings → Connectors → Add custom connector**, URL
`http://localhost:3300/mcp`.

**B — local stdio.** Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "learning-widgets": {
      "command": "node",
      "args": ["<abs path>/mcp/server.mjs"],
      "env": { "WIDGET_API_ORIGIN": "http://localhost:3100" }
    }
  }
}
```

Restart Claude, then ask it to show a Draft Meter.

## Two things that were not obvious

**CORS is mandatory.** A sandboxed iframe has an opaque origin, so every call to
`/api/score` is cross-origin. `src/app/api/score/route.ts` now sends open CORS
headers — fine for a hackathon, wants a scoped token before it goes anywhere real.

**The SDK does not know about MCP Apps.** `registerTool`/`registerResource` have
no notion of `ui://` or `_meta.ui`; both are hand-written in `server.mjs`.

## What is verified, and what is not

`mcp/harness.html` simulates a host: it iframes the shell with the same sandbox
a real host uses and replays the message sequence read off Slack's shipping
bundle. Against it the whole handshake works —

```
← view  ui/initialize
→ host  reply + ui/notifications/host-context-changed
← view  ui/notifications/initialized
→ host  ui/notifications/tool-result        (the spec arrives)
← view  ui/notifications/size-changed
```

— and the widget renders from a spec delivered over the wire. So the view side
is correct. What is unverified is any real host actually reading the resource:
in Claude Desktop, `resources/read` has never once been called.

```bash
python3 -m http.server 3200 --directory mcp   # then open /harness.html
```

## How a widget gets built

The server is a thin adapter. `show_widget` takes a standard code and a widget
kind, posts them to `/api/widget` in the app, and hands back whatever comes out.

That endpoint exists because `/api/pathway` is the wrong shape for a
conversation: five model calls and ~30s to author a whole lesson, when the
caller already knows which standard and which interaction it wants. `/api/widget`
does the one step that is left — configure the widget — in a single call.

The consequence worth knowing: **a widget added to the app shows up in chat with
no change on this side.** There are no per-widget tools and no fixtures here.

## Not done yet
- The shell logs every message the host sends and sniffs a spec out of it,
  because we have not yet seen Claude's actual envelope. That is the point of
  the spike — check the console once it renders.
- `ui/update-model-context` would let a finished widget tell the conversation
  what the student did. That is the feedback loop, and nothing implements it.
