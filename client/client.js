/* dsh-file-transfer browser half.
 * Adds confirmed downloads to the document preview and workspace file tree.
 */
window.__ModuleLoader__.load({
  id: 'dsh-file-transfer',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require('react');
    var primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    var Tooltip = primitives.Tooltip;
    var IconDownloadOutlineRegular = primitives.IconDownloadOutlineRegular;

    var MAX_UNCOMPRESSED = 10 * 1024 * 1024 * 1024;
    var LARGE_FILE_ZIP_THRESHOLD = 1024 * 1024 * 1024;
    var MAX_FALLBACK_BLOB = 256 * 1024 * 1024;
    var RANGE_BYTES = 2 * 1024 * 1024;
    var MAX_TREE_ENTRIES = 100000;
    var TREE_ROW_ACTION = 'dsh-file-transfer-tree-action';
    var STYLE_ID = 'dsh-file-transfer-style';
    var NS = 'dsh-file-transfer';
    var MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
    var UPLOAD_ROUTE = 'dsh-file-transfer/upload';
    var TREE_UPLOAD_ACTION = 'dsh-file-transfer-upload-action';
    var ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 17v3h14v-3"/></svg>';
    var ICON_UPLOAD = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0 5 5m-5-5-5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';

    var zh = {
      download: '下载',
      scanning: '正在扫描文件夹…',
      scanReadOnly: '正在仅读取目录和文件大小，不会读取文件内容或开始压缩。',
      confirmTitle: '确认下载',
      confirmFile: '文件：{name}',
      confirmFolder: '文件夹：{name}',
      confirmUnknownFileSize: '文件大小：未知',
      fileSizeUnknown: '无法读取文件大小，已取消下载。',
      confirmSize: '压缩前大小：{size}',
      confirmSizeLower: '已扫描大小（下限）：{size}',
      confirmCount: '文件数量：{count}',
      confirmTooMany: '已达到目录扫描上限，不能完整统计文件夹。',
      confirmCountLower: '已扫描文件数（下限）：{count}',
      confirmDirect: '将直接下载原文件，不压缩。',
      confirmZipCompressed: '将打包为 ZIP；文本类文件会尝试压缩，若抽样压缩收益低于 5% 则原样存储。',
      confirmZipMixed: '将打包为 ZIP；文本文件抽样收益足够时压缩，二进制、媒体及低收益文件原样存储。',
      confirmZipStore: '将打包为 ZIP，但不会压缩内容（二进制或预计压缩率较低）。',
      confirmEstimate: '压缩率只是估算；ZIP 最终大小可能不同。',
      streamRequired: '超过 256 MiB 时，浏览器需要支持选择保存位置并流式写入。',
      confirm: '确认并下载',
      cancel: '取消',
      cancelDownload: '取消下载',
      confirmTooLarge: '超过 10 GiB 上限，不能下载。为节省扫描时间，显示大小为下限。',
      confirmUnknownSize: '无法完整确定压缩前大小，不能下载。',
      estimateCompressed: '抽样估算压缩后大小：{size}（实际大小可能不同）。',
      estimateAfterStart: '确认后开始读取并抽样压缩，届时会显示压缩大小估算。',
      limitExceeded: '压缩前内容超过 10 GiB，无法下载。',
      unknownSize: '无法准确统计全部文件大小，已取消下载。',
      tooManyEntries: '文件数量超过安全扫描上限，已取消下载。',
      zipUnsupported: '此浏览器不支持流式 ZIP 压缩，无法安全生成该归档。',
      savePickerUnsupported: '此浏览器不支持流式保存位置。超过 256 MiB 的内容不能安全下载。',
      downloaded: '下载已完成',
      failed: '下载失败',
      scanningProgress: '已扫描 {count} 个文件，合计 {size}',
      progress: '已处理 {done} / {total}',
      progressDirect: '已下载 {done} / {total}',
      changed: '文件在下载过程中发生变化，请重试。',
      noSession: '没有可用的当前会话。',
      emptyFolder: '空文件夹',
      upload: '上传',
      uploadTitle: '上传文件',
      uploadTarget: '目标文件夹：{path}',
      uploadCount: '文件数量：{count}',
      uploadTotal: '总大小：{size}',
      uploadMax: '单个文件上限 1 GiB，超出会被拒绝。',
      uploadCollision: '若目标文件夹已存在同名文件，将自动改存为“名称(n)”，不会覆盖原文件。',
      uploadStart: '开始上传',
      uploadCancel: '取消上传',
      uploadProgress: '正在上传 {name}：{done} / {total}',
      uploadDone: '已上传：{names}',
      uploadFailed: '上传失败：{message}',
      uploadCancelled: '上传已取消，未完成的临时文件已清理。',
      uploadSessionChanged: '会话已切换，请重新开始上传。',
      uploadTooLarge: '以下文件超过 1 GiB 上限，未开始上传：{names}',
      close: '关闭',
    };
    var en = {
      download: 'Download',
      scanning: 'Scanning folder…',
      scanReadOnly: 'Reading directory entries and file sizes only. No file contents are read and no compression has started.',
      confirmTitle: 'Confirm download',
      confirmFile: 'File: {name}',
      confirmFolder: 'Folder: {name}',
      confirmUnknownFileSize: 'File size: unknown',
      fileSizeUnknown: 'Could not read the file size. Download was cancelled.',
      confirmSize: 'Uncompressed size: {size}',
      confirmSizeLower: 'Scanned size (lower bound): {size}',
      confirmCount: 'File count: {count}',
      confirmTooMany: 'The folder scan reached its entry limit and could not be completed.',
      confirmCountLower: 'Scanned file count (lower bound): {count}',
      confirmDirect: 'The original file will be downloaded without compression.',
      confirmZipCompressed: 'The file will be packed into ZIP; text-like files are compressed only when the sample saves at least 5%.',
      confirmZipMixed: 'A ZIP archive will be created; text files are compressed only when the sample saves enough, while binary, media and low-yield files are stored as-is.',
      confirmZipStore: 'A ZIP archive will be created without compressing its contents (binary or expected low compression ratio).',
      confirmEstimate: 'Compression is only an estimate; the final ZIP size may differ.',
      streamRequired: 'For files above 256 MiB, the browser must support streaming to a chosen save location.',
      confirm: 'Confirm and download',
      cancel: 'Cancel',
      cancelDownload: 'Cancel download',
      confirmTooLarge: 'Exceeds the 10 GiB limit and cannot be downloaded. To avoid a long scan, the displayed size is a lower bound.',
      confirmUnknownSize: 'The complete uncompressed size could not be determined, so download is not allowed.',
      estimateCompressed: 'Sample-estimated compressed size: {size} (the actual result may differ).',
      estimateAfterStart: 'After confirmation, a sample will be compressed and the estimated ZIP size will appear here.',
      limitExceeded: 'Uncompressed content exceeds 10 GiB. Download is not allowed.',
      unknownSize: 'Could not calculate every file size accurately. Download was cancelled.',
      tooManyEntries: 'The folder exceeds the safe scan entry limit. Download was cancelled.',
      zipUnsupported: 'This browser does not support streaming ZIP compression; the archive cannot be created safely.',
      savePickerUnsupported: 'This browser cannot stream to a save location. Content above 256 MiB cannot be downloaded safely.',
      downloaded: 'Download complete',
      failed: 'Download failed',
      scanningProgress: 'Scanned {count} files, total {size}',
      progress: 'Processed {done} / {total}',
      progressDirect: 'Downloaded {done} / {total}',
      changed: 'A file changed during download. Please retry.',
      noSession: 'There is no active session.',
      emptyFolder: 'Empty folder',
      upload: 'Upload',
      uploadTitle: 'Upload files',
      uploadTarget: 'Destination folder: {path}',
      uploadCount: 'Files selected: {count}',
      uploadTotal: 'Total size: {size}',
      uploadMax: 'Each file is limited to 1 GiB; larger files are rejected.',
      uploadCollision: 'A name already present in the folder is saved as “name(n)” instead. Existing files are never overwritten.',
      uploadStart: 'Start upload',
      uploadCancel: 'Cancel upload',
      uploadProgress: 'Uploading {name}: {done} / {total}',
      uploadDone: 'Uploaded: {names}',
      uploadFailed: 'Upload failed: {message}',
      uploadCancelled: 'Upload cancelled; the incomplete temporary file was removed.',
      uploadSessionChanged: 'The active session changed. Start the upload again.',
      uploadTooLarge: 'These files exceed the 1 GiB limit and were not uploaded: {names}',
      close: 'Close',
    };

    function tr(dict, key, values) {
      var text = dict[key] || en[key] || key;
      if (values) Object.keys(values).forEach(function (name) {
        text = text.replace('{' + name + '}', String(values[name]));
      });
      return text;
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
      if (bytes === 0) return '0 B';
      var units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
      var index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      var value = bytes / Math.pow(1024, index);
      return (index === 0 ? String(bytes) : value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)) + ' ' + units[index];
    }

    function cleanName(path) {
      var parts = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
      var name = parts.length ? parts[parts.length - 1] : 'download';
      try { return decodeURIComponent(name); } catch (_) { return name; }
    }

    function safeRelative(path, name) {
      return String(path).replace(/\\/g, '/').replace(/\/$/, '') + '/' + String(name).replace(/\\/g, '/');
    }

    function compressible(path) {
      return /\.(?:txt|md|mdx|markdown|rst|log|csv|tsv|json|jsonl|ya?ml|toml|ini|cfg|conf|xml|html?|css|scss|less|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|bash|zsh|ps1|sql|graphql|proto|svg|tex|diff|patch)$/i.test(path);
    }

    function installStyle() {
      if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = [
        '.dsh-file-transfer-tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:transparent;border:0;flex:none;display:inline-flex;justify-content:center;align-items:center;padding:6px;line-height:1}',
        '.dsh-file-transfer-tool svg{width:15px;height:15px}',
        '.dsh-file-transfer-tool:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
        '.dsh-file-transfer-tool:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
        'li[data-files-entry="file"],li[data-files-entry="directory"]{display:flex;align-items:center;gap:2px;flex-wrap:wrap}',
        'li[data-files-entry="file"]>.k-1LKG_row,li[data-files-entry="directory"]>.k-1LKG_row{width:auto;flex:1;min-width:0}',
        'li[data-files-entry="directory"]>ul{flex:0 0 100%;width:100%;box-sizing:border-box}',
        '.dsh-file-transfer-tree-action,.dsh-file-transfer-upload-action{opacity:0;transition:opacity .12s ease}',
        'li[data-files-entry="file"]:hover>.dsh-file-transfer-tree-action,li[data-files-entry="file"]:focus-within>.dsh-file-transfer-tree-action,li[data-files-entry="directory"]:hover>.dsh-file-transfer-tree-action,li[data-files-entry="directory"]:focus-within>.dsh-file-transfer-tree-action,li[data-files-entry="directory"]:hover>.dsh-file-transfer-upload-action,li[data-files-entry="directory"]:focus-within>.dsh-file-transfer-upload-action{opacity:1}',
        '@media(hover:none){.dsh-file-transfer-tree-action,.dsh-file-transfer-upload-action{opacity:1}}',
        '.dsh-file-transfer-dialog{width:min(520px,calc(100vw - 32px));max-height:min(80vh,720px);padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 24px 80px #0005}',
        '.dsh-file-transfer-dialog::backdrop{background:#0008}',
        '.dsh-file-transfer-dialog-inner{padding:20px}',
        '.dsh-file-transfer-dialog h2{margin:0 0 14px;font-size:17px}',
        '.dsh-file-transfer-dialog p{margin:8px 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.55;overflow-wrap:anywhere}',
        '.dsh-file-transfer-dialog .dsh-file-transfer-error{color:var(--dsw-alias-label-danger,#d92d20)}',
        '.dsh-file-transfer-dialog .dsh-file-transfer-progress{margin-top:14px}',
        '.dsh-file-transfer-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}',
        '.dsh-file-transfer-actions button{min-height:34px;padding:0 13px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit;cursor:pointer}',
        '.dsh-file-transfer-actions button[data-primary]{color:#fff;background:var(--dsw-alias-brand-primary);border-color:transparent}',
        '.dsh-file-transfer-actions button:disabled{opacity:.55;cursor:default}'
      ].join('');
      document.head.appendChild(style);
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
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }

    function crcTable() {
      var table = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
      return table;
    }
    var CRC_TABLE = crcTable();
    function crcUpdate(crc, bytes) {
      for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
      return crc >>> 0;
    }
    function u16(value) { var b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, value, true); return b; }
    function u32(value) { var b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value >>> 0, true); return b; }
    function u64(value) {
      var b = new Uint8Array(8); var view = new DataView(b.buffer);
      view.setUint32(0, value >>> 0, true); view.setUint32(4, Math.floor(value / 0x100000000) >>> 0, true); return b;
    }
    function joinBytes(parts) {
      var size = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
      var out = new Uint8Array(size); var offset = 0;
      parts.forEach(function (part) { out.set(part, offset); offset += part.length; });
      return out;
    }
    function zipName(path) {
      var safe = String(path).replace(/\\/g, '/').replace(/^\/+/, '').split('/').map(function (part) {
        if (part === '.' || part === '..') return '_' + part;
        return part.replace(/[\u0000-\u001f\u007f]/g, '_');
      }).join('/');
      return new TextEncoder().encode(safe);
    }

    function ZipWriter(write) {
      this.write = write;
      this.offset = 0;
      this.entries = [];
      this.closed = false;
      this.onSampleEstimate = null;
    }
    ZipWriter.prototype.put = async function (bytes) {
      if (bytes.length) await this.write(bytes);
      this.offset += bytes.length;
    };
    ZipWriter.prototype.add = async function (name, source, shouldCompress, signal, progress, expectedBytes) {
      if (this.closed) throw new Error('ZIP writer is closed');
      if (signal.aborted) throw new Error('Download cancelled');
      var nameBytes = zipName(name);
      var isDirectory = nameBytes[nameBytes.length - 1] === 47;
      var compress = shouldCompress && !isDirectory && typeof CompressionStream === 'function';
      var sampleCompressed = 0;
      var sourceIterator = source[Symbol.asyncIterator]();
      var prefix = [];
      var prefixBytes = 0;
      var probeUncompressed = 0;

      // Probe a bounded sample after the user confirms. If it saves less than
      // five percent, the remaining bytes are stored without wasting CPU.
      if (compress) {
        try {
          var probeLimit = 16 * 1024 * 1024;
          while (probeUncompressed < probeLimit) {
            var first = await sourceIterator.next();
            if (first.done) break;
            var firstBytes = first.value instanceof Uint8Array ? first.value : new Uint8Array(first.value);
            prefix.push(firstBytes);
            prefixBytes += firstBytes.length;
            probeUncompressed += firstBytes.length;
          }
          if (prefixBytes > 0) {
            var probeReader = new Blob(prefix).stream().pipeThrough(new CompressionStream('deflate-raw')).getReader();
            for (;;) {
              var probePart = await probeReader.read();
              if (probePart.done) break;
              sampleCompressed += probePart.value.byteLength;
            }
            if (sampleCompressed > prefixBytes * 0.95) compress = false;
          }
        } catch (_) { compress = false; }
      }
      if (signal.aborted) throw new Error('Download cancelled');
      if (this.onSampleEstimate) this.onSampleEstimate({ name: String(name), inputBytes: expectedBytes || prefixBytes, sampleInput: prefixBytes, sampleCompressed: sampleCompressed, compress: compress, sampled: prefixBytes > 0 });

      var method = compress ? 8 : 0;
      var localOffset = this.offset;
      var extraLocal = joinBytes([u16(1), u16(16), u64(0), u64(0)]);
      await this.put(joinBytes([u32(0x04034b50), u16(45), u16(0x0808), u16(method), u16(0), u16(0), u32(0), u32(0xffffffff), u32(0xffffffff), u16(nameBytes.length), u16(extraLocal.length), nameBytes, extraLocal]));

      var crc = 0xffffffff;
      var uncompressed = 0;
      var compressed = 0;
      async function* counted() {
        for (var prefixChunk of prefix) {
          if (signal.aborted) throw new Error('Download cancelled');
          crc = crcUpdate(crc, prefixChunk);
          uncompressed += prefixChunk.length;
          progress(prefixChunk.length);
          yield prefixChunk;
        }
        for (;;) {
          if (signal.aborted) throw new Error('Download cancelled');
          var next = await sourceIterator.next();
          if (next.done) break;
          var chunk = next.value instanceof Uint8Array ? next.value : new Uint8Array(next.value);
          crc = crcUpdate(crc, chunk);
          uncompressed += chunk.length;
          progress(chunk.length);
          yield chunk;
        }
      }
      if (compress) {
        var iterator = counted()[Symbol.asyncIterator]();
        var readable = new ReadableStream({
          async pull(controller) {
            try {
              var next = await iterator.next();
              if (next.done) controller.close(); else controller.enqueue(next.value);
            } catch (error) { controller.error(error); }
          },
          async cancel() { if (iterator.return) await iterator.return(); }
        });
        var compressedStream = readable.pipeThrough(new CompressionStream('deflate-raw'));
        var reader = compressedStream.getReader();
        try {
          for (;;) {
            var nextPart = await reader.read();
            if (nextPart.done) break;
            var bytes = nextPart.value instanceof Uint8Array ? nextPart.value : new Uint8Array(nextPart.value);
            compressed += bytes.length;
            await this.put(bytes);
          }
        } catch (error) {
          try { await reader.cancel(error); } catch (_) {}
          throw error;
        }
      } else {
        for await (var part of counted()) { compressed += part.length; await this.put(part); }
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      await this.put(joinBytes([u32(0x08074b50), u32(crc), u64(compressed), u64(uncompressed)]));
      this.entries.push({ name: nameBytes, crc: crc, compressed: compressed, uncompressed: uncompressed, offset: localOffset, method: method, directory: isDirectory });
    };
    ZipWriter.prototype.finish = async function () {
      var centralOffset = this.offset;
      for (var entry of this.entries) {
        var extra = joinBytes([u16(1), u16(24), u64(entry.uncompressed), u64(entry.compressed), u64(entry.offset)]);
        await this.put(joinBytes([u32(0x02014b50), u16(45), u16(45), u16(0x0808), u16(entry.method), u16(0), u16(0), u32(entry.crc), u32(0xffffffff), u32(0xffffffff), u16(entry.name.length), u16(extra.length), u16(0), u16(0), u16(0), u32(entry.directory ? 0x10 : 0), u32(0xffffffff), entry.name, extra]));
      }
      var centralSize = this.offset - centralOffset;
      var zip64Offset = this.offset;
      await this.put(joinBytes([u32(0x06064b50), u64(44), u16(45), u16(45), u32(0), u32(0), u64(this.entries.length), u64(this.entries.length), u64(centralSize), u64(centralOffset)]));
      await this.put(joinBytes([u32(0x07064b50), u32(0), u64(zip64Offset), u32(1)]));
      await this.put(joinBytes([u32(0x06054b50), u16(0), u16(0), u16(0xffff), u16(0xffff), u32(0xffffffff), u32(0xffffffff), u16(0)]));
      this.closed = true;
    };

    async function* fileChunks(remote, sessionId, path, expected, signal) {
      var offset = 0;
      for (;;) {
        if (signal.aborted) throw new Error('Download cancelled');
        var result = await remote.workspaceFiles.readBytes(sessionId, path, { range: { offset: offset, length: RANGE_BYTES } }, signal);
        if (!result.ok) throw result.error;
        var page = result.value;
        if (page.version !== expected.version || page.absolutePath !== expected.absolutePath) throw new Error('File changed while downloading: ' + path);
        if (page.data.byteLength === 0 && !page.eof) throw new Error('File read returned no data before EOF: ' + path);
        offset += page.data.byteLength;
        if (offset > expected.bytes) throw new Error('File grew during download: ' + path);
        yield page.data;
        if (page.eof) break;
        if (offset >= expected.bytes) throw new Error('File ended unexpectedly: ' + path);
      }
      if (offset !== expected.bytes) throw new Error('File size changed during download: ' + path);
    }

    function makeScanningDialog(dict, name, controller) {
      installStyle();
      var dialog = document.createElement('dialog');
      dialog.className = 'dsh-file-transfer-dialog';
      var inner = document.createElement('div'); inner.className = 'dsh-file-transfer-dialog-inner';
      var heading = document.createElement('h2'); heading.textContent = tr(dict, 'scanning');
      var nameLine = document.createElement('p'); nameLine.textContent = cleanName(name);
      var details = document.createElement('p'); details.textContent = tr(dict, 'scanReadOnly');
      var progress = document.createElement('p'); progress.className = 'dsh-file-transfer-progress'; progress.textContent = tr(dict, 'scanningProgress', { count: 0, size: formatBytes(0) });
      var actions = document.createElement('div'); actions.className = 'dsh-file-transfer-actions';
      var cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = tr(dict, 'cancel');
      cancel.addEventListener('click', function(){ controller.abort(); cancel.disabled = true; cancel.textContent = tr(dict, 'cancel') + '…'; });
      actions.appendChild(cancel);
      inner.appendChild(heading); inner.appendChild(nameLine); inner.appendChild(details); inner.appendChild(progress); inner.appendChild(actions); dialog.appendChild(inner); document.body.appendChild(dialog);
      dialog.addEventListener('cancel', function(event){ event.preventDefault(); controller.abort(); cancel.disabled = true; cancel.textContent = tr(dict, 'cancel') + '…'; });
      dialog.showModal();
      return {
        update: function(count, size){ progress.textContent = tr(dict, 'scanningProgress', { count: count, size: formatBytes(size) }); },
        close: function(){ if(dialog.open) dialog.close(); dialog.remove(); }
      };
    }

    function makeDialog(dict, plan, hooks) {
      installStyle();
      var dialog = document.createElement('dialog');
      dialog.className = 'dsh-file-transfer-dialog';
      var inner = document.createElement('div'); inner.className = 'dsh-file-transfer-dialog-inner';
      var heading = document.createElement('h2'); heading.textContent = tr(dict, 'confirmTitle');
      function paragraph(text, className) { var p = document.createElement('p'); p.textContent = text; if (className) p.className = className; inner.appendChild(p); return p; }
      inner.appendChild(heading);
      paragraph(tr(dict, plan.kind === 'folder' ? 'confirmFolder' : 'confirmFile', { name: plan.name }));
      if (plan.blocked === 'unknown-size') paragraph(tr(dict, 'confirmUnknownFileSize'));
      else paragraph(tr(dict, !plan.sizeExact ? 'confirmSizeLower' : 'confirmSize', { size: formatBytes(plan.size) }));
      if (plan.kind === 'folder') paragraph(tr(dict, !plan.sizeExact ? 'confirmCountLower' : 'confirmCount', { count: plan.files.length }));
      if (plan.blocked === 'unknown') paragraph(tr(dict, 'confirmUnknownSize'), 'dsh-file-transfer-error');
      else if (plan.blocked === 'unknown-size') paragraph(tr(dict, 'fileSizeUnknown'), 'dsh-file-transfer-error');
      else if (plan.blocked === 'too-large') paragraph(tr(dict, 'confirmTooLarge'), 'dsh-file-transfer-error');
      else if (plan.blocked === 'too-many') paragraph(tr(dict, 'confirmTooMany'), 'dsh-file-transfer-error');
      else {
        paragraph(tr(dict, plan.mode === 'direct' ? 'confirmDirect' : plan.mode === 'zip' ? plan.mixed ? 'confirmZipMixed' : plan.compressible ? 'confirmZipCompressed' : 'confirmZipStore' : 'confirmZipMixed'));
        if (plan.mode !== 'direct') paragraph(tr(dict, 'confirmEstimate'));
        var estimateNode = paragraph(plan.mode === 'direct' ? '' : tr(dict, 'estimateAfterStart'), 'dsh-file-transfer-estimate');
        estimateNode.hidden = plan.mode === 'direct';
        plan.updateZipEstimate = function(value, sampling) { estimateNode.textContent = tr(dict, 'estimateCompressed', { size: formatBytes(value) }) + (sampling ? ' …' : ''); };
        if (plan.zipEstimate !== void 0 && plan.mode !== 'direct') plan.updateZipEstimate(plan.zipEstimate, true);
        if (plan.size > MAX_FALLBACK_BLOB && typeof window.showSaveFilePicker !== 'function') paragraph(tr(dict, 'streamRequired'), 'dsh-file-transfer-error');
      }
      var progress = paragraph('', 'dsh-file-transfer-progress'); progress.hidden = true;
      var error = paragraph('', 'dsh-file-transfer-error'); error.hidden = true;
      var actions = document.createElement('div'); actions.className = 'dsh-file-transfer-actions';
      var cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = tr(dict, 'cancel');
      var requiresStreaming = plan.size > MAX_FALLBACK_BLOB && typeof window.showSaveFilePicker !== 'function';
      var confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = tr(dict, 'confirm'); confirm.setAttribute('data-primary', 'true'); confirm.disabled = Boolean(plan.blocked) || requiresStreaming;
      actions.appendChild(cancel); actions.appendChild(confirm); inner.appendChild(actions); dialog.appendChild(inner); document.body.appendChild(dialog);
      var settled = false;
      var transferStarted = false;
      function close(value) { if (settled) return; settled = true; if (dialog.open) dialog.close(); dialog.remove(); hooks.done(value); }
      function cancelOrClose() {
        if (transferStarted) {
          if (hooks.abort) hooks.abort();
          cancel.disabled = true;
          cancel.textContent = tr(dict, 'cancelDownload') + '…';
          return;
        }
        if (hooks.abort) hooks.abort();
        close(false);
      }
      cancel.addEventListener('click', cancelOrClose);
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); cancelOrClose(); });
      confirm.addEventListener('click', async function () {
        if (settled || confirm.disabled) return;
        confirm.disabled = true; progress.hidden = false; error.hidden = true;
        try {
          var saveHandle;
          if (typeof window.showSaveFilePicker === 'function') {
            saveHandle = await window.showSaveFilePicker({ suggestedName: plan.outputName });
            if (settled) return;
          } else if (plan.size > MAX_FALLBACK_BLOB) {
            throw new Error(tr(dict, 'savePickerUnsupported'));
          }
          if (settled) return;
          transferStarted = true;
          cancel.textContent = tr(dict, 'cancelDownload');
          await hooks.start(saveHandle, progress);
          if (!settled) close(true);
        } catch (reason) {
          if (settled) return;
          if (reason && reason.name === 'AbortError') { close(false); return; }
          if (hooks.signal && hooks.signal.aborted) { close(false); return; }
          error.textContent = reason && reason.message ? reason.message : String(reason);
          error.hidden = false; confirm.disabled = false; progress.hidden = true;
          cancel.textContent = tr(dict, 'cancel');
        }
      });
      dialog.showModal();
      return dialog;
    }

    async function scanPlan(remote, sessionId, path, kind, signal, onProgress) {
      if (!sessionId) throw new Error('No active session');
      if (kind === 'file') {
        var stat = await remote.workspaceFiles.stat(sessionId, path, signal);
        if (!stat.ok) throw stat.error;
        var value = stat.value;
        if (typeof value.bytes !== 'number' || !Number.isFinite(value.bytes)) return { kind: 'file', name: cleanName(value.absolutePath), size: 0, files: [], mode: 'direct', blocked: 'unknown-size', outputName: cleanName(value.absolutePath) };
        var zip = value.bytes > LARGE_FILE_ZIP_THRESHOLD && compressible(value.absolutePath);
        return { kind: 'file', path: value.absolutePath, stat: value, size: value.bytes, sizeExact: true, files: [{ path: value.absolutePath, relative: cleanName(value.absolutePath), stat: value }], name: cleanName(value.absolutePath), mode: zip ? 'zip' : 'direct', compressible: zip, blocked: value.bytes > MAX_UNCOMPRESSED ? 'too-large' : '', outputName: zip ? cleanName(value.absolutePath) + '.zip' : cleanName(value.absolutePath) };
      }
      var files = []; var directories = []; var total = 0; var entriesSeen = 0; var anyCompressible = false; var anyStored = false; var tooLarge = false; var tooMany = false; var unknown = false;
      async function visit(directory, relative) {
        if (signal.aborted) throw new Error('Download cancelled');
        if (tooLarge || tooMany || unknown) return;
        var result = await remote.workspaceFiles.list(sessionId, directory, signal);
        if (!result.ok) { unknown = true; return; }
        if (result.value.truncated) { tooMany = true; return; }
        var children = result.value.entries;
        for (var entry of children) {
          if (tooLarge || tooMany || unknown) return;
          entriesSeen++;
          if (entriesSeen > MAX_TREE_ENTRIES) { tooMany = true; return; }
          var child = safeRelative(directory, entry.name);
          var childRelative = relative ? relative.replace(/\/$/, '') + '/' + entry.name : entry.name;
          if (entry.type === 'directory') {
            directories.push(childRelative.replace(/\/$/, '') + '/');
            await visit(child, childRelative);
          } else if (entry.type === 'file') {
            var fileStat = await remote.workspaceFiles.stat(sessionId, child, signal);
            if (!fileStat.ok || typeof fileStat.value.bytes !== 'number' || !Number.isFinite(fileStat.value.bytes)) { unknown = true; return; }
            total += fileStat.value.bytes;
            var canCompress = compressible(childRelative);
            if (canCompress) anyCompressible = true; else anyStored = true;
            files.push({ path: child, relative: childRelative, stat: fileStat.value });
            if (onProgress) onProgress(files.length, total, false);
            if (total > MAX_UNCOMPRESSED) { tooLarge = true; return; }
          } else { unknown = true; return; }
        }
      }
      await visit(path, '');
      if (onProgress) onProgress(files.length, total, true);
      return { kind: 'folder', path: path, size: total, sizeExact: !unknown && !tooMany && !tooLarge, files: files, directories: directories, name: cleanName(path), mode: 'zip', compressible: anyCompressible, mixed: anyCompressible && anyStored, blocked: unknown ? 'unknown' : tooMany ? 'too-many' : tooLarge ? 'too-large' : '', outputName: cleanName(path) + '.zip' };
    }

    async function writeDirect(remote, sessionId, plan, signal, writer, progressNode, dict) {
      var written = 0;
      var chunks = [];
      for await (var chunk of fileChunks(remote, sessionId, plan.path, plan.stat, signal)) {
        if (writer) await writer.write(chunk); else chunks.push(chunk);
        written += chunk.length;
        progressNode.textContent = tr(dict, 'progressDirect', { done: formatBytes(written), total: formatBytes(plan.size) });
      }
      if (!writer) triggerDownload(new Blob(chunks, { type: 'application/octet-stream' }), plan.outputName);
    }

    async function writeZip(remote, sessionId, plan, signal, writer, progressNode, dict) {
      var progress = 0;
      function onBytes(count) { progress += count; progressNode.textContent = tr(dict, 'progress', { done: formatBytes(progress), total: formatBytes(plan.size) }); }
      var chunks = [];
      var zip = new ZipWriter(async function (bytes) { if (writer) await writer.write(bytes); else chunks.push(bytes); });
      var estimatedCompressed = 0;
      var estimatedStored = 0;
      var entriesCompleted = 0;
      var totalEntries = plan.kind === 'folder' ? plan.files.length : 1;
      zip.onSampleEstimate = function(sample) {
        var estimate = sample.compress && sample.sampled
          ? sample.sampleCompressed + Math.max(0, sample.inputBytes - sample.sampleInput) * sample.sampleCompressed / sample.sampleInput
          : sample.inputBytes;
        if (sample.compress && sample.sampled) estimatedCompressed += estimate;
        else estimatedStored += estimate;
        plan.zipEstimate = estimatedCompressed + estimatedStored;
        entriesCompleted++;
        var centralDirectoryEstimate = (entriesCompleted + totalEntries) * 120 + 256;
        if (plan.updateZipEstimate) plan.updateZipEstimate(plan.zipEstimate + centralDirectoryEstimate, entriesCompleted < totalEntries);
      };
      if (plan.kind === 'folder') await zip.add(plan.name + '/', (async function*(){})(), false, signal, function(){}, 0);
      for (var directory of plan.directories) await zip.add(plan.name + '/' + directory, (async function*(){})(), false, signal, function(){}, 0);
      if (plan.kind === 'file') {
        if (signal.aborted) throw new Error('Download cancelled');
        await zip.add(plan.files[0].relative, fileChunks(remote, sessionId, plan.path, plan.stat, signal), plan.compressible, signal, onBytes, plan.stat.bytes);
      } else {
        for (var file of plan.files) {
          if (signal.aborted) throw new Error('Download cancelled');
          await zip.add(plan.name + '/' + file.relative, fileChunks(remote, sessionId, file.path, file.stat, signal), compressible(file.relative), signal, onBytes, file.stat.bytes);
        }
      }
      await zip.finish();
      plan.zipEstimate = zip.offset;
      if (plan.updateZipEstimate) plan.updateZipEstimate(plan.zipEstimate, false);
      if (!writer) triggerDownload(new Blob(chunks, { type: 'application/zip' }), plan.outputName);
    }

    async function startTransfer(remote, sessionId, plan, controller, saveHandle, progressNode, dict) {
      var writable;
      try {
        writable = saveHandle ? await saveHandle.createWritable() : null;
        if (plan.mode === 'direct') await writeDirect(remote, sessionId, plan, controller.signal, writable, progressNode, dict);
        else await writeZip(remote, sessionId, plan, controller.signal, writable, progressNode, dict);
        if (writable) await writable.close();
      } catch (error) {
        if (writable) { try { await writable.abort(error); } catch (_) {} }
        throw error;
      }
    }

    function openDownload(remote, sessionId, path, kind, dict, onDone) {
      var scanController = new AbortController();
      var scanDialog = kind === 'folder' ? makeScanningDialog(dict, path, scanController) : null;
      scanPlan(remote, sessionId, path, kind, scanController.signal, function(count, size){ if(scanDialog) scanDialog.update(count, size); }).then(function (plan) {
        if(scanDialog) scanDialog.close();
        if(scanController.signal.aborted) { if(onDone) onDone(); return; }
        var confirmController = new AbortController();
        makeDialog(dict, plan, {
          signal: confirmController.signal,
          abort: function () { confirmController.abort(); },
          done: function () { if (onDone) onDone(); },
          start: function (saveHandle, progress) {
            return startTransfer(remote, sessionId, plan, confirmController, saveHandle, progress, dict);
          }
        });
      }).catch(function (error) {
        if(scanDialog) scanDialog.close();
        if(!scanController.signal.aborted) {
          console.error('[dsh-file-transfer] scan failed:', error);
          window.alert(error && error.message ? error.message : String(error));
        }
        if (onDone) onDone();
      });
    }

    function DownloadAction(props) {
      var _a = useState(false); var busy = _a[0]; var setBusy = _a[1];
      var t = props.t;
      var dict = props.isZh ? zh : en;
      var label = busy ? t('scanning') : t('download');
      function click() {
        if (busy) return;
        setBusy(true);
        openDownload(props.remote, props.sessionId, props.absolutePath, 'file', dict, function(){ setBusy(false); });
      }
      return React.createElement(Tooltip, {
        label: t('download'), side: 'bottom', delayMs: 500,
        children: React.createElement('button', {
          type: 'button', className: 'dsh-file-transfer-tool', 'aria-label': label,
          title: label, 'data-textpreview-tool': 'download', disabled: busy,
          onClick: click, children: React.createElement(IconDownloadOutlineRegular, { size: 16 })
        })
      });
    }

    /** The Host upload endpoint for one file in one folder. */
    function uploadUrl(sessionId, directory, name) {
      var query = new URLSearchParams();
      query.set('sessionId', String(sessionId));
      query.set('directory', String(directory));
      query.set('name', String(name));
      return UPLOAD_ROUTE + '?' + query.toString();
    }

    /**
     * Ask one yes/no question in a plain dialog. Resolves false when the user
     * dismisses it, so an accidental Escape never starts a transfer.
     */
    function makeSimpleDialog(dict, title, lines, primaryLabel) {
      return new Promise(function (resolve) {
        installStyle();
        var dialog = document.createElement('dialog');
        dialog.className = 'dsh-file-transfer-dialog';
        var inner = document.createElement('div'); inner.className = 'dsh-file-transfer-dialog-inner';
        var heading = document.createElement('h2'); heading.textContent = title; inner.appendChild(heading);
        lines.forEach(function (line) { var p = document.createElement('p'); p.textContent = line; inner.appendChild(p); });
        var actions = document.createElement('div'); actions.className = 'dsh-file-transfer-actions';
        var cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = tr(dict, 'cancel');
        var confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = primaryLabel; confirm.setAttribute('data-primary', 'true');
        actions.appendChild(cancel); actions.appendChild(confirm); inner.appendChild(actions);
        dialog.appendChild(inner); document.body.appendChild(dialog);
        var settled = false;
        function close(value) { if (settled) return; settled = true; if (dialog.open) dialog.close(); dialog.remove(); resolve(value); }
        cancel.addEventListener('click', function () { close(false); });
        dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(false); });
        confirm.addEventListener('click', function () { close(true); });
        dialog.showModal();
        confirm.focus();
      });
    }

    /**
     * Upload one file through XMLHttpRequest, the only transport that reports
     * both body-upload progress and cancellation in every target browser. The
     * browser streams the file from disk; the body is never held in JS.
     */
    function uploadOneFile(file, sessionId, directory, signal, onProgress) {
      return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        var settled = false;
        function finish(settle, value) {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', abort);
          settle(value);
        }
        function abort() {
          request.abort();
          finish(reject, new DOMException('Upload cancelled', 'AbortError'));
        }
        request.open('POST', uploadUrl(sessionId, directory, file.name));
        request.responseType = 'text';
        request.setRequestHeader('Content-Type', 'application/octet-stream');
        request.upload.addEventListener('progress', function (event) {
          onProgress(event.loaded, event.lengthComputable ? event.total : file.size);
        });
        request.addEventListener('load', function () {
          var body;
          try { body = JSON.parse(request.responseText); } catch (_) { body = void 0; }
          if (request.status === 201 && body && body.ok === true && typeof body.name === 'string') { finish(resolve, body); return; }
          var message = body && body.error && body.error.message ? body.error.message : ('HTTP ' + request.status);
          finish(reject, new Error(message));
        });
        request.addEventListener('error', function () { finish(reject, new Error('network error')); });
        request.addEventListener('abort', function () { finish(reject, new DOMException('Upload cancelled', 'AbortError')); });
        if (signal.aborted) { abort(); return; }
        signal.addEventListener('abort', abort, { once: true });
        request.send(file);
      });
    }

    /** Re-read the Files tree so freshly uploaded entries appear. */
    function refreshTree() {
      var reload = document.querySelector('button[data-files-reload]');
      if (reload) reload.click();
    }

    /** Render the modal that drives a multi-file upload, with progress and cancel. */
    function runUpload(ctx, sessionId, directory, dict, button, files) {
      var controller = new AbortController();
      var dialog = document.createElement('dialog');
      dialog.className = 'dsh-file-transfer-dialog';
      var inner = document.createElement('div'); inner.className = 'dsh-file-transfer-dialog-inner';
      var heading = document.createElement('h2'); heading.textContent = tr(dict, 'uploadTitle'); inner.appendChild(heading);
      var target = document.createElement('p'); target.textContent = tr(dict, 'uploadTarget', { path: directory }); inner.appendChild(target);
      var progress = document.createElement('p'); progress.className = 'dsh-file-transfer-progress';
      progress.textContent = tr(dict, 'uploadTotal', { size: formatBytes(files.reduce(function (sum, file) { return sum + file.size; }, 0)) });
      inner.appendChild(progress);
      var error = document.createElement('p'); error.className = 'dsh-file-transfer-error'; error.hidden = true; inner.appendChild(error);
      var actions = document.createElement('div'); actions.className = 'dsh-file-transfer-actions';
      var cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = tr(dict, 'uploadCancel');
      var close = document.createElement('button'); close.type = 'button'; close.textContent = tr(dict, 'close'); close.setAttribute('data-primary', 'true'); close.hidden = true;
      actions.appendChild(cancel); actions.appendChild(close); inner.appendChild(actions);
      dialog.appendChild(inner); document.body.appendChild(dialog);
      var uploading = true;
      var settled = false;
      function dismiss() { if (settled) return; settled = true; if (dialog.open) dialog.close(); dialog.remove(); }
      function finishView() { uploading = false; cancel.hidden = true; close.hidden = false; close.disabled = false; close.focus(); }
      function onCancel() {
        if (!uploading) { dismiss(); return; }
        controller.abort();
        cancel.disabled = true;
        cancel.textContent = tr(dict, 'uploadCancel') + '…';
      }
      cancel.addEventListener('click', onCancel);
      close.addEventListener('click', dismiss);
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); onCancel(); });
      button.disabled = true;
      dialog.showModal();
      (async function () {
        var uploaded = [];
        try {
          for (var index = 0; index < files.length; index += 1) {
            if (controller.signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');
            var file = files[index];
            var label = files.length > 1 ? ('[' + (index + 1) + '/' + files.length + '] ') : '';
            progress.textContent = label + tr(dict, 'uploadProgress', { name: file.name, done: formatBytes(0), total: formatBytes(file.size) });
            var result = await uploadOneFile(file, sessionId, directory, controller.signal, function (loaded, expected) {
              progress.textContent = label + tr(dict, 'uploadProgress', { name: file.name, done: formatBytes(loaded), total: formatBytes(expected) });
            });
            uploaded.push(result.name);
          }
          progress.textContent = tr(dict, 'uploadDone', { names: uploaded.join(', ') });
          finishView();
        } catch (reason) {
          if (controller.signal.aborted || (reason && reason.name === 'AbortError')) {
            progress.textContent = tr(dict, 'uploadCancelled');
          } else {
            error.textContent = tr(dict, 'uploadFailed', { message: (reason && reason.message) || String(reason) });
            error.hidden = false;
          }
          finishView();
        } finally {
          button.disabled = false;
          // Uploaded files must show up even after a partial failure.
          refreshTree();
        }
      })();
    }

    /** Open the file picker, confirm the destination, then start the upload. */
    function chooseAndUpload(ctx, sessionId, directory, dict, button) {
      var input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);
      var answered = false;
      function settle(files) {
        if (answered) return;
        answered = true;
        window.clearTimeout(timer);
        input.removeEventListener('change', onChange);
        input.removeEventListener('cancel', onCancel);
        if (input.parentNode) input.parentNode.removeChild(input);
        start(files);
      }
      function onChange() { settle(Array.prototype.slice.call(input.files || [])); }
      // A dismissed picker fires no `change` in some browsers; the timeout and
      // the `cancel` event only release the input, they never start an upload.
      function onCancel() { settle([]); }
      input.addEventListener('change', onChange);
      input.addEventListener('cancel', onCancel);
      var timer = window.setTimeout(function () { settle([]); }, 120000);
      input.click();

      async function start(files) {
        if (files.length === 0) return;
        if (!currentSessionId(ctx, sessionId)) { window.alert(tr(dict, 'uploadSessionChanged')); return; }
        var oversized = files.filter(function (file) { return file.size > MAX_UPLOAD_BYTES; });
        if (oversized.length > 0) {
          window.alert(tr(dict, 'uploadTooLarge', { names: oversized.map(function (file) { return file.name; }).join(', ') }));
          return;
        }
        var total = files.reduce(function (sum, file) { return sum + file.size; }, 0);
        var confirmed = await makeSimpleDialog(dict, tr(dict, 'uploadTitle'), [
          tr(dict, 'uploadTarget', { path: directory }),
          tr(dict, 'uploadCount', { count: files.length }),
          tr(dict, 'uploadTotal', { size: formatBytes(total) }),
          tr(dict, 'uploadMax'),
          tr(dict, 'uploadCollision')
        ], tr(dict, 'uploadStart'));
        if (!confirmed) return;
        // The workspace is per session; never write into a workspace the user
        // has since navigated away from.
        if (!currentSessionId(ctx, sessionId)) { window.alert(tr(dict, 'uploadSessionChanged')); return; }
        runUpload(ctx, sessionId, directory, dict, button, files);
      }
    }

    /** True while the browser still shows the session the target folder belongs to. */
    function currentSessionId(ctx, expected) {
      var snapshot = ctx.uiSession.adapter.current.getSnapshot();
      return Boolean(snapshot) && snapshot.key === expected;
    }

    function installTreeActions(ctx, remote) {
      var observer;
      var localeIsZh = function(){ return /^zh/i.test(document.documentElement.lang || navigator.language || 'en'); };
      function addDownloadButton(row, kind, path, dict, downloadLabel) {
        if (row.querySelector(':scope > .' + TREE_ROW_ACTION)) return;
        var button = document.createElement('button');
        button.type = 'button'; button.className = 'dsh-file-transfer-tool ' + TREE_ROW_ACTION;
        button.setAttribute('aria-label', downloadLabel);
        button.title = downloadLabel;
        button.innerHTML = ICON_DOWNLOAD;
        button.addEventListener('click', function(event){
          event.preventDefault(); event.stopPropagation();
          var sessionSnapshot = ctx.uiSession.adapter.current.getSnapshot();
          var sessionId = sessionSnapshot && sessionSnapshot.key;
          if (!sessionId) { window.alert(tr(dict,'noSession')); return; }
          button.disabled = true;
          button.title = dict.scanning;
          openDownload(remote, sessionId, path, kind, dict, function(){ button.disabled = false; button.title = downloadLabel; });
        });
        row.appendChild(button);
      }
      function addUploadButton(row, path, dict, uploadLabel) {
        if (row.querySelector(':scope > .' + TREE_UPLOAD_ACTION)) return;
        var button = document.createElement('button');
        button.type = 'button'; button.className = 'dsh-file-transfer-tool ' + TREE_UPLOAD_ACTION;
        button.setAttribute('aria-label', uploadLabel);
        button.title = uploadLabel;
        button.innerHTML = ICON_UPLOAD;
        button.addEventListener('click', function(event){
          event.preventDefault(); event.stopPropagation();
          var sessionSnapshot = ctx.uiSession.adapter.current.getSnapshot();
          var sessionId = sessionSnapshot && sessionSnapshot.key;
          if (!sessionId) { window.alert(tr(dict,'noSession')); return; }
          chooseAndUpload(ctx, sessionId, path, dict, button);
        });
        row.appendChild(button);
      }
      function addButton(row) {
        var kind = row.getAttribute('data-files-entry');
        if (kind !== 'file' && kind !== 'directory') return;
        var path = row.getAttribute('data-files-path');
        if (!path) return;
        var dict = localeIsZh() ? zh : en;
        addDownloadButton(row, kind, path, dict, dict.download);
        // Upload targets a folder; a file row keeps its download button only.
        if (kind === 'directory') addUploadButton(row, path, dict, dict.upload);
      }
      function scan(root) {
        if (root.matches && root.matches('li[data-files-entry]')) addButton(root);
        if (root.querySelectorAll) root.querySelectorAll('li[data-files-entry]').forEach(addButton);
      }
      function observe() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(function(records){
          records.forEach(function(record){ record.addedNodes.forEach(function(node){ if (node.nodeType === 1) scan(node); }); });
        });
        document.querySelectorAll('[data-files-state="tree"]').forEach(function(tree){
          scan(tree);
          observer.observe(tree, { childList: true, subtree: true });
        });
      }
      var disposer = ctx.effect(function(){
        installStyle();
        observe();
        var bodyObserver = new MutationObserver(observe);
        bodyObserver.observe(document.body, { childList: true, subtree: true });
        return function(){ if(observer) observer.disconnect(); bodyObserver.disconnect(); };
      }, 'dsh-file-transfer: workspace tree actions');
      return disposer;
    }

    function apply(ctx) {
      installStyle();
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, 'dsh-file-transfer: dictionaries');
      var t = ctx.locale.bind(NS);
      ctx.slots.inject('sidebar.right.tab.document.actions', function () {
        return ctx.slots.register({
          name: 'sidebar.right.tab.document.actions', id: 'dsh-file-transfer', order: 20, locale: NS,
          inject: function (_owner, hooks) {
            var tabInfoHook = hooks && hooks.tabInfo;
            var sessionId = tabInfoHook ? tabInfoHook().tab.sessionId : void 0;
            return {
              sessionId: sessionId,
              remote: ctx.remote,
              isZh: /^zh/i.test(document.documentElement.lang || navigator.language || 'en')
            };
          }
        }, DownloadAction);
      });
      installTreeActions(ctx, ctx.remote);
    }

    exports.name = 'dsh-file-transfer';
    exports.inject = ['slots', 'locale', 'remote', 'remote.workspaceFiles', 'uiSession'];
    exports.apply = apply;
    return module.exports;
  }
});
