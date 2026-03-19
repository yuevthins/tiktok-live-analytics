<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { dbHelper } from '../db';
import { exportToExcel } from '../utils/excel-export';
import { exportToHtml } from '../utils/html-export';
import type { Session } from '../types';

const sessions = ref<(Session & { stats?: { totalComments: number; peakViewers: number } })[]>([]);
const loading = ref(true);
const isStoppingSession = ref(false);

async function loadSessions() {
  loading.value = true;
  try {
    const allSessions = await dbHelper.getAllSessions();
    sessions.value = await Promise.all(
      allSessions.map(async (session) => {
        const stats = session.id ? await dbHelper.getSessionStats(session.id) : null;
        return {
          ...session,
          stats: stats ? { totalComments: stats.totalComments, peakViewers: stats.peakViewers } : undefined,
        };
      })
    );
  } catch (e) {
    console.error('Failed to load sessions:', e);
  }
  loading.value = false;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(session: Session): string {
  if (!session.startTime) return '--';
  const end = session.endTime ? new Date(session.endTime) : new Date();
  const start = new Date(session.startTime);
  const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}小时${m}分`;
  return `${m}分钟`;
}

async function exportSession(sessionId: number) {
  try {
    const session = await dbHelper.getSession(sessionId);
    if (!session) return;

    const comments = await dbHelper.getCommentsBySession(sessionId);
    const viewerCounts = await dbHelper.getViewerCountsBySession(sessionId);
    const gifts = await dbHelper.getGiftsBySession(sessionId);
    const follows = await dbHelper.getFollowsBySession(sessionId);
    const shares = await dbHelper.getSharesBySession(sessionId);
    const subscribes = await dbHelper.getSubscribesBySession(sessionId);
    const stats = await dbHelper.getSessionStats(sessionId);

    const endTime = session.endTime || new Date();
    const duration = Math.round((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000);

    const exportData = {
      sessionInfo: {
        username: session.username,
        roomId: session.roomId,
        startTime: new Date(session.startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
      },
      statistics: {
        ...stats,
        totalLikes: session.totalLikes || 0,
      },
      comments: comments.map(c => ({
        id: c.msgId,
        userId: c.userId,
        username: c.username,
        nickname: c.nickname,
        content: c.content,
        timestamp: new Date(c.timestamp).toISOString(),
      })),
      gifts: gifts.map(g => ({
        username: g.username,
        nickname: g.nickname,
        giftName: g.giftName,
        repeatCount: g.repeatCount,
        diamondCount: g.diamondCount,
        timestamp: new Date(g.timestamp).toISOString(),
      })),
      viewerCounts: viewerCounts.map(v => ({
        count: v.count,
        topViewers: v.topViewers,
        timestamp: new Date(v.timestamp).toISOString(),
      })),
      follows: follows.map(f => ({
        username: f.uniqueId,
        nickname: f.nickname,
        timestamp: new Date(f.timestamp).toISOString(),
      })),
      shares: shares.map(s => ({
        username: s.uniqueId,
        nickname: s.nickname,
        timestamp: new Date(s.timestamp).toISOString(),
      })),
      subscribes: subscribes.map(s => ({
        username: s.uniqueId,
        nickname: s.nickname,
        subMonth: s.subMonth,
        timestamp: new Date(s.timestamp).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `tiktok-live-${session.username}-${new Date(session.startTime).toISOString().slice(0, 10)}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed:', e);
  }
}

async function getLikeCount(sessionId: number, session: Session): Promise<number> {
  if (session.status !== 'active') {
    return session.totalLikes || 0;
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getState' }, (response) => {
      if (response?.state?.currentSessionId === sessionId && response?.state?.likeCount) {
        resolve(response.state.likeCount);
      } else {
        resolve(session.totalLikes || 0);
      }
    });
  });
}

