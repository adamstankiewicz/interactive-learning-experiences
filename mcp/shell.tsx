/**
 * The widget shell — one bundle that renders any widget spec.
 *
 * This is the whole trick of the MCP integration. Widgets are already
 * `spec -> registry -> component`, so a single HTML file containing the
 * registry can render every widget we have and every one we add. One
 * `ui://` resource, not one per widget.
 *
 * The spec arrives one of two ways:
 *   - `window.__WIDGET_SPEC__`, set by the page. Used for local testing.
 *   - an MCP host handing us tool results over postMessage. Wired in step 2.
 */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { WidgetTelemetryProvider } from '@/components/widgets/telemetry-context';

import { HostBridge } from './host-bridge';
import { reportCompletionToHost } from './report-to-host';

// Rendered straight off the catalog rather than through `WidgetRenderer`,
// which safeParses the spec. That validation belongs where a model's output
// enters the system, not here — the spec reached this iframe from our own
// server, and skipping it keeps zod out of the bundle entirely.
import '@/lib/widgets/builtins';
import { getWidgetCatalogEntry } from '@/lib/widgets/types';

declare global {
  interface Window {
    __WIDGET_SPEC__?: unknown;
    __API_ORIGIN__?: string;
  }
}

/**
 * Scoring, routed through the host.
 *
 * Widgets call `/api/score` relatively, which is correct inside the app and
 * meaningless in a sandboxed iframe with an opaque origin. The obvious repair
 * is to rewrite it to an absolute URL — and that works right up until the
 * host's CSP has an opinion about which domains a view may reach, which is
 * invisible from in here and produced a widget that rendered perfectly and
 * then said "couldn't check".
 *
 * So when there is a host, the call goes over the protocol instead: the view
 * asks the host to run `score_draft`, and the host talks to our server. No
 * origin involved, nothing to allow-list, nothing that can silently fail.
 * Falls back to a plain fetch when running standalone, which is how the
 * harness and the built file on disk still work.
 */
const bridge = new HostBridge();
const telemetry = reportCompletionToHost(bridge);
let hostReady = false;

function installApiShim(origin: string) {
  const real = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const path = typeof input === 'string' ? input : null;
    if (!path?.startsWith('/api/')) return real(input, init);

    if (hostReady && path.startsWith('/api/score')) {
      const reply = await bridge.callServerTool('score_draft', JSON.parse(String(init?.body ?? '{}')));
      const result = (reply as { result?: { structuredContent?: unknown; isError?: boolean } })?.result;

      if (!result || result.isError || !result.structuredContent) {
        throw new Error('Scoring failed.');
      }

      return new Response(JSON.stringify(result.structuredContent), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return real(origin + path, init);
  };
}

installApiShim(window.__API_ORIGIN__ ?? 'http://localhost:3000');

/**
 * Find a widget spec anywhere in a message from the host.
 *
 * A spec is anything carrying a `kind` the registry knows. The exact envelope
 * a host wraps a tool result in is not something to guess at, so the payload
 * is walked instead.
 */
function findSpec(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== 'object' || depth > 6) return null;

  const node = value as Record<string, unknown>;
  // Ask the registry rather than sniffing for fields. An earlier version
  // matched on question/prompt/cards — the fields the three widgets that
  // existed at the time happened to have — so every widget added since was
  // silently ignored and the view kept rendering its fallback.
  if (typeof node.kind === 'string' && getWidgetCatalogEntry(node.kind)) {
    return node;
  }

  for (const child of Object.values(node)) {
    const found = findSpec(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function Shell() {
  // Slack's app reads its props off the mount node; ours accepts the same.
  // Read during render rather than in the effect below: it is already in the
  // DOM before this mounts, so setting it from an effect only cost a second
  // render pass.
  const [hostSpec, setHostSpec] = useState<unknown>(() => {
    if (typeof document === 'undefined') return null;
    const props = document.getElementById('mcp-app-root')?.dataset.props;
    if (!props) return null;
    try {
      return findSpec(JSON.parse(props)) ?? null;
    } catch {
      // A malformed data-props is not worth failing the render over.
      return null;
    }
  });

  useEffect(() => {
    // Still forgiving about where the spec turns up: the handshake is known,
    // but which notification carries a tool result is not, so anything the
    // host sends gets searched.
    window.addEventListener('message', (event: MessageEvent) => {
      const found = findSpec(event.data);
      if (found) setHostSpec(found);
    });

    bridge.on('ui/notifications/host-context-changed', (params) => {
      const styles = (params as { styles?: { variables?: Record<string, string> } })?.styles;
      if (styles?.variables) bridge.applyHostStyles(styles.variables);
      bridge.syncColorScheme(styles?.variables);
    });

    // Don't wait for the host to tell us: a widget that flashes white in a
    // dark conversation and then corrects itself looks broken either way.
    bridge.syncColorScheme();

    // The spec arrives here. Method names taken from Slack's shipping bundle,
    // not guessed: the host pushes the tool's input and result to the view as
    // notifications once the view has declared itself initialized.
    for (const method of ['ui/notifications/tool-result', 'ui/notifications/tool-input']) {
      bridge.on(method, (params) => {
        const found = findSpec(params);
        if (found) setHostSpec(found);
      });
    }

    void bridge
      .request('ui/initialize', {
        protocolVersion: '2025-11-21',
        appInfo: { name: 'Interactive Learning Widgets', version: '0.1.0' },
        appCapabilities: {},
      })
      .then((reply) => {
        const found = reply && findSpec(reply);
        if (found) setHostSpec(found);

        // Without this the host has no reason to believe the view is ready,
        // and never sends the tool result — so the widget sits empty. It is
        // the mirror of MCP's own `notifications/initialized`.
        // Only now can tool calls be routed through the host; before the
        // handshake completes there is nobody listening.
        if (reply) hostReady = true;
        bridge.notify('ui/notifications/initialized', {});
        bridge.reportSizeOnResize();
      });
  }, []);

  const spec = hostSpec ?? window.__WIDGET_SPEC__;

  if (!spec) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No widget spec. Set <code>window.__WIDGET_SPEC__</code> before this script runs.
      </p>
    );
  }

  const kind = (spec as { kind?: string }).kind ?? '';
  const entry = getWidgetCatalogEntry(kind);

  if (!entry) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No renderer registered for widget kind “{kind}”.
      </p>
    );
  }

  const Component = entry.component;
  const standardCode = (spec as { standardCode?: string }).standardCode ?? null;

  return (
    <div className="p-4 font-sans">
      {/* Widgets report through telemetry, which had no sink in here. Giving it
          one is what lets a finished activity reach the conversation. */}
      <WidgetTelemetryProvider telemetry={telemetry} standardCode={standardCode}>
        <Component spec={spec} />
      </WidgetTelemetryProvider>
    </div>
  );
}

const mount = document.getElementById('root');
if (mount) createRoot(mount).render(<Shell />);
