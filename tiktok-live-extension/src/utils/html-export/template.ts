/**
 * HTML 报告模板生成器 - Bloomberg Terminal 风格
 */

import { CSS_STYLES } from './styles';
import { generateChartScript, type ViewerDataPoint } from './chart-config';
import type { Comment, Gift, Follow, Share, Subscribe } from '../../types';
import type { WordCount } from '../word-stats';

export interface HtmlExportData {
  sessionInfo: {
    username: string;
    roomId: string;
    startTime: string;
    endTime: string;
    duration: number;
  };
  statistics: {
    totalComments: number;
    totalGifts: number;
    totalDiamonds: number;
    totalLikes: number;
    totalFollows: number;
    totalShares: number;
    totalSubscribes: number;
    peakViewers: number;
    avgViewers: number;
  };
  comments: Comment[];
  gifts: Gift[];
  follows: Follow[];
  shares: Share[];
  subscribes: Subscribe[];
  viewerCounts: ViewerDataPoint[];
  hotWords: WordCount[];
  chartjsCode: string;
}

/**
 * 格式化数字（带千分位）
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * 格式化时长为 HH:MM:SS
 */
function formatDurationHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * 格式化时长为文字描述
 */
function formatDurationText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * 格式化时间 HH:MM:SS
 */
function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 格式化日期 YYYY-MM-DD
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

/**
 * 格式化完整日期时间
 */
function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * 计算评论率
 */
function calcRate(total: number, seconds: number): string {
  if (seconds <= 0) return '0';
  const rate = total / (seconds / 60);
  return rate.toFixed(1);
}

/**
 * 计算观众留存率
 */
function calcRetention(avg: number, peak: number): string {
  if (peak <= 0) return '0';
  return ((avg / peak) * 100).toFixed(1);
}

/**
 * 生成统计网格 HTML
 */
function generateStatsGrid(stats: HtmlExportData['statistics'], duration: number): string {
  const commentRate = calcRate(stats.totalComments, duration);
  const likeRate = calcRate(stats.totalLikes, duration);
  const retention = calcRetention(stats.avgViewers, stats.peakViewers);

  return `
    <div class="stats-grid">
      <div class="stat-cell highlight">
        <div class="stat-label">
          <span class="stat-label-icon">◈</span>
          COMMENTS
        </div>
        <div class="stat-value accent">${formatNumber(stats.totalComments)}</div>
        <div class="stat-sub">${commentRate}/min avg rate</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">
          <span class="stat-label-icon">◇</span>
          GIFTS
        </div>
        <div class="stat-value">${formatNumber(stats.totalGifts)}</div>
        <div class="stat-sub">${stats.totalGifts > 0 ? `${formatNumber(stats.totalDiamonds)} diamonds` : 'No gifts received'}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">
          <span class="stat-label-icon">◆</span>
          DIAMONDS
        </div>
        <div class="stat-value">${formatNumber(stats.totalDiamonds)}</div>
        <div class="stat-sub">$${(stats.totalDiamonds * 0.005).toFixed(2)} equivalent</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">
          <span class="stat-label-icon">♥</span>
          LIKES
        </div>
        <div class="stat-value">${formatNumber(stats.totalLikes)}</div>
        <div class="stat-sub">${likeRate}/min avg rate</div>
      </div>
      <div class="stat-cell success">
        <div class="stat-label">
          <span class="stat-label-icon">▲</span>
          PEAK VIEWERS
        </div>
        <div class="stat-value green">${formatNumber(stats.peakViewers)}</div>
        <div class="stat-sub">
          <span class="stat-change up">↑ PEAK</span>
        </div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">
          <span class="stat-label-icon">≡</span>
          AVG VIEWERS
        </div>
        <div class="stat-value">${formatNumber(stats.avgViewers)}</div>
        <div class="stat-sub">${retention}% retention</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">
          <span class="stat-label-icon">+</span>
          FOLLOWS
        </div>
        <div class="stat-value">${formatNumber(stats.totalFollows)}</div>
        <div class="stat-sub">New followers</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">
          <span class="stat-label-icon">⇗</span>
          SHARES
        </div>
        <div class="stat-value">${formatNumber(stats.totalShares)}</div>
        <div class="stat-sub">Stream shares</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">
          <span class="stat-label-icon">★</span>
          SUBSCRIBES
        </div>
        <div class="stat-value">${formatNumber(stats.totalSubscribes)}</div>
        <div class="stat-sub">Paid subscribers</div>
      </div>
    </div>`;
}

/**
 * 生成热词云 HTML
 */