async function exportSessionExcel(sessionId: number) {
  try {
    const session = await dbHelper.getSession(sessionId);
    if (!session) return;

    const [comments, gifts, viewerCounts, follows, shares, subscribes, stats] = await Promise.all([
      dbHelper.getCommentsBySession(sessionId),
      dbHelper.getGiftsBySession(sessionId),
      dbHelper.getViewerCountsBySession(sessionId),
      dbHelper.getFollowsBySession(sessionId),
      dbHelper.getSharesBySession(sessionId),
      dbHelper.getSubscribesBySession(sessionId),
      dbHelper.getSessionStats(sessionId),
    ]);
    const totalLikes = await getLikeCount(sessionId, session);

    const endTime = session.endTime || new Date();
    const duration = Math.round((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000);

    const filename = `tiktok-live-${session.username}-${new Date(session.startTime).toISOString().slice(0, 10)}.xlsx`;

    exportToExcel({
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
      comments,
      gifts,
      viewerCounts,
      follows,
      shares,
      subscribes,
    }, filename);
  } catch (e) {
    console.error('Excel export failed:', e);
  }
}

async function exportSessionHtml(sessionId: number) {
  try {
    await exportToHtml(sessionId);
  } catch (e) {
    console.error('HTML export failed:', e);
  }
}

async function stopSession(sessionId: number) {
  isStoppingSession.value = true;
  try {
    await chrome.runtime.sendMessage({ type: 'disconnect', sessionId });
    // 等待 background 完成断开操作
    await new Promise(resolve => setTimeout(resolve, 800));
    await loadSessions();
  } catch (e) {
    console.error('Stop session failed:', e);
  } finally {
    isStoppingSession.value = false;
  }
}

async function deleteSession(sessionId: number) {
  if (!confirm('确定删除此会话及其所有数据？')) return;
  try {
    await dbHelper.deleteSession(sessionId);
    await loadSessions();
  } catch (e) {
    console.error('Delete failed:', e);
  }
}

async function clearAll() {
  if (!confirm('确定清空所有历史数据？此操作不可恢复！')) return;
  try {
    await dbHelper.clearAll();
    await loadSessions();
  } catch (e) {
    console.error('Clear failed:', e);
  }
}

onMounted(loadSessions);
</script>

<template>
  <div class="history-container">
    <!-- Header -->
    <div class="history-header">
      <h3 class="history-title">采集历史</h3>
      <button v-if="sessions.length > 0" @click="clearAll" class="btn-clear">
        清空全部
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="state-container">
      <div class="loading-spinner"></div>
      <p class="state-text">加载中...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="sessions.length === 0" class="state-container">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18z"/>
        </svg>
      </div>
      <p class="state-text">暂无采集记录</p>
      <p class="state-hint">开始采集后，历史记录将显示在这里</p>
    </div>

    <!-- Session List -->
    <div v-else class="session-list">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="session-card"
        :class="{ 'is-active': session.status === 'active' }"
      >
        <div class="session-main">
          <div class="session-top">
            <span class="session-username">@{{ session.username }}</span>
            <span class="session-badge" :class="session.status">
              {{ session.status === 'active' ? '采集中' : session.status === 'completed' ? '已完成' : '错误' }}
            </span>
          </div>
          <div class="session-meta">
            <span>{{ formatDate(session.startTime) }}</span>
            <span class="meta-dot">·</span>
            <span>{{ formatDuration(session) }}</span>
          </div>
          <div class="session-stats" v-if="session.stats">
            <span class="stat">
              <svg class="stat-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
              </svg>
              {{ session.stats.totalComments }}
            </span>
            <span class="stat">
              <svg class="stat-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              {{ session.stats.peakViewers }}
            </span>
          </div>
        </div>
        <div class="session-actions">
          <button @click="exportSessionHtml(session.id!)" class="action-btn action-html" title="导出报告">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
          </button>
          <button @click="exportSessionExcel(session.id!)" class="action-btn action-excel" title="导出 Excel">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
          </button>
          <button @click="exportSession(session.id!)" class="action-btn" title="导出 JSON">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </button>
          <button
            v-if="session.status === 'active'"
            @click="stopSession(session.id!)"
            class="action-btn action-stop"
            :disabled="isStoppingSession"
            title="停止采集"
          >
            <template v-if="isStoppingSession">
              <div class="btn-spinner"></div>
            </template>
            <template v-else>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h12v12H6z"/>
              </svg>
            </template>
          </button>
          <button
            v-if="session.status !== 'active'"
            @click="deleteSession(session.id!)"
            class="action-btn action-delete"
            title="删除"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========== Stripe Design Tokens ========== */
.history-container {
  --stripe-bg: #f6f9fc;
  --stripe-surface: #ffffff;
  --stripe-border: #e3e8ee;
  --stripe-primary: #635bff;
  --stripe-text: #0a2540;
  --stripe-text-secondary: #425466;
  --stripe-text-muted: #8898aa;
  --stripe-success: #0e6245;
  --stripe-success-bg: #d4edda;
  --stripe-error: #cd3d64;
  --stripe-error-bg: #ffe0e6;
  --stripe-shadow: 0 1px 3px rgba(0,0,0,0.08);

  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Header */
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--stripe-border);
  margin-bottom: 12px;
}

