# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TikTok 直播间分析工具 v3.0 - Chrome 扩展 + 本地 Node 服务器，实时采集 TikTok 直播间全量事件（评论、礼物、观众、电商、红包、PK、问答、表情、弹幕等），支持 IndexedDB 持久化和多格式导出（JSON/Excel/HTML）。

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
| `oecLiveShopping` | 商品推荐 | productName, productPrice, shopName |
| `envelope` | 红包 | envelopeId, senderNickname, diamondCount |
| `hourlyRank/rankUpdate/rankText` | 排名事件 | rankType, rank |
| `questionNew` | 观众提问 | questionId, content |
| `linkMicArmies` | PK 积分 | battleId, battleItems[] |
| `linkMicBattle` | PK 对战状态 | battleId, status, anchors[] |
| `emote` | 表情聊天 | emoteId |
| `barrage` | VIP 弹幕 | content, barrageType |
| `streamEnd` | 直播结束 | — |

扩展→服务器的动作：`{ action: 'connect', username }` / `{ action: 'disconnect' }` / `{ action: 'ping' }`

### Background 关键机制

1. **批量写入缓冲**：评论/礼物/观众数等先缓存，每 3s 或满 50 条批量写入 IndexedDB（`flushBuffers()`），高频事件（barrage/emote）也支持即时 flush
2. **事件缓冲**：session 创建前收到的事件暂存 `eventBuffer`（上限 500），session ready 后快照遍历重放（防竞态）
3. **状态广播**：`chrome.runtime.sendMessage` → 所有 popup，200ms 节流防高频序列化
4. **keepAlive**：`chrome.alarms` 每 30s 检查 WebSocket 连接状态
5. **likeCount 持久化**：每次 flush 时同步写入 session.totalLikes，防 SW 崩溃丢失
6. **安全**：onMessage 验证 sender.id，防跨扩展消息注入

### IndexedDB Schema (Dexie v6)

14 张表，当前版本 6：`sessions`, `comments`（按 sessionId+msgId 去重）, `gifts`（按 sessionId+odl 去重）, `viewerCounts`, `follows`（按 sessionId+uniqueId 去重）, `shares`（同）, `subscribes`（同）, `likes`, `shoppings`, `envelopes`（按 sessionId+envelopeId 去重）, `questions`（按 sessionId+questionId 去重）, `battleScores`, `emotes`, `barrages`。所有表按 `sessionId` 关联。
- v6 新增：电商/红包/问答/PK/表情/弹幕 6 张表
- v5 新增：gifts/follows/shares/subscribes 去重复合索引、likes 表、comments 角色字段
- Session 支持 status='interrupted' 和 disconnectReason 字段
- `dbHelper.getAllSessionData(sessionId)` 提供统一的全量数据查询接口
- `getSessionStats()` 使用 Promise.all 并行查询所有统计

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

- AUTH_TOKEN：服务器启动时生成随机 token，扩展通过 `GET /token` 端点自动获取后拼接到 WS URL
- 用户名验证：`/^[a-zA-Z0-9_.]{1,24}$/`
- Origin 白名单：`chrome-extension://`, `localhost`, `127.0.0.1`
- HTML 转义防 XSS
- WS 连接上限：最多 10 个客户端（防本机 DoS）
- 日志脱敏：生产日志仅打印动作类型，不打印完整消息内容
- 消息来源验证：`chrome.runtime.onMessage` 检查 `sender.id`