function generateWordCloud(hotWords: WordCount[]): string {
  if (hotWords.length === 0) {
    return `
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <span class="panel-title-icon">◈</span>
              HOT KEYWORDS
            </div>
            <div class="panel-badge">0 WORDS</div>
          </div>
          <div class="panel-content">
            <div class="empty-state">
              <div class="empty-icon">◈</div>
              <div class="empty-text">No keywords data</div>
            </div>
          </div>
        </div>`;
  }

  const maxCount = hotWords[0]?.count || 1;
  const wordTags = hotWords.map((word) => {
    const ratio = word.count / maxCount;
    let sizeClass = '';
    if (ratio > 0.8) sizeClass = 'size-1';
    else if (ratio > 0.5) sizeClass = 'size-2';
    else if (ratio > 0.3) sizeClass = 'size-3';

    return `<span class="word-tag ${sizeClass}">${escapeHtml(word.word)}<span class="tag-count">${word.count}</span></span>`;
  }).join('\n              ');

  return `
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <span class="panel-title-icon">◈</span>
              HOT KEYWORDS
            </div>
            <div class="panel-badge">${hotWords.length} WORDS</div>
          </div>
          <div class="panel-content">
            <div class="word-cloud">
              ${wordTags}
            </div>
          </div>
        </div>`;
}

/**
 * 生成用户排行榜 HTML
 */
function generateLeaderboard(comments: Comment[]): string {
  // 统计每个用户的评论数
  const userCounts = new Map<string, { nickname: string; count: number }>();
  comments.forEach(c => {
    const key = c.userId || c.username;
    const existing = userCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      userCounts.set(key, { nickname: c.nickname || c.username, count: 1 });
    }
  });

  // 排序取前 10
  const topUsers = Array.from(userCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (topUsers.length === 0) {
    return `
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <span class="panel-title-icon">▲</span>
              TOP COMMENTERS
            </div>
            <div class="panel-badge">0 USERS</div>
          </div>
          <div class="panel-content">
            <div class="empty-state">
              <div class="empty-icon">▲</div>
              <div class="empty-text">No user data</div>
            </div>
          </div>
        </div>`;
  }

  const leaderboardItems = topUsers.map((user, index) => {
    let rankClass = '';
    if (index === 0) rankClass = 'gold';
    else if (index === 1) rankClass = 'silver';
    else if (index === 2) rankClass = 'bronze';

    return `
              <div class="leaderboard-item">
                <div class="rank ${rankClass}">${index + 1}</div>
                <span class="lb-user">${escapeHtml(user.nickname)}</span>
                <span class="lb-value">${user.count}</span>
              </div>`;
  }).join('');

  return `
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <span class="panel-title-icon">▲</span>
              TOP COMMENTERS
            </div>
            <div class="panel-badge">${userCounts.size} USERS</div>
          </div>
          <div class="panel-content">
            <div class="leaderboard">
              ${leaderboardItems}
            </div>
          </div>
        </div>`;
}

/**
 * 生成评论表格 HTML
 */
function generateCommentsTable(comments: Comment[]): string {
  if (comments.length === 0) {
    return `
          <div class="empty-state">
            <div class="empty-icon">◈</div>
            <div class="empty-text">No comments in this session</div>
          </div>`;
  }

  // 计算每个用户的排名
  const userCounts = new Map<string, number>();
  comments.forEach(c => {
    const key = c.userId || c.username;
    userCounts.set(key, (userCounts.get(key) || 0) + 1);
  });

  const sortedUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1]);

  const userRanks = new Map<string, number>();
  sortedUsers.forEach(([userId], index) => {
    userRanks.set(userId, index + 1);
  });

  const rows = comments.map(c => {
    const userId = c.userId || c.username;
    const rank = userRanks.get(userId) || 999;
    let avatarClass = '';
    let avatarContent = (c.nickname || c.username).charAt(0).toUpperCase();

    if (rank === 1) {
      avatarClass = 'gold';
      avatarContent = '1';
    } else if (rank === 2) {
      avatarClass = 'silver';
      avatarContent = '2';
    } else if (rank === 3) {
      avatarClass = 'bronze';
      avatarContent = '3';
    }

    return `
                <tr>
                  <td class="col-time">${formatTime(c.timestamp)}</td>
                  <td>
                    <div class="col-user">
                      <div class="user-avatar ${avatarClass}">${avatarContent}</div>
                      <span class="user-name">${escapeHtml(c.nickname || c.username)}</span>
                    </div>
                  </td>
                  <td class="col-content"><span class="content-text">${escapeHtml(c.content)}</span></td>
                </tr>`;
  }).join('');

  return `
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:90px">TIME</th>
                  <th style="width:180px">USER</th>
                  <th>CONTENT</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>`;
}

