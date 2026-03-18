/**
 * HTML 报告样式 - Bloomberg Terminal 风格
 * 深色终端风格、数据密度高、专业金融感
 */

export const CSS_STYLES = `
/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* CSS 变量 - Bloomberg 风格 */
:root {
  --bg: #0d0d0d;
  --bg-elevated: #1a1a1a;
  --bg-panel: #141414;
  --accent: #ff9500;
  --accent-dim: rgba(255, 149, 0, 0.15);
  --accent-glow: rgba(255, 149, 0, 0.3);
  --text: #e5e5e5;
  --text-secondary: #a0a0a0;
  --text-dim: #666;
  --border: #2a2a2a;
  --border-light: #333;
  --green: #00d26a;
  --green-dim: rgba(0, 210, 106, 0.15);
  --red: #ff3b30;
  --red-dim: rgba(255, 59, 48, 0.15);
  --blue: #007aff;
  --blue-dim: rgba(0, 122, 255, 0.15);
  --purple: #bf5af2;
}

/* 亮色主题 */
[data-theme="light"] {
  --bg: #f5f5f7;
  --bg-elevated: #ffffff;
  --bg-panel: #ffffff;
  --accent: #ff9500;
  --accent-dim: rgba(255, 149, 0, 0.1);
  --text: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-dim: #86868b;
  --border: #d2d2d7;
  --border-light: #e5e5ea;
  --green: #00a855;
  --green-dim: rgba(0, 168, 85, 0.1);
  --red: #ff3b30;
  --red-dim: rgba(255, 59, 48, 0.1);
}

/* 基础重置 */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  min-height: 100vh;
}

/* ========== 顶部状态栏 ========== */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 24px;
  background: #000;
  border-bottom: 1px solid var(--border);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.status-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  font-weight: 700;
  letter-spacing: 0.05em;
}

.status-brand-icon {
  width: 20px;
  height: 20px;
  background: var(--accent);
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.status-item {
  color: var(--text-dim);
}

.status-item span {
  color: var(--text-secondary);
}

.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--green-dim);
  border: 1px solid var(--green);
  color: var(--green);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.status-dot {
  width: 6px;
  height: 6px;
  background: var(--green);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--green); }
  50% { opacity: 0.5; box-shadow: none; }
}

.status-time {
  color: var(--text-secondary);
}

/* ========== 主容器 ========== */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

/* ========== 报告头部 ========== */
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-logo {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--accent) 0%, #ff6b00 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 16px;
  color: #000;
}

.header-info h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.01em;
  margin-bottom: 4px;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.header-meta .username {
  color: var(--accent);
  font-weight: 500;
}

.header-meta .separator {
  color: var(--border);
}

.header-meta .date {
  color: var(--text-dim);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:hover {
  background: var(--border);
  color: var(--text);
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
}

.btn-primary:hover {
  background: #ffaa33;
  border-color: #ffaa33;
}

/* ========== 统计网格 ========== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
  background: var(--border);
  border: 1px solid var(--border);
  margin-bottom: 24px;
}

.stat-cell {
  background: var(--bg-panel);
  padding: 20px;
  position: relative;
}

.stat-cell::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: transparent;
}

.stat-cell.highlight::after {
  background: var(--accent);
}

.stat-cell.success::after {
  background: var(--green);
}

.stat-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-label-icon {
  font-size: 12px;
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.02em;
  line-height: 1;
}

.stat-value.accent {
  color: var(--accent);
}

.stat-value.green {
  color: var(--green);
}

.stat-sub {
  margin-top: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-dim);
}

.stat-change {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
}

.stat-change.up {
  background: var(--green-dim);
  color: var(--green);
}

.stat-change.down {
  background: var(--red-dim);
  color: var(--red);
}

/* ========== 面板通用样式 ========== */
.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  margin-bottom: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 149, 0, 0.05);
  border-bottom: 1px solid var(--border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.panel-title-icon {
  font-size: 14px;
}

.panel-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel-content {
  padding: 0;
}

/* ========== 两栏布局 ========== */
.two-column {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

/* ========== 数据表格 ========== */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead {
  background: rgba(0, 0, 0, 0.4);
}

.data-table th {
  padding: 10px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.data-table td {
  padding: 12px 16px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-light);
  transition: background 0.1s ease;
}

.data-table tbody tr:hover {
  background: rgba(255, 149, 0, 0.05);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.col-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
}

.col-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 28px;
  height: 28px;
  background: var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
}

.user-avatar.gold {
  background: linear-gradient(135deg, #ffd700 0%, #ff9500 100%);
  color: #000;
}

.user-avatar.silver {
  background: linear-gradient(135deg, #c0c0c0 0%, #808080 100%);
  color: #000;
}

.user-avatar.bronze {
  background: linear-gradient(135deg, #cd7f32 0%, #8b4513 100%);
  color: #fff;
}

.user-name {
  color: var(--text);
  font-weight: 500;
}

.col-content {
  color: var(--text-secondary);
  max-width: 400px;
}

.content-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-count {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  color: var(--text);
}

.col-count.highlight {
  color: var(--accent);
}

.col-gift {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #ff9500 0%, #ff6b00 100%);
  color: #000;
  font-weight: 600;
  font-size: 11px;
}

.col-diamond {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  color: var(--accent);
}

/* ========== 标签/徽章 ========== */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-hot {
  background: var(--red-dim);
  color: var(--red);
  border: 1px solid var(--red);
}

.badge-active {
  background: var(--green-dim);
  color: var(--green);
  border: 1px solid var(--green);
}

/* ========== 热词云 ========== */
.word-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px;
}

.word-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  cursor: default;
}

.word-tag:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
}

.word-tag .tag-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  background: rgba(0, 0, 0, 0.2);
}

.word-tag:hover .tag-count {
  background: rgba(0, 0, 0, 0.3);
}

.word-tag.size-1 {
  font-size: 16px;
  font-weight: 600;
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}

.word-tag.size-2 {
  font-size: 14px;
  font-weight: 500;
  background: var(--green-dim);
  border-color: var(--green);
  color: var(--green);
}

.word-tag.size-3 {
  font-size: 13px;
  background: var(--blue-dim);
  border-color: var(--blue);
  color: var(--blue);
}

/* ========== 排行榜 ========== */
.leaderboard {
  padding: 8px 0;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  transition: background 0.1s ease;
}

.leaderboard-item:hover {
  background: rgba(255, 149, 0, 0.05);
}

.leaderboard-item:last-child {
  border-bottom: none;
}

.rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  background: var(--border);
  color: var(--text-dim);
}

.rank.gold {
  background: linear-gradient(135deg, #ffd700 0%, #ff9500 100%);
  color: #000;
}

.rank.silver {
  background: linear-gradient(135deg, #e8e8e8 0%, #a0a0a0 100%);
  color: #000;
}

.rank.bronze {
  background: linear-gradient(135deg, #cd7f32 0%, #8b4513 100%);
  color: #fff;
}

.lb-user {
  flex: 1;
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

/* ========== 标签页 ========== */
.tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  padding: 12px 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.02);
}

.tab-btn.active {
  color: var(--accent);
  background: rgba(255, 149, 0, 0.05);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
}

.tab-count {
  margin-left: 6px;
  padding: 2px 6px;
  background: var(--border);
  font-size: 10px;
}

.tab-btn.active .tab-count {
  background: var(--accent);
  color: #000;
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

/* ========== 表格滚动 ========== */
.table-scroll {
  max-height: 400px;
  overflow-y: auto;
}

.table-scroll::-webkit-scrollbar {
  width: 8px;
}

.table-scroll::-webkit-scrollbar-track {
  background: var(--bg);
}

.table-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
}

.table-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--text-dim);
}

/* ========== 图表区域 ========== */
.chart-container {
  position: relative;
  height: 280px;
  width: 100%;
  padding: 16px;
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.3;
}

.empty-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ========== 页脚 ========== */
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  margin-top: 8px;
  border-top: 1px solid var(--border);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-dim);
}

.footer a {
  color: var(--accent);
  text-decoration: none;
}

.footer a:hover {
  text-decoration: underline;
}

/* ========== 响应式 ========== */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .two-column {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .status-bar {
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
  }
  .container {
    padding: 16px;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .stat-value {
    font-size: 24px;
  }
  .report-header {
    flex-direction: column;
    gap: 16px;
  }
}

/* ========== 打印样式 ========== */
@media print {
  body {
    background: #fff;
    color: #000;
  }
  .status-bar,
  .header-actions {
    display: none;
  }
  .panel {
    border: 1px solid #ccc;
    background: #fff;
  }
  .panel-header {
    background: #f5f5f5;
  }
  .stat-cell {
    background: #f9f9f9;
  }
}
`;
