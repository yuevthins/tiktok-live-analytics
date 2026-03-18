# TikTok Live Analytics / TikTok 直播间分析工具

A Chrome extension + local Node server for real-time TikTok live stream data collection and analysis.

Chrome 扩展 + 本地 Node 服务器，实时采集 TikTok 直播间数据并分析。

## Screenshots / 截图

### Connect / 连接直播间

<img src="screenshots/01-connect.png" width="360" alt="Connect to live room">

Enter a TikTok username and click Connect to start collecting data.

输入 TikTok 用户名，点击连接即可开始采集数据。

### Live Dashboard / 实时监控面板

<img src="screenshots/02-live-dashboard.png" width="360" alt="Live monitoring dashboard">

| Feature / 功能 | Description / 说明 |
|---|---|
| Viewer count / 观众数 | Real-time count with delta indicator and peak tracking / 实时观众数，含变化趋势和峰值追踪 |
| Comment count / 评论数 | Total comments collected in current session / 当前会话累计评论总数 |
| Duration / 直播时长 | Live timer since connection / 连接后实时计时 |
| Likes / 点赞 | Accumulated likes with compact number format / 累计点赞数，大数字自动缩写 |
| Gifts / 礼物 | Gift events count / 礼物事件计数 |
| Viewer trend chart / 观众趋势图 | Chart.js line chart with peak marker / 折线图展示观众变化趋势，标记峰值点 |
| Hot keywords / 热门词汇 | Auto-extracted high-frequency words from comments / 从评论中自动提取高频词汇 |
| Top contributors / 贡献榜 | Gift leaderboard with coin counts / 礼物打赏排行榜，显示打赏金额 |
| Live comments / 最近评论 | Scrolling comment feed with avatars / 评论实时滚动流，含头像和昵称 |
| Export buttons / 导出按钮 | Copy summary, HTML report, Excel, JSON / 复制摘要、HTML 报告、Excel、JSON 四种导出 |

### Session History / 采集历史

<img src="screenshots/03-history.png" width="360" alt="Session history with export">

| Feature / 功能 | Description / 说明 |
|---|---|
| Session cards / 会话卡片 | Each live stream as a card with username, time, duration, stats / 每场直播一张卡片，显示用户名、时间、时长、数据 |
| Status badge / 状态标签 | Active (green) or Completed (gray) / 采集中（绿色）或已完成（灰色）|
| Export per session / 按会话导出 | HTML report, Excel (.xlsx), JSON for each session / 每个会话独立导出为 HTML 报告、Excel、JSON |
| Stop / Delete / 停止/删除 | Stop active session or delete completed ones / 停止采集中的会话，或删除已完成的会话 |
| Clear all / 清空全部 | Remove all history data / 一键清空所有历史数据 |

## Features / 功能一览

| Category / 类别 | Feature / 功能 | Details / 详情 |
|---|---|---|
| Data Collection / 数据采集 | Comments / 评论 | User ID, username, nickname, content, timestamp |
| | Gifts / 礼物 | Gift name, repeat count, diamond value |
| | Likes / 点赞 | Like count, total likes |
| | Viewers / 观众 | Real-time count, top viewer leaderboard |
| | Follows / 关注 | New follower events |
| | Shares / 分享 | Share events |
| Storage / 存储 | IndexedDB | 7 tables via Dexie.js, survives browser restart / 7 张表，浏览器重启不丢数据 |
| | Session-based / 按会话 | Each stream is a separate session / 每场直播独立存储 |
| Export / 导出 | JSON | Full raw data export / 完整原始数据 |
| | Excel (.xlsx) | Formatted spreadsheet with multiple sheets / 多 Sheet 格式化表格 |
| | HTML Report | Self-contained report with embedded Chart.js / 自包含报告，内嵌图表 |
| | Copy Summary | One-click clipboard summary / 一键复制直播摘要到剪贴板 |
| UI / 界面 | Dark / Light mode | Theme toggle with persistence / 深色/浅色主题切换，自动保存 |
| | Bento grid stats | Dashboard-style stat cards / 仪表盘风格数据卡片 |
| | Word cloud / 热词 | Auto-extracted hot keywords / 自动提取评论热词 |
| Security / 安全 | Origin validation | Only localhost + chrome-extension / 仅允许本地和扩展来源 |
| | Input sanitization | HTML escape + username regex / HTML 转义 + 用户名正则验证 |
| | wsUrl whitelist | Only ws(s)://localhost or 127.0.0.1 / WebSocket 地址白名单 |

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