/**
 * 生成礼物表格 HTML
 */
function generateGiftsTable(gifts: Gift[]): string {
  if (gifts.length === 0) {
    return `
          <div class="empty-state">
            <div class="empty-icon">◇</div>
            <div class="empty-text">No gifts received in this session</div>
          </div>`;
  }

  const rows = gifts.map(g => {
    const totalDiamonds = g.diamondCount * g.repeatCount;
    return `
                <tr>
                  <td class="col-time">${formatTime(g.timestamp)}</td>
                  <td>
                    <div class="col-user">
                      <div class="user-avatar">${(g.nickname || g.username).charAt(0).toUpperCase()}</div>
                      <span class="user-name">${escapeHtml(g.nickname || g.username)}</span>
                    </div>
                  </td>
                  <td><span class="col-gift">🎁 ${escapeHtml(g.giftName)}</span></td>
                  <td class="col-count">${g.repeatCount}</td>
                  <td class="col-diamond">💎 ${formatNumber(totalDiamonds)}</td>
                </tr>`;
  }).join('');

  return `
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:90px">TIME</th>
                  <th style="width:180px">USER</th>
                  <th style="width:140px">GIFT</th>
                  <th style="width:70px">QTY</th>
                  <th style="width:100px">VALUE</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>`;
}

/**
 * 生成转化事件表格 HTML（follows + shares + subscribes）
 */
function generateEventsTable(follows: Follow[], shares: Share[], subscribes: Subscribe[]): string {
  type EventRow = { time: string; sortKey: number; type: string; user: string; nickname: string; detail: string };
  const events: EventRow[] = [];

  follows.forEach(f => events.push({
    time: formatTime(f.timestamp),
    sortKey: new Date(f.timestamp).getTime(),
    type: 'FOLLOW',
    user: f.uniqueId,
    nickname: f.nickname,
    detail: '',
  }));
  shares.forEach(s => events.push({
    time: formatTime(s.timestamp),
    sortKey: new Date(s.timestamp).getTime(),
    type: 'SHARE',
    user: s.uniqueId,
    nickname: s.nickname,
    detail: '',
  }));
  subscribes.forEach(s => events.push({
    time: formatTime(s.timestamp),
    sortKey: new Date(s.timestamp).getTime(),
    type: 'SUBSCRIBE',
    user: s.uniqueId,
    nickname: s.nickname,
    detail: `${s.subMonth} months`,
  }));

  if (events.length === 0) {
    return `
          <div class="empty-state">
            <div class="empty-icon">+</div>
            <div class="empty-text">No conversion events in this session</div>
          </div>`;
  }

  // 按时间排序
  events.sort((a, b) => a.sortKey - b.sortKey);
  const rows = events.map(e => `
                <tr>
                  <td class="col-time">${e.time}</td>
                  <td><span class="col-gift">${e.type}</span></td>
                  <td>
                    <div class="col-user">
                      <div class="user-avatar">${(e.nickname || e.user).charAt(0).toUpperCase()}</div>
                      <span class="user-name">${escapeHtml(e.nickname || e.user)}</span>
                    </div>
                  </td>
                  <td>${e.detail ? escapeHtml(e.detail) : ''}</td>
                </tr>`).join('');

  return `
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:90px">TIME</th>
                  <th style="width:100px">TYPE</th>
                  <th style="width:180px">USER</th>
                  <th>DETAIL</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>`;
}

/**
 * 生成完整的 HTML 报告
 */
