# dsh-file-download

English | [简体中文](README.zh.md)

A small DeepSeek Harness plugin that adds download buttons beside the reload control in the right-side document preview toolbar and on workspace file/folder rows.

## Features

- Downloads the currently previewed file under its original filename.
- Reads bytes through DSH's authenticated, session-scoped `workspaceFiles` Remote; it does not add a server route or access the filesystem directly from the browser.
- Shows a confirmation dialog before reading file contents. For folders, a separate scan-progress dialog first reports that only directory entries and file sizes are read; after the scan, the confirmation reports total uncompressed size and file count before ZIP creation begins.
- Refuses files/folders whose uncompressed contents exceed 10 GiB. If a folder listing is truncated or any size cannot be established, the download is blocked rather than underreported.
- Files above 1 GiB are ZIP-compressed only when their extension indicates a text-like format. Folder files are sampled after confirmation; low-yield samples (under 5% savings) are stored without recompression. Binary/media files are not selected for compression based on their extension. The confirmation dialog first reports the uncompressed size, then updates with a sample-based estimated ZIP size during compression.
- Reads in 2 MiB ranges and verifies file identity/version while downloading. ZIP output is streamed directly to the chosen destination when the browser supports the File System Access save picker. The dialog remains open during transfer and its cancel button aborts the read/compression and removes the incomplete destination.
- Uses the browser's streaming save picker for large output. Without it, output over 256 MiB is refused to avoid buffering a multi-gigabyte download in browser memory.
- Shows a specific failure reason when the file is unavailable, exceeds limits, or changes during download.
- Works with previewable and unsupported file types once DSH has resolved the file path.

The Host's existing session and filesystem authorization still applies. This plugin does not bypass file permissions.

## Requirements

- DSH Web `0.1.7-rc.2` or newer, with the document preview and workspace file Remote enabled.
- A session file that DSH can read.

## Install

From the DSH plugin market, search for **dsh-file-download** and install it into the desired profile. Restart the DSH Web service and hard-refresh the browser page after installation.

You can also install directly from this GitHub repository:

```bash
dsh plugin --profile web add github:flyhigao/dsh-file-download
```

For local development:

```bash
dsh plugin --profile web add file:/path/to/dsh-file-download
```

## Use

1. Open a file from the right-side Files tab so it appears in the document preview.
2. Click the download icon beside the preview's reload button.
3. The browser saves the original file under its original basename. Use the download icon on a folder row to create a ZIP with that folder as the archive's top-level directory.

Every download first shows a confirmation dialog with the uncompressed size and planned behavior. A single file above 1 GiB is ZIP-compressed when its extension is recognized as text-like; likely binary/media formats are not recompressed. Folder downloads always produce a ZIP with the folder name as the top-level directory. The 10 GiB limit applies to the sum of the uncompressed input bytes, not the ZIP output size. Large output requires a browser that supports streaming to a save location; otherwise outputs above 256 MiB are refused. Compression behavior and ratios are estimates based on filename extensions, not content inspection.

## Package layout

- `lib/index.js` — Host plugin entry.
- `client/client.js` — client-side download action.
- `cordis.patch.yml` — adds the package to a profile's bundle.
- `package.json` — DSH installable bundle and browser injection manifest.

The preview-toolbar contribution uses the additive `sidebar.right.tab.document.actions` slot. File-tree row buttons are attached to the current Files tab DOM because DSH 0.1.7 does not expose a per-row action slot; this enhancement does not modify DSH core packages, but it may need adapting if the upstream Files view changes.

## Development checks

```bash
node --check lib/index.js
node --check client/client.js
npm pack --dry-run
```

## License

MIT. See [LICENSE](LICENSE).
