<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import TabHistory from '../../components/TabHistory.vue';
import ViewerChart from '../../components/ViewerChart.vue';
import { getWordFrequency, type WordCount } from '../../utils/word-stats';
import { dbHelper } from '../../db';
import { exportToExcel } from '../../utils/excel-export';
import { exportToHtml } from '../../utils/html-export';
import type { ConnectionStatus, ViewerCount } from '../../types';

// Tab 状态
const activeTab = ref<'home' | 'history'>('home');

// 主题状态
const isDarkMode = ref(true);

// 设置状态
const showSettings = ref(false);
const wsUrl = ref('ws://localhost:3456');
const wsUrlInput = ref('');

// 采集状态（从 background 同步）
const username = ref('');
const status = ref<ConnectionStatus>('disconnected');
const roomId = ref('');
const viewerCount = ref(0);
const commentCount = ref(0);
const giftCount = ref(0);
const likeCount = ref(0);
const startTime = ref<number | null>(null);
const currentSessionId = ref<number | null>(null);
const errorMessage = ref('');
const viewerHistory = ref<ViewerCount[]>([]);
const recentComments = ref<string[]>([]);
const topWords = ref<WordCount[]>([]);

// 礼物榜（从 background 同步）
const topViewers = ref<Array<{ uniqueId: string; nickname: string; coinCount: number }>>([]);

// 峰值观众数
const peakViewerCount = ref(0);
const peakViewerTime = ref<Date | null>(null);

// 评论暂停状态
const commentsPaused = ref(false);

// 最近评论详情（用于展示）
const latestCommentsDetail = ref<Array<{ nickname: string; content: string }>>([]);

// 复制状态
const copySuccess = ref(false);

// 历史用户下拉
const historyUsernames = ref<string[]>([]);
const showUserDropdown = ref(false);

// 计时器
const now = ref(Date.now());
let durationTimer: number | null = null;

