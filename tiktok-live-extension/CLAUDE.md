# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

```bash
npm install          # 安装依赖
npm run dev          # 开发模式（热重载）
npm run build        # 生产构建 → dist/chrome-mv3
npm run zip          # 打包为 .zip
```

构建输出目录为 `dist/chrome-mv3`（WXT 默认是 `.output`，已通过配置修改，因为隐藏目录在 Chrome 文件选择器中不可见）。

## 使用前准备

扩展依赖本地 WebSocket 服务器：

```bash
cd ../tiktok-live-server
node server.js       # 启动在 ws://127.0.0.1:3456
```

服务器启动后会打印 `AUTH_TOKEN`，扩展需在 WS URL 中携带 `?token=xxx` 参数连接。

## 架构概览

### 数据流

```
TikTok Live API → Node 服务器(tiktok-live-connector) → WebSocket → Chrome 扩展
                                                                         ↓
                                                          IndexedDB (Dexie.js)
                                                                         ↓
                                                          Popup UI (Vue 3)
```

### 核心模块

| 文件 | 职责 |
|------|------|
| `entrypoints/background/index.ts` | Service Worker - WebSocket 连接管理、消息路由、批量数据写入、200ms 广播节流 |
| `entrypoints/popup/App.vue` | 主 UI - 连接控制、实时数据展示、导出按钮（采集 Tab） |
| `components/TabMonetize.vue` | 变现 Tab - 礼物/红包/商品推荐/PK 对战展示 |
| `components/TabInteract.vue` | 互动 Tab - 问答/表情/VIP 弹幕展示 |
| `components/TabHistory.vue` | 历史 Tab - 历史会话列表、多格式导出 |
| `components/ViewerChart.vue` | 观众趋势图 - 增量更新（data 变化不 destroy） |
| `db/index.ts` | Dexie.js v6 数据库封装 - 14 张表 CRUD + `getAllSessionData()` |
| `types/index.ts` | WebSocket 消息类型（20+）、数据库模型定义 |
| `utils/format.ts` | 共享工具函数 - formatNumber, getInitial, formatTime |
| `utils/excel-export.ts` | Excel 导出 - 13 个 Sheet 含全部事件类型 |

### Background 关键机制

1. **批量写入缓冲区**：评论/礼物等数据先缓存，每 3 秒或缓冲区满 50 条时批量写入 IndexedDB（高频事件如 barrage/emote 也有即时 flush）
2. **事件缓冲**：session 创建前收到的事件暂存到 `eventBuffer`，session ready 后快照遍历重放（防并发竞态）
3. **状态广播**：通过 `chrome.runtime.sendMessage` 广播状态给所有 popup，200ms 节流防高频序列化
4. **keepAlive**：使用 `chrome.alarms` 每 30 秒检查 WebSocket 连接，防止 Service Worker 休眠
5. **likeCount 持久化**：每次 flush 时写入 session.totalLikes，防 SW 崩溃丢数据
6. **安全**：onMessage 验证 sender.id = chrome.runtime.id

### 导出功能

三种导出格式已实现：
- **JSON**：原始数据导出
- **Excel**：使用 xlsx 库，`utils/excel-export.ts`
- **HTML 报告**：独立可分享的报告，`utils/html-export/` 目录（内嵌 Chart.js）

### MV3 注意事项

- 事件监听器必须在 `defineBackground()` 顶层同步注册
- 使用 `chrome.alarms` 替代 `setInterval`
- 使用 `chrome.storage` 持久化配置

## 技术栈

- **WXT**: Chrome Extension Framework (MV3)
- **Vue 3**: Popup UI (Composition API)
- **Dexie.js**: IndexedDB 封装
- **Chart.js**: 观众趋势图
- **xlsx**: Excel 导出
