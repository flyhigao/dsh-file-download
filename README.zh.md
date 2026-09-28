# dsh-file-download

[English](README.md) | 简体中文

DeepSeek Harness 下载插件：在右侧文件预览工具栏的刷新按钮旁添加下载按钮。

## 功能

- 按原文件名下载当前正在预览的文件。
- 通过 DSH 已鉴权、按会话隔离的 `workspaceFiles` Remote 读取文件；不新增服务端路由，也不让浏览器直接访问文件系统。
- 按 2 MiB 分段读取，并在下载过程中校验文件标识和版本，因此可下载大于 Host 默认单次读取上限的文件。
- 最大支持 256 MiB；超过上限的文件会被拒绝，以限制浏览器内存占用。
- 文件不可读、超过大小限制或下载过程中发生变化时，按钮提示会显示具体失败原因。
- 只要 DSH 已解析出文件路径，支持预览的文件和暂不支持预览的文件均可下载。

插件继续遵循 Host 现有的会话和文件系统权限，不会绕过文件授权。

## 环境要求

- DSH Web `0.1.7-rc.2` 或更新版本，并启用文档预览和 workspace file Remote。
- 当前会话有权限读取目标文件。

## 安装

在 DSH 插件市场搜索 **dsh-file-download**，安装到所需 profile。安装后重启 DSH Web 服务，并在浏览器中硬刷新页面。

也可以直接从 GitHub 安装：

```bash
dsh plugin --profile web add github:flyhigao/dsh-file-download
```

本地开发安装：

```bash
dsh plugin --profile web add file:/path/to/dsh-file-download
```

## 使用

1. 在右侧 Files 文件栏打开一个文件，使其显示在预览页中。
2. 点击预览刷新按钮旁的下载图标。
3. 浏览器会以原始文件名保存文件。

如果下载失败，将鼠标悬停在按钮上即可查看错误原因。超过 256 MiB 的文件会被有意拒绝；如果浏览器内存足够，可以在 `client/client.js` 中调低或调整 `MAX_DOWNLOAD_BYTES`。

## 包结构

- `lib/index.js` — Host 插件入口。
- `client/client.js` — 客户端下载操作。
- `cordis.patch.yml` — 将插件包加入 profile bundle。
- `package.json` — DSH 可安装 bundle 和客户端注入清单。

界面通过可叠加的 `sidebar.right.tab.document.actions` 插槽贡献下载按钮，不修改 DSH 核心包或内置文件预览插件。

## 开发检查

```bash
node --check lib/index.js
node --check client/client.js
npm pack --dry-run
```

## 许可证

MIT，详见 [LICENSE](LICENSE)。