// 计算属性
const duration = computed(() => {
  if (!startTime.value) return '00:00:00';
  const diff = Math.floor((now.value - startTime.value) / 1000);
  const h = Math.floor(diff / 3600).toString().padStart(2, '0');
  const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
  const s = (diff % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
});

const statusText = computed(() => {
  switch (status.value) {
    case 'disconnected': return '未连接';
    case 'connecting': return '连接中...';
    case 'connected': return `已连接`;
    case 'error': return errorMessage.value || '连接错误';
    case 'server_offline': return '服务器离线';
    default: return '未知状态';
  }
});

const statusColor = computed(() => {
  switch (status.value) {
    case 'connected': return 'success';
    case 'connecting': return 'warning';
    case 'error': case 'server_offline': return 'error';
    default: return 'neutral';
  }
});

const serverOnline = computed(() => status.value !== 'server_offline');

// 观众变化指示
const viewerDelta = computed(() => {
  if (viewerHistory.value.length < 2) return 0;
  const recent = viewerHistory.value.slice(-2);
  return recent[1].count - recent[0].count;
});

// 格式化数字（大数字缩写）
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

// 格式化时间戳
function formatTimestamp(date: Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 获取首字母头像
function getInitial(name: string): string {
  if (!name) return '?';
  const char = name.charAt(0).toUpperCase();
  // 如果是中文字符，直接返回
  if (/[\u4e00-\u9fa5]/.test(char)) return char;
  // 如果是英文，返回大写
  if (/[A-Z]/.test(char)) return char;
  // 其他情况返回第一个字符
  return char || '?';
}

// 主题切换
async function toggleTheme() {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light');
  try {
    await chrome.storage.local.set({ theme: isDarkMode.value ? 'dark' : 'light' });
  } catch (e) {
    console.error('Failed to save theme:', e);
  }
}

// 加载主题偏好
async function loadThemePreference() {
  try {
    const result = await chrome.storage.local.get('theme');
    if (result.theme) {
      isDarkMode.value = result.theme === 'dark';
    }
    document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light');
  } catch (e) {
    console.error('Failed to load theme:', e);
  }
}

const canConnect = computed(() =>
  serverOnline.value && username.value.trim() &&
  (status.value === 'disconnected' || status.value === 'error')
);

const canDisconnect = computed(() =>
  status.value === 'connected' || status.value === 'connecting'
);

const startTimeDate = computed(() =>
  startTime.value ? new Date(startTime.value) : new Date()
);

// 从 background 同步状态
function syncState(state: any) {
  const wasConnected = status.value === 'connected';
  const isNowConnected = state.status === 'connected';

  status.value = state.status;
  if (state.username) username.value = state.username;
  roomId.value = state.roomId || '';
  commentCount.value = state.commentCount ?? 0;
  giftCount.value = state.giftCount ?? 0;
  likeCount.value = state.likeCount ?? 0;
  startTime.value = state.startTime;
  currentSessionId.value = state.currentSessionId;
  errorMessage.value = state.errorMessage;
  topViewers.value = state.topViewers || [];

  if ((state.viewerCount ?? 0) !== viewerCount.value && isNowConnected) {
    viewerCount.value = state.viewerCount ?? 0;
    viewerHistory.value.push({
      count: state.viewerCount,
      timestamp: new Date(),
      sessionId: state.currentSessionId || 0,
    });
    if (viewerHistory.value.length > 100) {
      viewerHistory.value = viewerHistory.value.slice(-100);
    }
    // 更新峰值
    if (state.viewerCount > peakViewerCount.value) {
      peakViewerCount.value = state.viewerCount;
      peakViewerTime.value = new Date();
    }
  } else {
    viewerCount.value = state.viewerCount ?? 0;
  }

  if (!wasConnected && isNowConnected) {
    viewerHistory.value = [{
      count: state.viewerCount,
      timestamp: new Date(),
      sessionId: state.currentSessionId || 0,
    }];
    recentComments.value = [];
    topWords.value = [];
    // 重置峰值
    peakViewerCount.value = state.viewerCount ?? 0;
    peakViewerTime.value = new Date();
  } else if (wasConnected && !isNowConnected) {
    viewerHistory.value = [];
    recentComments.value = [];
    topWords.value = [];
    peakViewerCount.value = 0;
    peakViewerTime.value = null;
  }

  if (state.status === 'connected' && !durationTimer) {
    durationTimer = window.setInterval(() => {
      now.value = Date.now();
    }, 1000);
  } else if (state.status !== 'connected' && durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

function updateTopWords(comments: string[], commentsDetail?: Array<{ nickname: string; content: string }>) {
  recentComments.value = comments;
  if (comments.length >= 10) {
    topWords.value = getWordFrequency(comments, 5);
  }
  if (commentsDetail) {
    latestCommentsDetail.value = commentsDetail.slice(-10).reverse();
  }
}

async function fetchState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getState' });
    if (response?.state) {
      syncState(response.state);
    }
    if (response?.wsUrl) {
      wsUrl.value = response.wsUrl;
      wsUrlInput.value = response.wsUrl;
    }
    if (response?.recentComments) {
      updateTopWords(response.recentComments, response.recentCommentsDetail);
    }
  } catch (e) {
    console.error('Failed to get state:', e);
  }
}

function handleMessage(message: any) {
  if (message.type === 'stateUpdate' && message.state) {
    syncState(message.state);
    if (message.recentComments) {
      updateTopWords(message.recentComments, message.recentCommentsDetail);
    }
  }
}

async function connect() {
  if (!canConnect.value) return;
  const cleanUsername = username.value.replace('@', '').trim();
  await chrome.runtime.sendMessage({ type: 'connect', username: cleanUsername });
}

async function disconnect() {
  await chrome.runtime.sendMessage({ type: 'disconnect' });
}

async function exportData() {
  if (!currentSessionId.value) return;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'export' });
    if (response?.data) {
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = `tiktok-live-${username.value}-${new Date().toISOString().slice(0, 10)}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error('Export failed:', e);
  }
}

async function exportExcel() {
  if (!currentSessionId.value) return;
  try {
    const sessionId = currentSessionId.value;
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
        totalLikes: likeCount.value,
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

async function exportHtml() {
  if (!currentSessionId.value) return;
  try {
    await exportToHtml(currentSessionId.value);
  } catch (e) {
    console.error('HTML export failed:', e);
  }
}

function toggleSettings() {
  showSettings.value = !showSettings.value;
  if (showSettings.value) {
    wsUrlInput.value = wsUrl.value;
  }
}

async function saveWsUrl() {
  const url = wsUrlInput.value.trim();
  if (!url) return;
  // 前端预校验：只允许 localhost/127.0.0.1
  if (!/^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url)) {
    errorMessage.value = '无效地址，只允许 ws://localhost 或 ws://127.0.0.1';
    return;
  }
  try {
    const response = await chrome.runtime.sendMessage({ type: 'setConfig', wsUrl: url });
    if (response?.success) {
      wsUrl.value = response.wsUrl;
      showSettings.value = false;
      errorMessage.value = '';
    } else if (response?.error) {
      errorMessage.value = response.error;
    }
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// 历史用户下拉相关
async function fetchHistoryUsernames() {
  try {
    historyUsernames.value = await dbHelper.getDistinctUsernames(10);
  } catch (e) {
    console.error('Failed to fetch history usernames:', e);
  }
}

function handleInputFocus() {
  if (!canDisconnect.value && historyUsernames.value.length > 0) {
    showUserDropdown.value = true;
  }
}

function handleInputBlur() {
  // 延迟关闭，允许点击下拉项
  setTimeout(() => {
    showUserDropdown.value = false;
  }, 150);
}

function selectUsername(name: string) {
  username.value = name;
  showUserDropdown.value = false;
}

// 一键复制摘要
async function copySummary() {
  const peakViewers = peakViewerCount.value || viewerCount.value;
  const hotWords = topWords.value.slice(0, 3).map(w => w.word).join(', ');

  const text = `📊 @${username.value} 直播数据
⏱ 时长: ${duration.value}
👥 峰值观众: ${peakViewers.toLocaleString()}
💬 评论: ${commentCount.value.toLocaleString()}
🎁 礼物: ${giftCount.value}
❤️ 点赞: ${likeCount.value.toLocaleString()}${hotWords ? `\n🔥 热词: ${hotWords}` : ''}`;

  try {
    await navigator.clipboard.writeText(text);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (e) {
    console.error('Copy failed:', e);
  }
}

onMounted(() => {
  loadThemePreference();
  fetchState();
  fetchHistoryUsernames();
  chrome.runtime.onMessage.addListener(handleMessage);
});

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleMessage);
  if (durationTimer) clearInterval(durationTimer);
});
</script>

<template>
  <div class="app" :class="{ 'theme-dark': isDarkMode, 'theme-light': !isDarkMode }">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
          </svg>
        </div>
        <div class="brand-info">
          <span class="brand-text">TikTok Live</span>
          <span v-if="status === 'connected' && username" class="brand-username">@{{ username }}</span>
        </div>
      </div>
      <div class="header-right">
        <div class="header-status" :class="statusColor">
          <span class="status-dot"></span>
          <span class="status-text">{{ statusText }}</span>
        </div>
        <button class="theme-toggle" @click="toggleTheme" title="切换主题">
          <svg v-if="isDarkMode" class="theme-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
          </svg>
          <svg v-else class="theme-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button
        class="nav-tab"
        :class="{ active: activeTab === 'home' }"
        @click="activeTab = 'home'"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3L4 9v12h16V9l-8-6zm6 16h-4v-5h-4v5H6v-9l6-4.5 6 4.5v9z"/>
        </svg>
        <span>采集</span>
      </button>
      <button
        class="nav-tab"
        :class="{ active: activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
        </svg>
        <span>历史</span>
      </button>
    </nav>

    <!-- Main Content -->
    <main class="main">
      <!-- Home Tab -->
      <div v-if="activeTab === 'home'" class="tab-panel">
        <!-- Connection Card -->
        <section class="card">
          <div class="card-header">
            <h3 class="card-title">连接直播间</h3>
          </div>
          <div class="card-content">
            <div class="input-group">
              <div class="input-wrapper-container">
                <div class="input-wrapper">
                  <span class="input-prefix">@</span>
                  <input
                    v-model="username"
                    type="text"
                    class="input"
                    placeholder="输入 TikTok 用户名"
                    :disabled="canDisconnect"
                    @keyup.enter="connect"
                    @focus="handleInputFocus"
                    @blur="handleInputBlur"
                  />
                </div>
                <!-- 历史用户下拉 -->
                <div v-if="showUserDropdown && historyUsernames.length > 0" class="user-dropdown">
                  <div class="dropdown-header">历史用户</div>
                  <button
                    v-for="name in historyUsernames"
                    :key="name"
                    class="dropdown-item"
                    @mousedown.prevent="selectUsername(name)"
                  >
                    <span class="dropdown-at">@</span>{{ name }}
                  </button>
                </div>
              </div>
              <button
                v-if="!canDisconnect"
                class="btn btn-primary"
                :disabled="!canConnect"
                @click="connect"
              >
                <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                连接
              </button>
              <button
                v-else
                class="btn btn-error"
                @click="disconnect"
              >
                <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h12v12H6z"/>
                </svg>
                断开
              </button>
            </div>
          </div>
        </section>

        <!-- Server Settings (Collapsible) -->
        <section class="card card-settings">
          <button class="settings-toggle" @click="toggleSettings">
            <div class="settings-toggle-left">
              <svg class="settings-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
              <span class="settings-label">服务器设置</span>
            </div>
            <div class="settings-toggle-right">
              <span class="settings-value">{{ wsUrl }}</span>
              <svg class="chevron" :class="{ rotated: showSettings }" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
              </svg>
            </div>
          </button>
          <div v-if="showSettings" class="settings-content">
            <div class="input-group">
              <input
                v-model="wsUrlInput"
                type="text"
                class="input input-mono"
                placeholder="ws://localhost:3456"
                :disabled="canDisconnect"
              />
              <button
                class="btn btn-tonal"
                :disabled="canDisconnect || !wsUrlInput.trim()"
                @click="saveWsUrl"
              >
                保存
              </button>
            </div>
            <p v-if="canDisconnect" class="settings-hint">
              采集中无法修改服务器地址
            </p>
          </div>
        </section>

        <!-- Live Stats (When Connected) -->
        <section v-if="status === 'connected'" class="card card-stats">
          <!-- LIVE Badge (Corner) -->
          <div class="live-corner-badge">
            <span class="live-pulse"></span>
            LIVE
          </div>

          <div class="card-content">
            <!-- Bento Grid - Primary Stats (2 columns) -->
            <div class="bento-grid bento-2col">
              <div class="bento-item bento-primary">
                <div class="bento-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                </div>
                <div class="bento-content">
                  <div class="bento-value">{{ formatNumber(viewerCount) }}</div>
                  <div class="bento-label">观众在线</div>
                  <div class="bento-meta">
                    <span v-if="viewerDelta !== 0" class="delta" :class="{ 'delta-up': viewerDelta > 0, 'delta-down': viewerDelta < 0 }">
                      {{ viewerDelta > 0 ? '▲' : '▼' }} {{ Math.abs(viewerDelta) }}
                    </span>
                    <span v-if="peakViewerCount > 0" class="peak-info">峰值 {{ formatNumber(peakViewerCount) }}</span>
                  </div>
                </div>
              </div>
              <div class="bento-item">
                <div class="bento-icon bento-icon-comment">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
                  </svg>
                </div>
                <div class="bento-content">
                  <div class="bento-value">{{ formatNumber(commentCount) }}</div>
                  <div class="bento-label">总评论</div>
                </div>
              </div>
            </div>

            <!-- Bento Grid - Secondary Stats (3 columns) -->
            <div class="bento-grid bento-3col">
              <div class="bento-item bento-small">
                <div class="bento-value bento-value-mono">{{ duration }}</div>
                <div class="bento-label">直播时长</div>
              </div>
              <div class="bento-item bento-small">
                <div class="bento-icon-inline">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
                <div class="bento-value bento-value-like">{{ formatNumber(likeCount) }}</div>
                <div class="bento-label">点赞</div>
              </div>
              <div class="bento-item bento-small">
                <div class="bento-icon-inline bento-icon-gift">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
                  </svg>
                </div>
                <div class="bento-value bento-value-gift">{{ giftCount }}</div>
                <div class="bento-label">礼物</div>
              </div>
            </div>

            <!-- Viewer Chart -->
            <div v-if="viewerHistory.length > 1" class="chart-section">
              <div class="chart-header">
                <span class="chart-title">
                  <svg class="chart-title-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
                  </svg>
                  观众趋势
                </span>
                <span v-if="peakViewerTime" class="chart-peak">
                  峰值: {{ formatNumber(peakViewerCount) }} @ {{ formatTimestamp(peakViewerTime) }}
                </span>
              </div>
              <ViewerChart
                :data="viewerHistory"
                :start-time="startTimeDate"
                :peak-value="peakViewerCount"
                :is-dark="isDarkMode"
              />
            </div>

            <!-- Hot Keywords -->
            <div v-if="topWords.length > 0" class="keywords-section">
              <div class="section-header">
                <svg class="section-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
                </svg>
                热门词汇
              </div>
              <div class="hot-words-cloud">
                <span
                  v-for="(item, index) in topWords.slice(0, 8)"
                  :key="item.word"
                  class="hot-word-tag"
                  :class="[
                    `hot-word-rank-${Math.min(index + 1, 5)}`,
                    { 'hot-word-top': index < 2 }
                  ]"
                  :title="`出现 ${item.count} 次`"
                >
                  {{ item.word }}
                </span>
              </div>
            </div>

            <!-- Gift Rank (贡献榜) -->
            <div v-if="topViewers.length > 0" class="gift-rank-section">
              <div class="section-header">
                <svg class="section-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm7 6c-1.65 0-3-1.35-3-3V5h6v6c0 1.65-1.35 3-3 3zm7-6c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                </svg>
                贡献榜
              </div>
              <div class="rank-list">
                <div
                  v-for="(user, index) in topViewers.slice(0, 5)"
                  :key="user.uniqueId"
                  class="rank-item"
                  :class="{ 'rank-item-top': index < 3 }"
                >
                  <span class="rank-medal">
                    <template v-if="index === 0">🥇</template>
                    <template v-else-if="index === 1">🥈</template>
                    <template v-else-if="index === 2">🥉</template>
                    <template v-else>{{ index + 1 }}</template>
                  </span>
                  <span class="rank-avatar" :class="`avatar-${(index % 5) + 1}`">
                    {{ getInitial(user.nickname) }}
                  </span>
                  <span class="rank-name">{{ user.nickname }}</span>
                  <span class="rank-coins">
                    <svg class="coin-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                    </svg>
                    {{ formatNumber(user.coinCount) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Recent Comments (最近评论) -->
            <div v-if="latestCommentsDetail.length > 0" class="comments-section">
              <div class="section-header section-header-with-action">
                <span class="section-header-left">
                  <svg class="section-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
                  </svg>
                  最近评论
                </span>
                <button class="pause-btn" @click="commentsPaused = !commentsPaused">
                  <svg v-if="!commentsPaused" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
              <div class="comments-list" :class="{ 'comments-paused': commentsPaused }">
                <div
                  v-for="(c, index) in latestCommentsDetail"
                  :key="index"
                  class="comment-item"
                >
                  <span class="comment-avatar" :class="`avatar-${(index % 5) + 1}`">
                    {{ getInitial(c.nickname) }}
                  </span>
                  <div class="comment-body">
                    <span class="comment-author">{{ c.nickname }}</span>
                    <span class="comment-content">{{ c.content }}</span>
                  </div>
                  <span class="comment-time">{{ new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Export Buttons -->
        <div class="export-bar">
          <button
            class="export-btn export-btn-copy"
            :disabled="!currentSessionId"
            :class="{ 'export-success': copySuccess }"
            @click="copySummary"
          >
            <svg v-if="!copySuccess" class="export-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            <svg v-else class="export-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span class="export-text">{{ copySuccess ? '已复制' : '复制摘要' }}</span>
          </button>
          <button
            class="export-btn export-btn-report"
            :disabled="!currentSessionId"
            @click="exportHtml"
          >
            <svg class="export-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
            <span class="export-text">报告</span>
          </button>
          <button
            class="export-btn export-btn-excel"
            :disabled="!currentSessionId"
            @click="exportExcel"
          >
            <svg class="export-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            <span class="export-text">Excel</span>
          </button>
          <button
            class="export-btn export-btn-json"
            :disabled="!currentSessionId"
            @click="exportData"
          >
            <svg class="export-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 3a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2H3v2h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2v-2H8v-5a2 2 0 0 0-1.17-1.82A2 2 0 0 0 8 9V4h2V2H8zM16 3a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1v2h-1a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2v-2h2v-5a2 2 0 0 1 1.17-1.82A2 2 0 0 1 16 9V4h-2V2h2z"/>
            </svg>
            <span class="export-text">JSON</span>
          </button>
        </div>

        <!-- Hint -->
        <p v-if="status === 'connected'" class="hint-text">
          <svg class="hint-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          关闭此窗口不会中断采集
        </p>
      </div>

      <!-- History Tab -->
      <div v-else-if="activeTab === 'history'" class="tab-panel">
        <TabHistory />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ========== Design System - Dashboard Monitoring Panel ========== */
.app {
  /* ===== Dark Mode (Default) ===== */
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
  --bg-elevated: #334155;
  --bg-card: #1E293B;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --border: #334155;
  --border-light: #475569;

  /* Semantic Colors */
  --accent-primary: #3B82F6;
  --accent-primary-glow: rgba(59, 130, 246, 0.3);
  --accent-live: #EF4444;
  --accent-success: #22C55E;
  --accent-warning: #F59E0B;
  --accent-gift: #A855F7;
  --accent-like: #EC4899;
  --accent-comment: #06B6D4;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
  --shadow-glow: 0 0 20px var(--accent-primary-glow);

  /* Typography */
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 28px;
  --text-3xl: 36px;

  /* Spacing & Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;

  /* Base Styles */
  font-family: var(--font-sans);
  font-size: var(--text-base);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 420px;
  width: 400px;
  max-width: 400px;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

/* ===== Light Mode ===== */
.app.theme-light {
  --bg-primary: #F8FAFC;
  --bg-secondary: #FFFFFF;
  --bg-elevated: #F1F5F9;
  --bg-card: #FFFFFF;
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-muted: #94A3B8;
  --border: #E2E8F0;
  --border-light: #CBD5E1;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --shadow-glow: 0 0 20px rgba(59, 130, 246, 0.15);
}

/* ========== Header ========== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.brand-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #EE1D52 0%, #69C9D0 100%);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 0 16px rgba(238, 29, 82, 0.4);
  animation: brand-glow 3s ease-in-out infinite;
}

@keyframes brand-glow {
  0%, 100% { box-shadow: 0 0 16px rgba(238, 29, 82, 0.4); }
  50% { box-shadow: 0 0 24px rgba(105, 201, 208, 0.5); }
}

.brand-icon svg {
  width: 22px;
  height: 22px;
}

.brand-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-text {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.brand-username {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.header-status.success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--accent-success);
}

.header-status.warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-warning);
}

.header-status.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--accent-live);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.header-status.success .status-dot {
  animation: breath 2s ease-in-out infinite;
}

@keyframes breath {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.theme-toggle {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-toggle:hover {
  background: var(--border);
  color: var(--text-primary);
}

.theme-icon {
  width: 18px;
  height: 18px;
}

/* ========== Navigation Tabs ========== */
.nav-tabs {
  display: flex;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.nav-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: none;
  border: none;
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.nav-tab:hover {
  color: var(--text-secondary);
  background: var(--bg-elevated);
}

.nav-tab.active {
  color: var(--accent-primary);
}

.nav-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: var(--space-4);
  right: var(--space-4);
  height: 3px;
  background: var(--accent-primary);
  border-radius: 3px 3px 0 0;
}

.tab-icon {
  width: 20px;
  height: 20px;
}

/* ========== Main Content ========== */
.main {
  flex: 1;
  padding: var(--space-3);
  overflow-y: auto;
  background: var(--bg-primary);
}

/* Custom Scrollbar */
.main::-webkit-scrollbar {
  width: 6px;
}

.main::-webkit-scrollbar-track {
  background: transparent;
}

.main::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.main::-webkit-scrollbar-thumb:hover {
  background: var(--border-light);
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ========== Cards ========== */
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
}

.card-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-content {
  padding: var(--space-4);
}

/* ========== Input Group ========== */
.input-group {
  display: flex;
  gap: var(--space-2);
}

.input-wrapper-container {
  flex: 1;
  position: relative;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-primary-glow);
}

.input-prefix {
  padding-left: var(--space-3);
  color: var(--text-muted);
  font-weight: 600;
}

.input {
  flex: 1;
  padding: var(--space-3);
  padding-left: var(--space-1);
  background: none;
  border: none;
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--text-primary);
  outline: none;
}

.input::placeholder {
  color: var(--text-muted);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-mono {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

/* ========== Buttons ========== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-3) var(--space-5);
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: 600;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-icon {
  width: 18px;
  height: 18px;
}

.btn-primary {
  background: var(--accent-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563EB;
  box-shadow: var(--shadow-glow);
}

.btn-error {
  background: var(--accent-live);
  color: white;
}

.btn-error:hover:not(:disabled) {
  background: #DC2626;
}

.btn-tonal {
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent-primary);
}

.btn-tonal:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.25);
}

/* ========== Export Bar ========== */
.export-bar {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}

.export-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.export-btn:hover:not(:disabled) {
  background: var(--bg-elevated);
}

.export-icon {
  width: 20px;
  height: 20px;
}

.export-text {
  white-space: nowrap;
}

.export-btn-copy:hover:not(:disabled) {
  color: var(--accent-comment);
  border-color: var(--accent-comment);
}

.export-btn-report:hover:not(:disabled) {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.export-btn-excel:hover:not(:disabled) {
  color: var(--accent-success);
  border-color: var(--accent-success);
}

.export-btn-json:hover:not(:disabled) {
  color: var(--accent-warning);
  border-color: var(--accent-warning);
}

.export-btn.export-success {
  color: var(--accent-success);
  border-color: var(--accent-success);
  background: rgba(34, 197, 94, 0.1);
}

/* ========== Settings Toggle ========== */
.card-settings {
  overflow: visible;
}

.settings-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
}

.settings-toggle:hover {
  background: var(--bg-elevated);
}

.settings-toggle-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.settings-icon {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
}

.settings-label {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-primary);
}

.settings-toggle-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.settings-value {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.chevron.rotated {
  transform: rotate(180deg);
}

.settings-content {
  padding: 0 var(--space-4) var(--space-4);
  border-top: 1px solid var(--border);
}

.settings-content .input-group {
  margin-top: var(--space-3);
}

.settings-hint {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* ========== Stats Card with Bento Grid ========== */
.card-stats {
  position: relative;
  overflow: hidden;
}

.live-corner-badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--accent-live);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  color: white;
  letter-spacing: 0.08em;
  box-shadow: 0 0 16px rgba(239, 68, 68, 0.5);
  z-index: 10;
}

.live-pulse {
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  animation: live-pulse 1s ease-in-out infinite;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

/* Bento Grid Layout */
.bento-grid {
  display: grid;
  gap: var(--space-3);
}

.bento-2col {
  grid-template-columns: repeat(2, 1fr);
}

.bento-3col {
  grid-template-columns: repeat(3, 1fr);
  margin-top: var(--space-3);
}

.bento-item {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: all 0.2s ease;
}

.bento-item:hover {
  background: var(--border);
}

.bento-item.bento-primary {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.bento-item.bento-primary:hover {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-glow);
}

.bento-item.bento-small {
  padding: var(--space-3);
  align-items: center;
  text-align: center;
}

.bento-icon {
  width: 28px;
  height: 28px;
  color: var(--accent-primary);
}

.bento-icon-comment {
  color: var(--accent-comment);
}

.bento-icon-inline {
  width: 16px;
  height: 16px;
  color: var(--accent-like);
}

.bento-icon-gift {
  color: var(--accent-gift);
}

.bento-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bento-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
}

.bento-value-mono {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  letter-spacing: 0.02em;
}

.bento-value-like {
  color: var(--accent-like);
  font-size: var(--text-lg);
}

.bento-value-gift {
  color: var(--accent-gift);
  font-size: var(--text-lg);
}

.bento-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-muted);
}

.bento-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.delta {
  font-size: var(--text-xs);
  font-weight: 600;
  font-family: var(--font-mono);
}

.delta-up {
  color: var(--accent-success);
}

.delta-down {
  color: var(--accent-live);
}

.peak-info {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* ========== Chart Section ========== */
.chart-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.chart-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.chart-title-icon {
  width: 16px;
  height: 16px;
  color: var(--accent-primary);
}

.chart-peak {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-muted);
}

/* ========== Hot Words Section ========== */
.keywords-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
}

.section-icon {
  width: 16px;
  height: 16px;
  color: var(--accent-warning);
}

.hot-words-cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.hot-word-tag {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-weight: 500;
  cursor: default;
  transition: all 0.2s ease;
}

.hot-word-tag:hover {
  background: var(--border);
}

/* Dynamic sizing based on rank */
.hot-word-rank-1 {
  font-size: var(--text-lg);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
  color: #F97316;
  border: 1px solid rgba(249, 115, 22, 0.3);
}

.hot-word-rank-2 {
  font-size: var(--text-base);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 179, 8, 0.15) 100%);
  color: var(--accent-warning);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.hot-word-rank-3 {
  font-size: var(--text-sm);
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent-primary);
}

.hot-word-rank-4 {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.hot-word-rank-5 {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* ========== Hint Text ========== */
.hint-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.hint-icon {
  width: 16px;
  height: 16px;
}

/* ========== User Dropdown ========== */
.user-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: var(--space-1);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-header {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  padding: var(--space-3);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--text-primary);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dropdown-item:hover {
  background: var(--bg-elevated);
}

.dropdown-at {
  color: var(--text-muted);
  margin-right: 2px;
}

/* ========== Gift Rank Section ========== */
.gift-rank-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.rank-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.rank-item:hover {
  background: var(--border);
}

.rank-item-top {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%);
  border: 1px solid rgba(168, 85, 247, 0.2);
}

.rank-medal {
  width: 24px;
  font-size: var(--text-lg);
  text-align: center;
}

.rank-item:not(.rank-item-top) .rank-medal {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-muted);
}

.rank-avatar {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 600;
  color: white;
  border-radius: 50%;
}

/* Avatar color variations */
.avatar-1 { background: linear-gradient(135deg, #F97316, #EA580C); }
.avatar-2 { background: linear-gradient(135deg, #3B82F6, #2563EB); }
.avatar-3 { background: linear-gradient(135deg, #22C55E, #16A34A); }
.avatar-4 { background: linear-gradient(135deg, #A855F7, #9333EA); }
.avatar-5 { background: linear-gradient(135deg, #EC4899, #DB2777); }

.rank-name {
  flex: 1;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-coins {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--accent-gift);
}

.coin-icon {
  width: 14px;
  height: 14px;
}

/* ========== Comments Section ========== */
.comments-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.section-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.pause-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.pause-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.pause-btn svg {
  width: 14px;
  height: 14px;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 160px;
  overflow-y: auto;
}

.comments-list.comments-paused {
  opacity: 0.6;
}

.comments-list::-webkit-scrollbar {
  width: 4px;
}

.comments-list::-webkit-scrollbar-track {
  background: transparent;
}

.comments-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  animation: comment-slide-in 0.3s ease-out;
}

@keyframes comment-slide-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.comment-avatar {
  width: 24px;
  height: 24px;
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: 600;
  color: white;
  border-radius: 50%;
}

.comment-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.comment-author {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent-primary);
}

.comment-content {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.4;
  word-break: break-word;
}

.comment-time {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
