# dsh-file-download

English | [简体中文](README.zh.md)

A small DeepSeek Harness plugin that adds a download button beside the reload button in the right-side document preview toolbar.

## Features

- Downloads the currently previewed file under its original filename.
- Reads bytes through DSH's authenticated, session-scoped `workspaceFiles` Remote; it does not add a server route or access the filesystem directly from the browser.
- Reads in 2 MiB ranges and verifies file identity/version while downloading, so files larger than the Host's default single-read limit can still be downloaded safely.
- Supports files up to 256 MiB. Larger files are rejected before download to limit browser memory use.
- Shows a specific failure reason in the button tooltip when the file is unavailable, too large, or changes during download.
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
3. The browser saves the original file under its original basename.

If the download fails, hover over the button to see the error. A file that is larger than 256 MiB is intentionally refused; lower `MAX_DOWNLOAD_BYTES` in `client/client.js` only if the browser has enough memory.

## Package layout

- `lib/index.js` — Host plugin entry.
- `client/client.js` — client-side download action.
- `cordis.patch.yml` — adds the package to a profile's bundle.
- `package.json` — DSH installable bundle and browser injection manifest.

The UI contribution uses the additive `sidebar.right.tab.document.actions` slot. It does not modify DSH's core packages or the document-preview plugin.

## Development checks

```bash
node --check lib/index.js
node --check client/client.js
npm pack --dry-run
```

## License

MIT. See [LICENSE](LICENSE).
