/**
 * dsh-file-transfer host entry.
 *
 * The download half is entirely client-side and rides DSH's authenticated
 * `workspaceFiles` Remote. Uploading needs a write, and the harness filesystem
 * service exposes no binary write, so this entry registers the streaming HTTP
 * route that performs them (`lib/upload-route.js`).
 *
 *   POST /dsh-file-transfer/upload?sessionId=<id>&directory=<path>&name=<file>
 *
 * The route trusts nothing from the browser: it resolves the destination
 * through the Session's filesystem provider, refuses anything outside that
 * Session's workspace, stages the bytes in a temp file and publishes them with
 * an atomic no-overwrite link.
 */
import { uploadRoute } from './upload-route.js';

export const name = 'dsh-file-transfer';

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - the plugin context.
 */
export function apply(ctx) {
  ctx.inject(['webServer', 'fs', 'sessions', 'sandboxPolicy'], (host) => {
    host.effect(
      () => host.webServer.register(uploadRoute(host)),
      'dsh-file-transfer: workspace upload route',
    );
  });
}
