/**
 * dsh-file-transfer — Host-side streaming upload route.
 *
 *   POST /dsh-file-transfer/upload?sessionId=<id>&directory=<path>&name=<file>
 *
 * The request body is the raw file content (`application/octet-stream`) and is
 * streamed straight to disk; it is never buffered in memory. The browser never
 * supplies a filesystem path the Host trusts: the target directory is resolved
 * through the Session's own filesystem provider and must stay inside that
 * Session's workspace root.
 *
 * Guarantees:
 * - Same-origin only; a cross-site page cannot drive the route.
 * - One file per request, hard-capped at {@link MAX_UPLOAD_BYTES}.
 * - Bytes are staged in a sibling temp file and published with an atomic,
 *   no-overwrite hard link, so a half-written upload is never visible and an
 *   existing file is never truncated.
 * - Name collisions are resolved by adding a `(n)` suffix
 *   (`report.txt` → `report(1).txt`).
 * - Every failure path removes the staged temp file.
 */
import { randomUUID } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { basename, extname, join, sep } from 'node:path';

/** Hard per-file upload cap: 1 GiB. */
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;

/** Longest accepted file name, in UTF-8 bytes (the common filesystem ceiling). */
const MAX_NAME_BYTES = 255;

/** Longest `(n)` suffix search; far beyond any realistic folder. */
const MAX_DUPLICATE_ATTEMPTS = 10000;