export function generateHtmlReport(data: HtmlExportData): string {
  const chartScript = data.viewerCounts.length > 0
    ? generateChartScript(data.viewerCounts)
    : '';

  const chartSection = data.viewerCounts.length > 0
    ? `
      <!-- 观众趋势图 -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <span class="panel-title-icon">📊</span>
            VIEWER TREND
          </div>
          <div class="panel-badge">${data.viewerCounts.length} DATA POINTS</div>
        </div>
        <div class="panel-content">
          <div class="chart-container">
            <canvas id="viewerChart"></canvas>
          </div>
        </div>
      </div>`
    : '';

  const sessionId = `${data.sessionInfo.username}-${formatDate(data.sessionInfo.startTime).replace(/-/g, '')}-${formatTime(data.sessionInfo.startTime).replace(/:/g, '')}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TIKTOK LIVE | @${escapeHtml(data.sessionInfo.username)} | ${formatDate(data.sessionInfo.startTime)}</title>
  <style>${CSS_STYLES}</style>
</head>
<body>

  <!-- 顶部状态栏 -->
  <div class="status-bar">
    <div class="status-left">
      <div class="status-brand">
        <div class="status-brand-icon">TK</div>
        <span>TIKTOK ANALYTICS</span>
      </div>
      <span class="status-item">SESSION: <span>${escapeHtml(data.sessionInfo.username)}-${formatDate(data.sessionInfo.startTime).replace(/-/g, '')}</span></span>
      <span class="status-item">DURATION: <span>${formatDurationHMS(data.sessionInfo.duration)}</span></span>
    </div>
    <div class="status-right">
      <div class="status-indicator">
        <div class="status-dot"></div>
        <span>Session Complete</span>
      </div>
      <span class="status-time">${formatDateTime(data.sessionInfo.endTime)}</span>
    </div>
  </div>

  <div class="container">

    <!-- 报告头部 -->
    <header class="report-header">
      <div class="header-main">
        <div class="header-logo">TK</div>
        <div class="header-info">
          <h1>TIKTOK LIVE SESSION REPORT</h1>
          <div class="header-meta">
            <span class="username">@${escapeHtml(data.sessionInfo.username)}</span>
            <span class="separator">|</span>
            <span class="date">${formatDateTime(data.sessionInfo.startTime)} → ${formatTime(data.sessionInfo.endTime)}</span>
            <span class="separator">|</span>
            <span class="date">Duration: ${formatDurationText(data.sessionInfo.duration)}</span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn" onclick="window.print()">
          ⬇ EXPORT
        </button>
        <button class="btn btn-primary" onclick="toggleTheme()">
          ◐ THEME
        </button>
      </div>
    </header>

    <!-- 统计网格 -->
    ${generateStatsGrid(data.statistics, data.sessionInfo.duration)}

    <!-- 观众趋势图 -->
    ${chartSection}

    <!-- 两栏布局 -->
    <div class="two-column">

      <!-- 左侧：评论/礼物列表 -->
      <div class="panel">
        <div class="tabs">
          <button class="tab-btn active" onclick="switchTab('comments')">
            ◈ COMMENTS<span class="tab-count">${data.comments.length}</span>
          </button>
          <button class="tab-btn" onclick="switchTab('gifts')">
            ◇ GIFTS<span class="tab-count">${data.gifts.length}</span>
          </button>
          <button class="tab-btn" onclick="switchTab('events')">
            + EVENTS<span class="tab-count">${data.follows.length + data.shares.length + data.subscribes.length}</span>
          </button>
        </div>

        <div id="tab-comments" class="tab-content active">
          ${generateCommentsTable(data.comments)}
        </div>

        <div id="tab-gifts" class="tab-content">
          ${generateGiftsTable(data.gifts)}
        </div>

        <div id="tab-events" class="tab-content">
          ${generateEventsTable(data.follows, data.shares, data.subscribes)}
        </div>
      </div>

      <!-- 右侧：排行榜和热词 -->
      <div>
        <!-- 用户排行榜 -->
        ${generateLeaderboard(data.comments)}

        <!-- 热词云 -->
        ${generateWordCloud(data.hotWords)}
      </div>
    </div>

    <!-- 页脚 -->
    <footer class="footer">
      <div>GENERATED BY <a href="#">TIKTOK LIVE ANALYTICS</a> | SESSION ID: ${sessionId}</div>
      <div>EXPORT TIME: ${new Date().toLocaleString('zh-CN')} UTC+8</div>
    </footer>

  </div>

  <!-- Chart.js -->
  <script>${data.chartjsCode}</script>

  <!-- 图表初始化 -->
  ${chartScript}

  <!-- 交互脚本 -->
  <script>
    // 标签页切换
    function switchTab(tabName) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

      document.querySelector('[onclick="switchTab(\\'' + tabName + '\\')"]').classList.add('active');
      document.getElementById('tab-' + tabName).classList.add('active');
    }

    // 主题切换
    function toggleTheme() {
      const html = document.documentElement;
      const isDark = !html.hasAttribute('data-theme') || html.getAttribute('data-theme') !== 'light';

      if (isDark) {
        html.setAttribute('data-theme', 'light');
      } else {
        html.removeAttribute('data-theme');
      }

      localStorage.setItem('theme', isDark ? 'light' : 'dark');
    }

    // 初始化主题
    (function() {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  </script>

</body>
</html>`;
}
