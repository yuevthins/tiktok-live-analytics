# TikTok Live Analytics / TikTok 直播间分析工具

A Chrome extension + local Node server for real-time TikTok live stream data collection and analysis.

Chrome 扩展 + 本地 Node 服务器，实时采集 TikTok 直播间数据并分析。

## Features / 功能

- **Real-time data capture / 实时数据采集** — Comments, gifts, likes, follows, shares, viewer counts
  评论、礼物、点赞、关注、分享、观众数
- **Persistent storage / 持久化存储** — IndexedDB via Dexie.js, data survives browser restart
  基于 IndexedDB (Dexie.js)，浏览器重启不丢数据
- **Multi-format export / 多格式导出** — JSON, Excel (.xlsx), self-contained HTML report with charts
  JSON、Excel、自包含 HTML 报告（含图表）
- **Session management / 会话管理** — Each live stream is a separate session with full history
  每场直播独立会话，完整历史记录
- **Security hardened / 安全加固** — Origin validation, input sanitization, wsUrl whitelist
  来源验证、输入消毒、WebSocket 地址白名单

## Architecture / 架构

```
TikTok Live API
    ↓ (tiktok-live-connector)
Node Server (port 3456)
    ↓ WebSocket
Chrome Extension (MV3)
    ├── Background Service Worker — data collection & buffering
    ├── IndexedDB (Dexie.js) — persistent storage
    └── Popup UI (Vue 3) — real-time display & export
```

## Quick Start / 快速开始

### Prerequisites / 前提条件

- Node.js >= 18
- Chrome browser
- A TikTok live stream username to monitor

### 1. Start the server / 启动服务器

```bash
cd tiktok-live-server
npm install
node server.js
```

The server runs at `http://localhost:3456` (HTTP + WebSocket).

服务器运行在 `http://localhost:3456`（HTTP + WebSocket）。

### 2. Build & install the extension / 构建并安装扩展

```bash
cd tiktok-live-extension
npm install
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `tiktok-live-extension/dist/chrome-mv3`

在 Chrome 中：
1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择 `tiktok-live-extension/dist/chrome-mv3`

### 3. Use / 使用

1. Click the extension icon in Chrome toolbar / 点击 Chrome 工具栏的扩展图标
2. Enter a TikTok username / 输入 TikTok 用户名
3. Click "Connect" / 点击「连接」
4. Data starts flowing in real-time / 数据开始实时流入
5. Export anytime via JSON, Excel, or HTML report / 随时导出为 JSON、Excel 或 HTML 报告

## Development / 开发

### Server / 服务器

```bash
cd tiktok-live-server
node server.js          # Start server / 启动服务器
npm test                # Run tests (15 tests: unit + integration)
```

### Extension / 扩展

```bash
cd tiktok-live-extension
npm run dev             # Dev mode with hot reload / 开发模式（热重载）
npm run build           # Production build / 生产构建
npm test                # Run tests (14 tests)
```

## Tech Stack / 技术栈

| Layer / 层 | Technology / 技术 |
|---|---|
| Extension framework | [WXT](https://wxt.dev/) (Chrome MV3) |
| Popup UI | Vue 3 (Composition API) |
| Data storage | [Dexie.js](https://dexie.org/) (IndexedDB) |
| Charts | Chart.js |
| Excel export | [SheetJS](https://sheetjs.com/) (xlsx) |
| Live API | [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) |
| Testing | [Vitest](https://vitest.dev/) |

## WebSocket Protocol / WebSocket 协议

Server → Extension messages:

| type | Description / 说明 |
|---|---|
| `status` | Initial connection status / 初始连接状态 |
| `connected` | Successfully connected to live room / 成功连接直播间 |
| `disconnected` | Disconnected / 断开连接 |
| `error` | Error message / 错误信息 |
| `comment` | Live comment / 直播评论 |
| `gift` | Gift event (sent on repeatEnd) / 礼物事件 |
| `like` | Like event / 点赞事件 |
| `roomUser` | Viewer count + top viewers / 观众数 + 打赏榜 |
| `follow` / `share` / `subscribe` | User actions / 用户行为 |
| `streamEnd` | Stream ended / 直播结束 |

Extension → Server actions: `{ action: 'connect', username }` / `{ action: 'disconnect' }`

## Security / 安全

- **Origin validation**: Only `localhost`, `127.0.0.1`, and `chrome-extension://` origins are allowed
- **Username validation**: Strict regex `/^[a-zA-Z0-9_.]{1,24}$/`
- **wsUrl whitelist**: Only `ws://` or `wss://` to `localhost` or `127.0.0.1`, no paths allowed
- **XSS prevention**: All user input is HTML-escaped before display
- **来源验证**：仅允许 `localhost`、`127.0.0.1` 和 `chrome-extension://`
- **用户名验证**：严格正则 `/^[a-zA-Z0-9_.]{1,24}$/`
- **WebSocket 地址白名单**：仅允许 `ws://` 或 `wss://` 连接 `localhost` 或 `127.0.0.1`
- **XSS 防护**：所有用户输入在显示前进行 HTML 转义

## License / 许可证

[MIT](LICENSE)