/** A request-level failure carrying the HTTP status to answer with. */
class UploadError extends Error {
  /**
   * @param {number} status - HTTP status code to answer with.
   * @param {string} code - stable machine-readable error code.
   * @param {string} message - operator-facing explanation.
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
    this.code = code;
  }
}

/** True when the request proves it came from this very origin. */
function sameOrigin(request) {
  const host = request.headers.host;
  if (host === undefined) return false;
  const origin = request.headers.origin;
  // An absent or empty Origin cannot vouch for the caller; fall back to the
  // browser's own same-origin attestation.
  if (origin === undefined || origin === '') return request.headers['sec-fetch-site'] === 'same-origin';
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Write one JSON response body.
 * @param {import('node:http').ServerResponse} response - the response to own.
 * @param {number} status - HTTP status code.
 * @param {unknown} payload - JSON-serializable body.
 * @param {boolean} [close] - end the connection after the response.
 */
function sendJson(response, status, payload, close = false) {
  const body = JSON.stringify(payload);
  /** @type {Record<string, string|number>} */
  const headers = {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  };
  if (close) headers.connection = 'close';
  response.writeHead(status, headers);
  response.end(body);
}

/**
 * Answer one pre-body rejection. The request is never consumed, so the
 * connection is closed after the response: handing back a reusable socket that
 * still holds an unread body would break the caller's next request.
 *
 * @param {import('node:http').ServerResponse} response - the response to own.
 * @param {import('node:http').IncomingMessage} request - the request to drain.
 * @param {number} status - HTTP status code.
 * @param {string} code - stable machine-readable error code.
 * @param {string} message - operator-facing explanation.
 */
function reject(response, request, status, code, message) {
  // Drain whatever body is already buffered so the peer can read our answer.
  if (!request.readableEnded) request.resume();
  sendJson(response, status, { ok: false, error: { code, message } }, true);
}

/**
 * Validate the browser-supplied file name.
 * @param {unknown} raw - the `name` query parameter.
 * @returns {string} the accepted name.
 * @throws {UploadError} when the name is absent, a path, or otherwise unsafe.
 */
function safeFileName(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new UploadError(400, 'name-required', 'a file name is required');
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_NAME_BYTES) {
    throw new UploadError(400, 'name-too-long', 'the file name is too long');
  }
  // Reject path separators and control characters outright, so the name can
  // never address anything but one directory entry.
  if (raw.includes('/') || raw.includes('\\') || raw.includes('\0') || raw.includes(sep)) {
    throw new UploadError(400, 'name-not-a-basename', 'the file name must not contain path separators');
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    throw new UploadError(400, 'name-invalid', 'the file name contains control characters');
  }
  if (raw === '.' || raw === '..' || raw.trim().length === 0) {
    throw new UploadError(400, 'name-invalid', 'the file name is not usable');
  }
  if (basename(raw) !== raw) {
    throw new UploadError(400, 'name-not-a-basename', 'the file name must not contain path separators');
  }
  return raw;
}

/**
 * Build the `n`-th duplicate candidate for a taken name:
 * `report.txt` → `report(1).txt`, `archive` → `archive(1)`.
 *
 * @param {string} name - the originally requested name.
 * @param {number} index - 1-based duplicate counter.
 * @returns {string} the candidate name.
 */
function duplicateName(name, index) {
  const extension = extname(name);
  if (extension.length === 0 || extension === name) return `${name}(${index})`;
  return `${name.slice(0, name.length - extension.length)}(${index})${extension}`;
}

/**
 * Publish the staged temp file under a free name in the target directory.
 *
 * `fs.link` is the publication primitive: it fails with `EEXIST` when the name
 * is taken, so the check-and-claim is atomic and an existing file is never
 * replaced. The unique temp name makes a lost race harmless.
 *
 * @param {string} tempPath - absolute path of the fully written temp file.
 * @param {string} directoryPath - absolute path of the verified target directory.
 * @param {string} requestedName - the browser-requested name.
 * @returns {Promise<string>} the name actually published.
 * @throws {UploadError} when every candidate name is taken.
 */
async function publish(tempPath, directoryPath, requestedName) {
  for (let index = 0; index <= MAX_DUPLICATE_ATTEMPTS; index += 1) {
    const candidate = index === 0 ? requestedName : duplicateName(requestedName, index);
    try {
      await fs.link(tempPath, join(directoryPath, candidate));
      return candidate;
    } catch (error) {
      if (error?.code === 'EEXIST') continue;
      throw error;
    }
  }
  throw new UploadError(409, 'name-unavailable', 'no free file name could be found in the target folder');
}

/**
 * Stream the request body into `sink`, enforcing the size cap as bytes arrive.
 * Nothing is buffered beyond the current chunk.
 *
 * @param {import('node:http').IncomingMessage} request - the upload body.
 * @param {import('node:fs').WriteStream} sink - the staged temp file stream.
 * @returns {Promise<number>} the number of bytes written.
 * @throws {UploadError} when the body exceeds {@link MAX_UPLOAD_BYTES}.
 */
function streamBody(request, sink) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      sink.destroy();
      reject(error);
    };
    request.on('data', (chunk) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_UPLOAD_BYTES) {
        fail(new UploadError(413, 'file-too-large', 'the upload exceeds the 1 GiB per-file limit'));
        return;
      }
      if (!sink.write(chunk)) request.pause();
    });
    sink.on('drain', () => {
      if (!settled) request.resume();
    });
    sink.on('error', fail);
    request.on('error', fail);
    request.on('aborted', () => fail(new UploadError(499, 'upload-aborted', 'the client aborted the upload')));
    request.on('end', () => {
      if (settled) return;
      settled = true;
      sink.end(() => resolve(bytes));
    });
  });
}

/**
 * Resolve the workspace root a session's relative paths are interpreted against.
 *
 * Mirrors the `workspaceFileScope` lookup the read path uses: a live session's
 * immutable `cwd` first, then the stored header for a session this process has
 * not entered, and finally the deployment's fallback root.
 *
 * @param {import('@deepseek-ai/cordis').Context} host - the injected host context.
 * @param {string} sessionId - the session named on the wire.
 * @returns {Promise<string|undefined>} the workspace root, or undefined when the
 *   session does not exist.
 */
async function resolveWorkspaceRoot(host, sessionId) {
  const live = host.sessions.get(sessionId)?.header;
  const stored = live === undefined ? await host.get('sessionPersistence')?.stat(sessionId) : undefined;
  const header = live ?? stored?.header;
  if (header === undefined) return undefined;
  return header.cwd ?? host.sandboxPolicy.workspaceRoot;
}

/**
 * Build the route registration for the upload endpoint.
 *
 * @param {import('@deepseek-ai/cordis').Context} host - a context carrying
 *   `webServer`, `fs`, `sessions` and `sandboxPolicy`.
 * @returns {{ kind: 'exact', path: string, handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void> }} the route registration.
 */
