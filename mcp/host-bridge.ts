/**
 * JSON-RPC over postMessage, the way an MCP App talks to its host.
 *
 * There is no official client library for this yet (`@modelcontextprotocol/
 * app-sdk` does not exist), so this is hand-rolled from the wire protocol
 * observed in shipping first-party apps — Slack's message form and Atlassian's
 * Jira widget. The pieces that matter:
 *
 *   ui/initialize                          app announces itself, host replies
 *   ui/notifications/host-context-changed  host pushes its CSS variables
 *   tools/call                             app calls a tool on our server
 *   ui/update-model-context                app tells the conversation something
 *   ui/notifications/size-changed          app reports its height
 */

type Pending = (message: Record<string, unknown>) => void;

export class HostBridge {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private handlers = new Map<string, (params: unknown) => void>();

  constructor() {
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as Record<string, unknown> | null;
      if (!message || typeof message !== 'object') return;

      const id = message.id as number | undefined;
      if (id !== undefined && this.pending.has(id)) {
        this.pending.get(id)?.(message);
        this.pending.delete(id);
        return;
      }

      const method = message.method as string | undefined;
      if (method) this.handlers.get(method)?.(message.params);
    });
  }

  on(method: string, handler: (params: unknown) => void) {
    this.handlers.set(method, handler);
  }

  notify(method: string, params: unknown) {
    window.parent?.postMessage({ jsonrpc: '2.0', method, params }, '*');
  }

  /** Resolves with the host's reply, or null if it never answers. */
  request(method: string, params: unknown, timeoutMs = 5000): Promise<Record<string, unknown> | null> {
    const id = this.nextId++;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(null);
      }, timeoutMs);

      this.pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });

      window.parent?.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
    });
  }

  /**
   * The host hands us its own theme as CSS custom properties. Applying them is
   * what makes a widget look like it belongs in the conversation rather than
   * like an embedded website — and it is why the first-party apps sit so
   * naturally in dark mode.
   */
  applyHostStyles(variables: Record<string, string>) {
    const style = document.getElementById('mcp-host-variables') ?? document.createElement('style');
    style.id = 'mcp-host-variables';
    style.textContent = `:root {\n${Object.entries(variables)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n')}\n}`;
    document.head.appendChild(style);
  }

  /** Report our height so the host can size the iframe to the content. */
  reportSizeOnResize() {
    const observer = new ResizeObserver(() => {
      const rect = document.body.getBoundingClientRect();
      this.notify('ui/notifications/size-changed', {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      });
    });
    observer.observe(document.body);
  }

  callServerTool(name: string, args: unknown) {
    return this.request('tools/call', { name, arguments: args });
  }

  /** Say something back into the conversation the widget is sitting in. */
  updateModelContext(text: string) {
    return this.request('ui/update-model-context', { content: [{ type: 'text', text }] });
  }
}