.history-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--stripe-text);
  margin: 0;
}

.btn-clear {
  padding: 6px 12px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--stripe-text-secondary);
  background: none;
  border: 1px solid var(--stripe-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-clear:hover {
  color: var(--stripe-error);
  border-color: var(--stripe-error);
  background: var(--stripe-error-bg);
}

/* State Container */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--stripe-border);
  border-top-color: var(--stripe-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--stripe-text-muted);
  margin-bottom: 12px;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.state-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--stripe-text-secondary);
  margin: 0;
}

.state-hint {
  font-size: 12px;
  color: var(--stripe-text-muted);
  margin-top: 4px;
}

/* Session List */
.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 300px;
}

.session-list::-webkit-scrollbar {
  width: 6px;
}

.session-list::-webkit-scrollbar-track {
  background: transparent;
}

.session-list::-webkit-scrollbar-thumb {
  background: var(--stripe-border);
  border-radius: 3px;
}

.session-list::-webkit-scrollbar-thumb:hover {
  background: var(--stripe-text-muted);
}

/* Session Card */
.session-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--stripe-surface);
  border: 1px solid var(--stripe-border);
  border-radius: 8px;
  box-shadow: var(--stripe-shadow);
  transition: all 0.2s ease;
}

.session-card:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.08);
}

.session-card.is-active {
  border-color: var(--stripe-success);
  background: linear-gradient(135deg, rgba(14, 98, 69, 0.05) 0%, transparent 100%);
}

.session-main {
  flex: 1;
  min-width: 0;
}

.session-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.session-username {
  font-size: 14px;
  font-weight: 600;
  color: var(--stripe-text);
}

.session-badge {
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.session-badge.active {
  background: var(--stripe-success-bg);
  color: var(--stripe-success);
}

.session-badge.completed {
  background: var(--stripe-bg);
  color: var(--stripe-text-secondary);
}

.session-badge.error {
  background: var(--stripe-error-bg);
  color: var(--stripe-error);
}

.session-meta {
  font-size: 12px;
  color: var(--stripe-text-secondary);
  margin-bottom: 6px;
}

.meta-dot {
  margin: 0 4px;
}

.session-stats {
  display: flex;
  gap: 12px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--stripe-text-secondary);
}

.stat-icon {
  width: 14px;
  height: 14px;
  color: var(--stripe-text-muted);
}

/* Session Actions */
.session-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--stripe-bg);
  border: none;
  border-radius: 6px;
  color: var(--stripe-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover {
  background: var(--stripe-border);
  color: var(--stripe-text);
}

.action-html:hover {
  background: #f0efff;
  color: var(--stripe-primary);
}

.action-excel:hover {
  background: var(--stripe-success-bg);
  color: var(--stripe-success);
}

.action-stop {
  background: var(--stripe-error-bg);
  color: var(--stripe-error);
}

.action-stop:hover {
  background: var(--stripe-error);
  color: white;
}

.action-delete:hover {
  background: var(--stripe-error-bg);
  color: var(--stripe-error);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--stripe-error-bg);
  border-top-color: var(--stripe-error);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
