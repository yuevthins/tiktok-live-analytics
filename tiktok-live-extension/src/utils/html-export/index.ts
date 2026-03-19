/**
 * HTML 报告导出模块入口
 */

import { dbHelper } from '../../db';
import { generateHtmlReport, type HtmlExportData } from './template';
import { getWordFrequency } from '../word-stats';
import { CHARTJS_INLINE } from './chartjs-inline';
import type { Comment, Gift } from '../../types';

// CDN 降级方案
const CHARTJS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';

/**
 * 获取 Chart.js 代码
 */
function getChartjsCode(): string {
  if (CHARTJS_INLINE && CHARTJS_INLINE.length > 0) {
    return CHARTJS_INLINE;
  }

  return `
    (function() {
      var script = document.createElement('script');
      script.src = '${CHARTJS_CDN}';
      script.onload = function() {
        document.dispatchEvent(new Event('chartjs-loaded'));
      };
      document.head.appendChild(script);
    })();
  `;
}

/**
 * 从 background 获取活跃会话的点赞数
 */
async function getLikeCountFromBackground(sessionId: number): Promise<number> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getState' }, (response) => {
      if (response?.state?.currentSessionId === sessionId && response?.state?.likeCount) {
        resolve(response.state.likeCount);
      } else {
        resolve(0);
      }
    });
  });
}

/**
 * 导出会话为 HTML 报告
 */
export async function exportToHtml(sessionId: number): Promise<void> {
  const session = await dbHelper.getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // 并行获取所有数据
  const [comments, gifts, viewerCounts, follows, shares, subscribes, stats] = await Promise.all([
    dbHelper.getCommentsBySession(sessionId),
    dbHelper.getGiftsBySession(sessionId),
    dbHelper.getViewerCountsBySession(sessionId),
    dbHelper.getFollowsBySession(sessionId),
    dbHelper.getSharesBySession(sessionId),
    dbHelper.getSubscribesBySession(sessionId),
    dbHelper.getSessionStats(sessionId),
  ]);

  // 获取点赞数：活跃会话从 background 获取，已结束会话从 session 获取
  let totalLikes = session.totalLikes || 0;
  if (session.status === 'active') {
    const liveLikes = await getLikeCountFromBackground(sessionId);
    if (liveLikes > 0) {
      totalLikes = liveLikes;
    }
  }

  // 计算热词
  const commentTexts = comments.map(c => c.content);
  const hotWords = getWordFrequency(commentTexts, 20);

  // 计算时长
  const endTime = session.endTime || new Date();
  const duration = Math.round(
    (new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000
  );

  // 准备导出数据
  const exportData: HtmlExportData = {
    sessionInfo: {
      username: session.username,
      roomId: session.roomId,
      startTime: new Date(session.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration,
    },
    statistics: {
      ...stats,
      totalLikes,
    },
    comments: comments as Comment[],
    gifts: gifts as Gift[],
    follows,
    shares,
    subscribes,
    viewerCounts: viewerCounts.map(v => ({
      timestamp: new Date(v.timestamp).toISOString(),
      count: v.count,
    })),
    hotWords,
    chartjsCode: getChartjsCode(),
  };

  // 生成 HTML
  const html = generateHtmlReport(exportData);

  // 创建下载
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const filename = `tiktok-live-${session.username}-${new Date(session.startTime).toISOString().slice(0, 10)}.html`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