export function uploadRoute(host) {
  const handler = async (request, response) => {
    if (request.method !== 'POST') {
      response.writeHead(405, { allow: 'POST' });
      response.end();
      return;
    }
    if (!sameOrigin(request)) {
      reject(response, request, 403, 'untrusted-origin', 'the request did not originate from this application');
      return;
    }
    const contentType = request.headers['content-type'] ?? '';
    if (contentType !== '' && !contentType.toLowerCase().startsWith('application/octet-stream')) {
      reject(response, request, 415, 'unsupported-media-type', 'the upload body must be application/octet-stream');
      return;
    }

    let tempPath;
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const sessionId = url.searchParams.get('sessionId') ?? '';
      const directory = url.searchParams.get('directory') ?? '';
      const name = safeFileName(url.searchParams.get('name'));

      const declared = Number(request.headers['content-length']);
      if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
        reject(response, request, 413, 'file-too-large', 'the upload exceeds the 1 GiB per-file limit');
        return;
      }

      // Resolve the destination exactly as the workspace-files Remote does: the
      // Session's cwd is the boundary, and the browser's path is only ever
      // interpreted relative to it.
      const workspaceRoot = await resolveWorkspaceRoot(host, sessionId);
      if (workspaceRoot === undefined) {
        reject(response, request, 404, 'session-not-found', 'the session does not exist');
        return;
      }
      const rootTarget = await host.fs.resolve(workspaceRoot);
      const dirTarget = await host.fs.resolve(directory.length > 0 ? directory : '.', { cwd: workspaceRoot });
      if (!host.fs.contains(rootTarget, dirTarget)) {
        reject(response, request, 403, 'outside-workspace', 'the destination folder is outside the session workspace');
        return;
      }
      const info = await host.fs.stat(dirTarget);
      if (info === undefined) {
        reject(response, request, 404, 'destination-not-found', 'the destination folder does not exist');
        return;
      }
      if (info.type !== 'directory') {
        reject(response, request, 400, 'destination-not-directory', 'the destination is not a folder');
        return;
      }
      const directoryPath = host.fs.processPath(dirTarget);

      // Stage beside the destination so the publishing link stays on one
      // filesystem. The staging file is private (0600) while it holds a
      // half-written upload, then takes the process's natural creation mode
      // before it becomes visible under its final name.
      tempPath = join(directoryPath, `.dsh-file-transfer-${randomUUID()}.part`);
      const sink = createWriteStream(tempPath, { flags: 'wx', mode: 0o600 });
      const bytes = await streamBody(request, sink);
      await fs.chmod(tempPath, 0o666 & ~process.umask());

      const published = await publish(tempPath, directoryPath, name);
      await fs.unlink(tempPath).catch(() => {});
      tempPath = undefined;
      sendJson(response, 201, { ok: true, name: published, directory, bytes });
    } catch (error) {
      const staged = tempPath;
      tempPath = undefined;
      if (staged !== undefined) await fs.unlink(staged).catch(() => {});
      if (response.headersSent || response.writableEnded) {
        if (!request.readableEnded) request.destroy();
        return;
      }
      if (error instanceof UploadError) {
        // 499 means the client vanished; there is nobody left to answer.
        if (error.status === 499) request.destroy();
        else reject(response, request, error.status, error.code, error.message);
        return;
      }
      const code = error?.code;
      if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
        reject(response, request, 403, 'destination-not-writable', 'the destination folder is not writable');
      } else if (code === 'ENOENT') {
        reject(response, request, 404, 'destination-not-found', 'the destination folder does not exist');
      } else if (code === 'ENOSPC') {
        reject(response, request, 507, 'no-space', 'the destination filesystem is full');
      } else if (code === 'EEXIST') {
        reject(response, request, 409, 'staging-conflict', 'the upload could not be staged, please retry');
      } else {
        reject(response, request, 500, 'upload-failed', error instanceof Error ? error.message : String(error));
      }
    }
  };

  return { kind: 'exact', path: '/dsh-file-transfer/upload', handler };
}
