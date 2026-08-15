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

import { HostBridge } from './host-bridge';

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
 * Widgets call `/api/score` relatively, which is correct inside the app and
 * meaningless in a sandboxed iframe with an opaque origin. Rewriting it here
 * keeps the widget components untouched — worth it while five people are
 * editing them. If this graduates past a spike, the widgets should take an
 * API base instead of being intercepted.
 */
function installApiShim(origin: string) {
  const real = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return real(origin + input, init);
    }
    return real(input, init);
  };
}

installApiShim(window.__API_ORIGIN__ ?? 'http://localhost:3000');

/**
 * Find a widget spec anywhere in a message from the host.
 *
 * The MCP Apps lifecycle delivers tool results to the view, but the exact
 * envelope is host-specific and this is the first time we have seen Claude's.
 * So rather than guess at a path, walk the payload for the first object that
 * looks like one of our specs. Deliberately forgiving — the point of the spike
 * is to find out what actually arrives.
 */
function findSpec(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== 'object' || depth > 6) return null;

  const node = value as Record<string, unknown>;
  if (typeof node.kind === 'string' && ('question' in node || 'prompt' in node || 'cards' in node)) {
    return node;
  }

  for (const child of Object.values(node)) {
    const found = findSpec(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function Shell() {
  const [hostSpec, setHostSpec] = useState<unknown>(null);

  useEffect(() => {
    const bridge = new HostBridge();

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
    });

    void bridge
      .request('ui/initialize', {
        protocolVersion: '2025-11-21',
        appInfo: { name: 'Interactive Learning Widgets', version: '0.1.0' },
        appCapabilities: {},
      })
      .then((reply) => {
        const found = reply && findSpec(reply);
        if (found) setHostSpec(found);
        bridge.reportSizeOnResize();
      });

    // Slack's app reads its props off the mount node; ours accepts the same.
    const props = document.getElementById('mcp-app-root')?.dataset.props;
    if (props) {
      try {
        const found = findSpec(JSON.parse(props));
        if (found) setHostSpec(found);
      } catch {
        // A malformed data-props is not worth failing the render over.
      }
    }
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

  return (
    <div className="p-4 font-sans">
      <Component spec={spec} />
    </div>
  );
}

const mount = document.getElementById('root');
if (mount) createRoot(mount).render(<Shell />);
