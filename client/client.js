/* dsh-file-download browser half.
 * Adds a download control alongside the document preview's reload button.
 */
window.__ModuleLoader__.load({
  id: 'dsh-file-download',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require('react');
    var primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    var Tooltip = primitives.Tooltip;
    var IconDownloadOutlineRegular = primitives.IconDownloadOutlineRegular;
    var useState = React.useState;
    var useRef = React.useRef;
    var useEffect = React.useEffect;
    var MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024;
    var RANGE_BYTES = 2 * 1024 * 1024;

    var NS = 'dsh-file-download';
    var zh = {
      download: '下载文件',
      downloading: '正在下载…',
      downloaded: '下载已开始',
      failed: '下载失败',
    };
    var en = {
      download: 'Download file',
      downloading: 'Downloading…',
      downloaded: 'Download started',
      failed: 'Download failed',
    };

    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-file-download"]')) {
      var style = document.createElement('style');
      style.setAttribute('data-plugin', 'dsh-file-download');
      style.setAttribute('data-plugin-css', 'dsh-file-download');
      style.textContent = '.dsh-file-download-tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:transparent;border:0;flex:none;display:inline-flex;justify-content:center;align-items:center;padding:6px;line-height:1}.dsh-file-download-tool svg{width:15px;height:15px}.dsh-file-download-tool:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.dsh-file-download-tool:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}';
      document.head.appendChild(style);
    }

    function filenameFromPath(path) {
      var normalized = String(path || '').replace(/\\/g, '/');
      var name = normalized.slice(normalized.lastIndexOf('/') + 1);
      try { return decodeURIComponent(name) || 'download'; }
      catch (_) { return name || 'download'; }
    }

    function triggerDownload(blob, filename) {
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    }

    function DownloadAction(props) {
      var controllerRef = useRef(null);
      useEffect(function () {
        return function () {
          if (controllerRef.current) controllerRef.current.abort();
        };
      }, []);
      var _a = useState(false);
      var busy = _a[0];
      var setBusy = _a[1];
      var _b = useState('');
      var status = _b[0];
      var setStatus = _b[1];
      var _c = useState('');
      var errorText = _c[0];
      var setErrorText = _c[1];
      var t = props.t;

      async function download() {
        if (busy) return;
        setBusy(true);
        setStatus('');
        setErrorText('');
        try {
          var controller = new AbortController();
          controllerRef.current = controller;
          var blob = await props.readFile(props.sessionId, props.absolutePath, controller.signal);
          if (controller.signal.aborted) return;
          triggerDownload(blob, filenameFromPath(props.absolutePath));
          setStatus('downloaded');
        } catch (error) {
          console.error('[dsh-file-download] download failed:', error);
          setErrorText(error && error.message ? error.message : String(error));
          setStatus('failed');
        } finally {
          setBusy(false);
        }
      }

      var label = status ? t(status) : busy ? t('downloading') : t('download');
      return React.createElement(Tooltip, {
        label: errorText ? label + ': ' + errorText : label,
        side: 'bottom',
        delayMs: 500,
        children: React.createElement('button', {
          type: 'button',
          className: 'dsh-file-download-tool',
          'aria-label': label,
          title: errorText ? label + ': ' + errorText : label,
          'data-textpreview-tool': 'download',
          disabled: busy,
          onClick: function () { void download(); },
          children: React.createElement(IconDownloadOutlineRegular, { size: 16 }),
        }),
      });
    }

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, 'dsh-file-download: dictionaries');

      var t = ctx.locale.bind(NS);
      ctx.slots.inject('sidebar.right.tab.document.actions', function () {
        return ctx.slots.register({
          name: 'sidebar.right.tab.document.actions',
          id: 'dsh-file-download',
          order: 20,
          locale: NS,
          inject: function () {
            return {
              readFile: async function (sessionId, path, signal) {
                if (!sessionId) throw new Error('No active session');
                var metadata = await ctx.remote.workspaceFiles.stat(sessionId, path, signal);
                if (!metadata.ok) {
                  var statError = metadata.error;
                  throw new Error(statError && statError.message ? statError.message : 'Unable to inspect the file');
                }
                var expectedSize = metadata.value.bytes;
                if (typeof expectedSize === 'number' && expectedSize > MAX_DOWNLOAD_BYTES) {
                  throw new Error('File exceeds the download limit of 256 MiB');
                }

                var chunks = [];
                var offset = 0;
                for (;;) {
                  if (signal.aborted) throw new Error('Download cancelled');
                  var result = await ctx.remote.workspaceFiles.readBytes(sessionId, path, { range: { offset: offset, length: RANGE_BYTES } }, signal);
                  if (!result.ok) {
                    var readError = result.error;
                    throw new Error(readError && readError.message ? readError.message : 'File read failed');
                  }
                  var page = result.value;
                  if (page.version !== metadata.value.version || page.absolutePath !== metadata.value.absolutePath) {
                    throw new Error('File changed while it was being downloaded; retry the download');
                  }
                  if (page.data.byteLength === 0 && !page.eof) throw new Error('File read returned no data before reaching EOF');
                  chunks.push(page.data);
                  offset += page.data.byteLength;
                  if (offset > MAX_DOWNLOAD_BYTES) throw new Error('File exceeds the download limit of 256 MiB');
                  if (page.eof) break;
                  if (expectedSize !== void 0 && offset >= expectedSize) throw new Error('File ended unexpectedly; retry the download');
                }
                if (expectedSize !== void 0 && offset !== expectedSize) throw new Error('File size changed while it was being downloaded; retry the download');
                return new Blob(chunks, { type: 'application/octet-stream' });
              },
            };
          },
        }, DownloadAction);
      });
    }

    exports.name = 'dsh-file-download';
    exports.inject = ['slots', 'locale', 'remote', 'remote.workspaceFiles'];
    exports.apply = apply;

    return module.exports;
  },
});
