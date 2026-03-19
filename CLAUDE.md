# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TikTok 直播间分析工具 - Chrome 扩展 + 本地 Node 服务器，实时采集 TikTok 直播间评论、礼物、观众等数据，支持 IndexedDB 持久化和多格式导出。

## Development Commands

### tiktok-live-server（Node 服务器）

```bash
cd tiktok-live-server
npm install && node server.js   # 启动在 ws://localhost:3456, http://localhost:3456
```

### tiktok-live-extension（Chrome 扩展）

```bash
cd tiktok-live-extension
npm install
npm run dev          # 开发模式（热重载），predev 自动生成 chartjs-inline
npm run build        # 生产构建 → dist/chrome-mv3
npm run zip          # 打包 .zip
```

构建输出 `dist/chrome-mv3`（非默认 `.output`，因隐藏目录在 Chrome 加载时不可见）。

## Architecture

```
TikTok Live API
    ↓ (tiktok-live-connector)
Node 服务器 (server.js, port 3456)
    ↓ WebSocket (JSON 消息)
Chrome 扩展 Background (Service Worker)
    ↓ chrome.runtime.sendMessage
Popup UI (Vue 3)         IndexedDB (Dexie.js)
```

### 技术栈

| 层 | 技术 |
|----|------|
| 扩展框架 | WXT (MV3) |
| Popup UI | Vue 3 Composition API |
| 数据存储 | Dexie.js (IndexedDB) |
| 图表 | Chart.js（内嵌到 HTML 报告中） |
| 导出 | xlsx, HTML 报告（自包含） |
| 直播 API | tiktok-live-connector (server 端) |

### WebSocket 消息协议

服务器→扩展的消息类型（`types/index.ts` 定义）：

| type | 说明 | 关键字段 |
|------|------|----------|
| `status` | 初始连接状态 | connected, username |
| `connected` | 直播间连接成功 | username, roomId, viewerCount |
| `disconnected` | 断开连接 | — |
| `error` | 错误 | message |
| `comment` | 评论 | id, userId, username, nickname, comment |
| `gift` | 礼物（连续礼物仅 repeatEnd 时发） | giftName, repeatCount, diamondCount |
| `like` | 点赞 | likeCount, totalLikeCount |
| `roomUser` | 观众数 + 打赏榜 Top | viewerCount, topViewers[] |
| `member` | 观众进入（不存储） | followRole |
| `follow/share/subscribe` | 用户行为 | uniqueId, nickname |
| `streamEnd` | 直播结束 | — |

扩展→服务器的动作：`{ action: 'connect', username }` / `{ action: 'disconnect' }` / `{ action: 'ping' }`

### Background 关键机制

1. **批量写入缓冲**：评论/礼物/观众数等先缓存，每 3s 或满 50 条批量写入 IndexedDB（`flushBuffers()`）
2. **事件缓冲**：session 创建前收到的事件暂存 `eventBuffer`（上限 500），session ready 后重放
3. **状态广播**：`chrome.runtime.sendMessage` → 所有 popup
4. **keepAlive**：`chrome.alarms` 每 30s 检查 WebSocket 连接状态

### IndexedDB Schema (Dexie v5)

8 张表，当前版本 5：`sessions`, `comments`（按 sessionId+msgId 去重）, `gifts`（按 sessionId+odl 去重）, `viewerCounts`, `follows`（按 sessionId+uniqueId 去重）, `shares`（同）, `subscribes`（同）, `likes`。所有表按 `sessionId` 关联。
- v5 新增：gifts/follows/shares/subscribes 去重复合索引、likes 表、comments 角色字段(followRole/isModerator/isSubscriber)
- Session 支持 status='interrupted' 和 disconnectReason 字段

### Lint & Type Check 现状

- 服务端(`tiktok-live-server/`): 无 ESLint 配置，验证以 `npm test`(vitest) 为准
- 扩展(`tiktok-live-extension/`): 无 lint script，`npm run build`(WXT/Vite) 成功即表示 TS 编译通过
- `vue-tsc` 有 2 个已有错误(ViewerChart.vue Chart.js 类型)，`tsc --noEmit` 有 1 个 .vue 模块声明错误，均为已有问题
- 扩展端所有源码在 `src/` 下：如 `src/entrypoints/background/index.ts`、`src/db/index.ts`、`src/types/index.ts`

### 导出格式

- **JSON**：原始数据（background 直接导出）
- **Excel**：`utils/excel-export.ts`，使用 xlsx 库
- **HTML 报告**：`utils/html-export/` 目录，自包含可分享（内嵌 Chart.js）

### MV3 合规要点

- 事件监听器必须在 `defineBackground()` 顶层同步注册
- 使用 `chrome.alarms` 替代 `setInterval`（Service Worker 会休眠）
- 使用 `chrome.storage` 持久化配置（wsUrl）

### 服务器安全

- 用户名验证：`/^[a-zA-Z0-9_.]{1,24}$/`
- Origin 白名单：`chrome-extension://`, `localhost`, `127.0.0.1`
- HTML 转义防 XSS
