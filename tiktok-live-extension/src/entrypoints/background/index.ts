import { db, dbHelper } from '../../db';
import type { ConnectionStatus, WsMessage } from '../../types';
import { isValidWsUrl } from '../../utils/validation';

const DEFAULT_WS_URL = 'ws://localhost:3456';
let wsUrl = DEFAULT_WS_URL;

// 从 storage 加载配置
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['wsUrl']);
    if (result.wsUrl && isValidWsUrl(result.wsUrl)) {
      wsUrl = result.wsUrl;
    } else if (result.wsUrl) {
      console.warn('[Background] Invalid wsUrl in storage, using default:', result.wsUrl);
    }
  } catch (e) {
    console.error('[Background] Failed to load config:', e);
  }
}

// 状态管理
interface State {
  status: ConnectionStatus;
  username: string;
  roomId: string;
  viewerCount: number;
  commentCount: number;
  giftCount: number;
  likeCount: number;
  followCount: number;
  shareCount: number;
  subscribeCount: number;
  shoppingCount: number;
  envelopeCount: number;
  envelopeDiamonds: number;
  questionCount: number;
  emoteCount: number;
  barrageCount: number;
  currentRank: { rankType: string; rank: number } | null;
  currentBattle: { battleId: string; status: number; anchors: Array<{ userId: string; nickname: string }> } | null;
  topViewers: Array<{ uniqueId: string; nickname: string; coinCount: number }>;
  startTime: number | null;
  currentSessionId: number | null;
  errorMessage: string;
}

let state: State = {
  status: 'disconnected',
  username: '',
  roomId: '',
  viewerCount: 0,
  commentCount: 0,
  giftCount: 0,
  likeCount: 0,
  followCount: 0,
  shareCount: 0,
  subscribeCount: 0,
  shoppingCount: 0,
  envelopeCount: 0,
  envelopeDiamonds: 0,
  questionCount: 0,
  emoteCount: 0,
  barrageCount: 0,
  currentRank: null,
  currentBattle: null,
  topViewers: [],
  startTime: null,
  currentSessionId: null,
  errorMessage: '',
};

let ws: WebSocket | null = null;
let shouldReconnect = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// 事件缓冲区（用于 session 创建前的事件）
let eventBuffer: WsMessage[] = [];
let isSessionReady = false;
const MAX_EVENT_BUFFER = 500; // P1: 限制 eventBuffer 大小防止内存泄漏

// 最近评论（用于热词统计）
let recentComments: string[] = [];
// 最近评论详情（用于 UI 展示）
let recentCommentsDetail: Array<{ nickname: string; content: string; timestamp: number }> = [];
const MAX_RECENT_COMMENTS = 200;

// 批量写入缓冲区
let commentBuffer: Array<{
  msgId: string;
  userId: string;
  username: string;
  nickname: string;
  content: string;
  followRole?: number;
  isModerator?: boolean;
  isSubscriber?: boolean;
  timestamp: number;
}> = [];
let giftBuffer: Array<{
  odl: string;
  username: string;
  nickname: string;
  giftName: string;
  repeatCount: number;
  diamondCount: number;
  timestamp: number;
}> = [];
let viewerCountBuffer: Array<{ count: number; topViewers?: Array<{ uniqueId: string; nickname: string; coinCount: number }>; timestamp: number }> = [];
let followBuffer: Array<{ uniqueId: string; nickname: string; timestamp: number }> = [];
let shareBuffer: Array<{ uniqueId: string; nickname: string; timestamp: number }> = [];
let subscribeBuffer: Array<{ uniqueId: string; nickname: string; subMonth: number; timestamp: number }> = [];
let likeBuffer: Array<{ totalLikeCount: number; timestamp: number }> = [];
let shoppingBuffer: Array<{ productName: string; productPrice: string; shopName: string; productImageUrl?: string; timestamp: number }> = [];
let envelopeBuffer: Array<{ envelopeId: string; senderNickname: string; diamondCount: number; participantCount: number; timestamp: number }> = [];
let questionBuffer: Array<{ questionId: string; userId: string; username: string; nickname: string; content: string; timestamp: number }> = [];
let battleScoreBuffer: Array<{ battleId: string; battleItems: Array<{ hostUserId: string; hostNickname: string; points: number }>; timestamp: number }> = [];
let emoteBuffer: Array<{ userId: string; username: string; nickname: string; emoteId: string; emoteImageUrl?: string; timestamp: number }> = [];
let barrageBuffer: Array<{ userId: string; username: string; nickname: string; content: string; barrageType: string; timestamp: number }> = [];

// 最近记录缓存（供 popup 展示）
let recentShoppings: Array<{ productName: string; productPrice: string; shopName: string; timestamp: number }> = [];
let recentQuestions: Array<{ nickname: string; content: string; timestamp: number }> = [];
let recentBarrages: Array<{ nickname: string; content: string; barrageType: string; timestamp: number }> = [];
const MAX_RECENT_ITEMS = 20;

let flushTimerActive = false;
let flushIntervalId: ReturnType<typeof setInterval> | null = null;
const BUFFER_SIZE = 50;

// 广播状态给所有 popup
let broadcastScheduled = false;
function broadcastState() {
  if (broadcastScheduled) return;
  broadcastScheduled = true;
  setTimeout(() => {
    broadcastScheduled = false;
    chrome.runtime.sendMessage({
      type: 'stateUpdate', state,
      recentComments, recentCommentsDetail,
      recentShoppings, recentQuestions, recentBarrages,
    }).catch(() => {});
  }, 200);
}

// 刷新缓冲区到数据库
let isFlushingInProgress = false;
async function flushBuffers() {
  if (!state.currentSessionId) return;
  if (isFlushingInProgress) return; // 防并发重入（alarm + interval 可能同时触发）
  isFlushingInProgress = true;

  const sessionId = state.currentSessionId;

  try {
  // 批量写入评论
  if (commentBuffer.length > 0) {
    const comments = commentBuffer.map(c => ({
      sessionId,
      msgId: c.msgId,
      userId: c.userId,
      username: c.username,
      nickname: c.nickname,
      content: c.content,
      followRole: c.followRole,
      isModerator: c.isModerator,
      isSubscriber: c.isSubscriber,
      timestamp: new Date(c.timestamp),
    }));
    // P0: 先保存引用，成功后再清空，避免数据丢失
    const toFlush = [...commentBuffer];

    try {
      await db.comments.bulkAdd(comments);
      commentBuffer = commentBuffer.filter(c => !toFlush.includes(c)); // 只清空已写入的
    } catch (e) {
      console.warn('[Background] Bulk add comments failed, trying one by one:', e);
      // P0: 用 identity-based 过滤，逐条追踪成功/失败，避免乱序截断
      const succeeded = new Set<typeof toFlush[number]>();
      for (let i = 0; i < comments.length; i++) {
        try {
          await db.comments.add(comments[i]);
          succeeded.add(toFlush[i]);
        } catch (innerErr) {
          // P0: 记录失败而非静默吞掉
          console.error('[Background] Failed to add comment:', innerErr);
        }
      }
      // 只清空确认成功写入的条目
      commentBuffer = commentBuffer.filter(c => !succeeded.has(c));
    }
  }

  // 批量写入礼物（B4: 失败时逐条重试）
  if (giftBuffer.length > 0) {
    const gifts = giftBuffer.map(g => ({
      sessionId,
      odl: g.odl,
      username: g.username,
      nickname: g.nickname,
      giftName: g.giftName,
      repeatCount: g.repeatCount,
      diamondCount: g.diamondCount,
      timestamp: new Date(g.timestamp),
    }));
    const toFlush = [...giftBuffer];

    try {
      await db.gifts.bulkAdd(gifts);
      giftBuffer = giftBuffer.filter(g => !toFlush.includes(g));
    } catch (e) {
      console.warn('[Background] Bulk add gifts failed, trying one by one:', e);
      const succeeded = new Set<typeof toFlush[number]>();
      for (let i = 0; i < gifts.length; i++) {
        try {
          await db.gifts.add(gifts[i]);
          succeeded.add(toFlush[i]);
        } catch (innerErr) {
          console.error('[Background] Failed to add gift:', innerErr);
        }
      }
      giftBuffer = giftBuffer.filter(g => !succeeded.has(g));
    }
  }

  // 批量写入观众数
  if (viewerCountBuffer.length > 0) {
    const counts = viewerCountBuffer.map(v => ({
      sessionId,
      count: v.count,
      topViewers: v.topViewers,
      timestamp: new Date(v.timestamp),
    }));
    // P0: 先保存引用，成功后再清空
    const toFlush = [...viewerCountBuffer];

    try {
      await db.viewerCounts.bulkAdd(counts);
      viewerCountBuffer = viewerCountBuffer.filter(v => !toFlush.includes(v));
    } catch (e) {
      console.error('[Background] Failed to bulk add viewer counts:', e);
      // 保留失败的数据，下次重试
    }
  }

  // 批量写入关注（B4: 失败时逐条重试）
  if (followBuffer.length > 0) {
    const follows = followBuffer.map(f => ({
      sessionId,
      uniqueId: f.uniqueId,
      nickname: f.nickname,
      timestamp: new Date(f.timestamp),
    }));
    const toFlush = [...followBuffer];
    try {
      await db.follows.bulkAdd(follows);
      followBuffer = followBuffer.filter(f => !toFlush.includes(f));
    } catch (e) {
      console.warn('[Background] Bulk add follows failed, trying one by one:', e);
      const succeeded = new Set<typeof toFlush[number]>();
      for (let i = 0; i < follows.length; i++) {
        try {
          await db.follows.add(follows[i]);
          succeeded.add(toFlush[i]);
        } catch (innerErr) {
          console.error('[Background] Failed to add follow:', innerErr);
        }
      }
      followBuffer = followBuffer.filter(f => !succeeded.has(f));
    }
  }

  // 批量写入分享（B4: 失败时逐条重试）
  if (shareBuffer.length > 0) {
    const shares = shareBuffer.map(s => ({
      sessionId,
      uniqueId: s.uniqueId,
      nickname: s.nickname,
      timestamp: new Date(s.timestamp),
    }));
    const toFlush = [...shareBuffer];
    try {
      await db.shares.bulkAdd(shares);
      shareBuffer = shareBuffer.filter(s => !toFlush.includes(s));
    } catch (e) {
      console.warn('[Background] Bulk add shares failed, trying one by one:', e);
      const succeeded = new Set<typeof toFlush[number]>();
      for (let i = 0; i < shares.length; i++) {
        try {
          await db.shares.add(shares[i]);
          succeeded.add(toFlush[i]);
        } catch (innerErr) {
          console.error('[Background] Failed to add share:', innerErr);
        }
      }
      shareBuffer = shareBuffer.filter(s => !succeeded.has(s));
    }
  }

  // 批量写入订阅（B4: 失败时逐条重试）
  if (subscribeBuffer.length > 0) {
    const subscribes = subscribeBuffer.map(s => ({
      sessionId,
      uniqueId: s.uniqueId,
      nickname: s.nickname,
      subMonth: s.subMonth,
      timestamp: new Date(s.timestamp),
    }));
    const toFlush = [...subscribeBuffer];
    try {
      await db.subscribes.bulkAdd(subscribes);
      subscribeBuffer = subscribeBuffer.filter(s => !toFlush.includes(s));
    } catch (e) {
      console.warn('[Background] Bulk add subscribes failed, trying one by one:', e);
      const succeeded = new Set<typeof toFlush[number]>();
      for (let i = 0; i < subscribes.length; i++) {
        try {
          await db.subscribes.add(subscribes[i]);
          succeeded.add(toFlush[i]);
        } catch (innerErr) {
          console.error('[Background] Failed to add subscribe:', innerErr);
        }
      }
      subscribeBuffer = subscribeBuffer.filter(s => !succeeded.has(s));
    }
  }

  // B5: 批量写入点赞
  if (likeBuffer.length > 0) {
    const likes = likeBuffer.map(l => ({
      sessionId,
      totalLikeCount: l.totalLikeCount,
      timestamp: new Date(l.timestamp),
    }));
    const toFlush = [...likeBuffer];
    try {
      await db.likes.bulkAdd(likes);
      likeBuffer = likeBuffer.filter(l => !toFlush.includes(l));
    } catch (e) {
      console.error('[Background] Failed to bulk add likes:', e);
    }
  }

  // 批量写入商品推荐
  if (shoppingBuffer.length > 0) {
    const items = shoppingBuffer.map(s => ({
      sessionId, productName: s.productName, productPrice: s.productPrice,
      shopName: s.shopName, productImageUrl: s.productImageUrl, timestamp: new Date(s.timestamp),
    }));
    const toFlush = [...shoppingBuffer];
    try {
      await db.shoppings.bulkAdd(items);
      shoppingBuffer = shoppingBuffer.filter(s => !toFlush.includes(s));
    } catch (e) {
      console.error('[Background] Failed to bulk add shoppings:', e);
    }
  }

  // 批量写入红包（逐条重试去重）
  if (envelopeBuffer.length > 0) {
    const items = envelopeBuffer.map(e => ({
      sessionId, envelopeId: e.envelopeId, senderNickname: e.senderNickname,
      diamondCount: e.diamondCount, participantCount: e.participantCount, timestamp: new Date(e.timestamp),
    }));
    const toFlush = [...envelopeBuffer];
    try {
      await db.envelopes.bulkAdd(items);
      envelopeBuffer = envelopeBuffer.filter(e => !toFlush.includes(e));
    } catch (err) {
      const succeeded = new Set<typeof toFlush[number]>();
      for (let i = 0; i < items.length; i++) {
        try { await db.envelopes.add(items[i]); succeeded.add(toFlush[i]); } catch { /* dup */ }
      }
      envelopeBuffer = envelopeBuffer.filter(e => !succeeded.has(e));
    }
  }

  // 批量写入问答（逐条重试去重）
  if (questionBuffer.length > 0) {
    const items = questionBuffer.map(q => ({
      sessionId, questionId: q.questionId, userId: q.userId, username: q.username,
      nickname: q.nickname, content: q.content, timestamp: new Date(q.timestamp),
    }));
    const toFlush = [...questionBuffer];
    try {
      await db.questions.bulkAdd(items);
      questionBuffer = questionBuffer.filter(q => !toFlush.includes(q));
    } catch (err) {
      const succeeded = new Set<typeof toFlush[number]>();
      for (let i = 0; i < items.length; i++) {
        try { await db.questions.add(items[i]); succeeded.add(toFlush[i]); } catch { /* dup */ }
      }
      questionBuffer = questionBuffer.filter(q => !succeeded.has(q));
    }
  }

  // 批量写入 PK 积分
  if (battleScoreBuffer.length > 0) {
    const items = battleScoreBuffer.map(b => ({
      sessionId, battleId: b.battleId, battleItems: b.battleItems, timestamp: new Date(b.timestamp),
    }));
    const toFlush = [...battleScoreBuffer];
    try {
      await db.battleScores.bulkAdd(items);
      battleScoreBuffer = battleScoreBuffer.filter(b => !toFlush.includes(b));
    } catch (e) {
      console.error('[Background] Failed to bulk add battleScores:', e);
    }
  }

  // 批量写入表情
  if (emoteBuffer.length > 0) {
    const items = emoteBuffer.map(e => ({
      sessionId, userId: e.userId, username: e.username, nickname: e.nickname,
      emoteId: e.emoteId, emoteImageUrl: e.emoteImageUrl, timestamp: new Date(e.timestamp),
    }));
    const toFlush = [...emoteBuffer];
    try {
      await db.emotes.bulkAdd(items);
      emoteBuffer = emoteBuffer.filter(e => !toFlush.includes(e));
    } catch (e) {
      console.error('[Background] Failed to bulk add emotes:', e);
    }
  }

  // 批量写入弹幕
  if (barrageBuffer.length > 0) {
    const items = barrageBuffer.map(b => ({
      sessionId, userId: b.userId, username: b.username, nickname: b.nickname,
      content: b.content, barrageType: b.barrageType, timestamp: new Date(b.timestamp),
    }));
    const toFlush = [...barrageBuffer];
    try {
      await db.barrages.bulkAdd(items);
      barrageBuffer = barrageBuffer.filter(b => !toFlush.includes(b));
    } catch (e) {
      console.error('[Background] Failed to bulk add barrages:', e);
    }
  }
  // 定期持久化点赞数，防 SW 崩溃丢失
  if (state.currentSessionId && state.likeCount > 0) {
    try {
      await db.sessions.update(state.currentSessionId, { totalLikes: state.likeCount });
    } catch (e) {
      console.error('[Background] Failed to persist likeCount:', e);
    }
  }
  } finally {
    isFlushingInProgress = false;
  }
}

function startFlushTimer() {
  if (flushTimerActive) return;
  flushTimerActive = true;
  // B2: setInterval 做主力（3s），alarm 做兜底唤醒（30s）
  flushIntervalId = setInterval(() => flushBuffers(), 3000);
  chrome.alarms.create('flushBuffers', { periodInMinutes: 0.5 }); // 兜底唤醒
}

function stopFlushTimer() {
  if (flushTimerActive) {
    if (flushIntervalId) {
      clearInterval(flushIntervalId);
      flushIntervalId = null;
    }
    chrome.alarms.clear('flushBuffers');
    flushTimerActive = false;
  }
}

async function processBufferedEvents() {
  if (!isSessionReady || !state.currentSessionId) return;
  const toProcess = [...eventBuffer];
  eventBuffer = [];
  for (const message of toProcess) {
    if (!isSessionReady || !state.currentSessionId) break;
    await handleWsMessage(message, false);
  }
}

async function handleWsMessage(message: WsMessage, shouldBuffer = true) {
  if (!isSessionReady && shouldBuffer && ['comment', 'gift', 'like', 'roomUser', 'follow', 'share', 'subscribe', 'oecLiveShopping', 'envelope', 'questionNew', 'linkMicArmies', 'emote', 'barrage'].includes(message.type)) {
    // P1: 限制 eventBuffer 大小，丢弃最旧的事件
    if (eventBuffer.length >= MAX_EVENT_BUFFER) {
      eventBuffer.shift();
      console.warn('[Background] eventBuffer overflow, dropping oldest event');
    }
    eventBuffer.push(message);
    return;
  }

  switch (message.type) {
    case 'status':
      if (message.connected && message.username) {
        state.status = 'connected';
        state.username = message.username;
      }
      break;

    case 'connected':
      state.status = 'connected';
      state.roomId = message.roomId;
      state.viewerCount = message.viewerCount;
      state.startTime = Date.now();

      try {
        const sessionId = await dbHelper.createSession(message.username, message.roomId);
        state.currentSessionId = sessionId;
        isSessionReady = true;

        viewerCountBuffer.push({ count: message.viewerCount, timestamp: Date.now() });
        await processBufferedEvents();
        startFlushTimer();
      } catch (e) {
        console.error('Failed to create session:', e);
        state.status = 'error';
        state.errorMessage = 'Session 创建失败，数据无法记录';
        isSessionReady = false;
        eventBuffer = [];
        broadcastState();
      }
      break;

    case 'disconnected':
      // B6: 如果在等 ACK，由 onmessage 处理，这里不重复
      if (!awaitingDisconnectAck) {
        await handleDisconnect(undefined, 'userDisconnect');
      }
      break;

    case 'streamEnd':
      await handleDisconnect(undefined, 'streamEnd');
      break;

    case 'error':
      state.status = 'error';
      state.errorMessage = message.message || '连接失败，请检查用户名或直播状态';
      break;

    case 'comment':
      if (state.currentSessionId) {
        commentBuffer.push({
          msgId: message.id,
          userId: message.userId,
          username: message.username,
          nickname: message.nickname,
          content: message.comment,
          followRole: message.followRole,
          isModerator: message.isModerator,
          isSubscriber: message.isSubscriber,
          timestamp: message.timestamp,
        });
        state.commentCount++;

        // 添加到最近评论列表（用于热词统计）
        recentComments.push(message.comment);
        if (recentComments.length > MAX_RECENT_COMMENTS) recentComments.shift();

        recentCommentsDetail.push({ nickname: message.nickname, content: message.comment, timestamp: message.timestamp });
        if (recentCommentsDetail.length > MAX_RECENT_COMMENTS) recentCommentsDetail.shift();

        if (commentBuffer.length >= BUFFER_SIZE) {
          await flushBuffers();
        }
      }
      break;

    case 'gift':
      if (state.currentSessionId) {
        giftBuffer.push({
          odl: `${message.userId}-${message.giftId}-${message.timestamp}`,
          username: message.username,
          nickname: message.nickname,
          giftName: message.giftName,
          repeatCount: message.repeatCount,
          diamondCount: message.diamondCount,
          timestamp: message.timestamp,
        });
        state.giftCount += message.repeatCount;

        if (giftBuffer.length >= BUFFER_SIZE) {
          await flushBuffers();
        }
      }
      break;

    case 'like':
      if (state.currentSessionId) {
        // B5: 优先用 totalLikeCount（绝对值），回退增量累加
        if (message.totalLikeCount) {
          state.likeCount = message.totalLikeCount;
        } else {
          state.likeCount += message.likeCount;
        }
        // B5: 写入 likes 表
        likeBuffer.push({
          totalLikeCount: state.likeCount,
          timestamp: message.timestamp,
        });
      }
      break;

    case 'roomUser':
      state.viewerCount = message.viewerCount;
      // 保存打赏榜 Top 用户
      if (message.topViewers && message.topViewers.length > 0) {
        state.topViewers = message.topViewers.map(v => ({
          uniqueId: v.uniqueId,
          nickname: v.nickname,
          coinCount: v.coinCount,
        }));
      }
      if (state.currentSessionId) {
        viewerCountBuffer.push({
          count: message.viewerCount,
          topViewers: state.topViewers.length > 0 ? [...state.topViewers] : undefined,
          timestamp: message.timestamp,
        });
      }
      break;

    case 'member':
      // 观众进入 - 暂不存储（数据量太大），只广播给前端
      break;

    case 'follow':
      if (state.currentSessionId) {
        followBuffer.push({
          uniqueId: message.username,
          nickname: message.nickname,
          timestamp: message.timestamp,
        });
        state.followCount++;
      }
      break;

    case 'share':
      if (state.currentSessionId) {
        shareBuffer.push({
          uniqueId: message.username,
          nickname: message.nickname,
          timestamp: message.timestamp,
        });
        state.shareCount++;
      }
      break;

    case 'subscribe':
      if (state.currentSessionId) {
        subscribeBuffer.push({
          uniqueId: message.username,
          nickname: message.nickname,
          subMonth: message.subMonth,
          timestamp: message.timestamp,
        });
        state.subscribeCount++;
      }
      break;

    // ========== Tier 1: 电商/红包/排名 ==========

    case 'oecLiveShopping':
      if (state.currentSessionId) {
        shoppingBuffer.push({
          productName: message.productName,
          productPrice: message.productPrice,
          shopName: message.shopName,
          productImageUrl: message.productImageUrl,
          timestamp: message.timestamp,
        });
        state.shoppingCount++;
        recentShoppings.push({ productName: message.productName, productPrice: message.productPrice, shopName: message.shopName, timestamp: message.timestamp });
        if (recentShoppings.length > MAX_RECENT_ITEMS) recentShoppings.shift();
      }
      break;

    case 'envelope':
      if (state.currentSessionId) {
        envelopeBuffer.push({
          envelopeId: message.envelopeId,
          senderNickname: message.senderNickname,
          diamondCount: message.diamondCount,
          participantCount: message.participantCount,
          timestamp: message.timestamp,
        });
        state.envelopeCount++;
        state.envelopeDiamonds += message.diamondCount || 0;
      }
      break;

    case 'hourlyRank':
      state.currentRank = { rankType: message.rankType, rank: message.rank };
      break;

    case 'rankUpdate':
      if (message.updates && message.updates.length > 0) {
        state.currentRank = { rankType: message.updates[0].rankType, rank: message.updates[0].rank };
      }
      break;

    case 'rankText':
      // 仅广播，不持久化
      break;

    // ========== Tier 2: PK/问答/表情/弹幕 ==========

    case 'questionNew':
      if (state.currentSessionId) {
        questionBuffer.push({
          questionId: message.questionId,
          userId: message.userId,
          username: message.username,
          nickname: message.nickname,
          content: message.content,
          timestamp: message.timestamp,
        });
        state.questionCount++;
        recentQuestions.push({ nickname: message.nickname, content: message.content, timestamp: message.timestamp });
        if (recentQuestions.length > MAX_RECENT_ITEMS) recentQuestions.shift();
      }
      break;

    case 'linkMicArmies':
      if (state.currentSessionId) {
        battleScoreBuffer.push({
          battleId: message.battleId,
          battleItems: message.battleItems.map(i => ({ hostUserId: i.hostUserId, hostNickname: i.hostNickname, points: i.points })),
          timestamp: message.timestamp,
        });
      }
      break;

    case 'emote':
      if (state.currentSessionId) {
        emoteBuffer.push({
          userId: message.userId,
          username: message.username,
          nickname: message.nickname,
          emoteId: message.emoteId,
          emoteImageUrl: message.emoteImageUrl,
          timestamp: message.timestamp,
        });
        state.emoteCount++;
        if (emoteBuffer.length >= BUFFER_SIZE) {
          await flushBuffers();
        }
      }
      break;

    case 'barrage':
      if (state.currentSessionId) {
        barrageBuffer.push({
          userId: message.userId,
          username: message.username,
          nickname: message.nickname,
          content: message.content,
          barrageType: message.barrageType,
          timestamp: message.timestamp,
        });
        state.barrageCount++;
        recentBarrages.push({ nickname: message.nickname, content: message.content, barrageType: message.barrageType, timestamp: message.timestamp });
        if (recentBarrages.length > MAX_RECENT_ITEMS) recentBarrages.shift();
        if (barrageBuffer.length >= BUFFER_SIZE) {
          await flushBuffers();
        }
      }
      break;

    case 'linkMicBattle':
      state.currentBattle = {
        battleId: message.battleId,
        status: message.status,
        anchors: message.anchors.map(a => ({ userId: a.userId, nickname: a.nickname })),
      };
      break;
  }

  broadcastState();
}

let isDisconnecting = false; // 防止 onerror+onclose 双重触发
let awaitingDisconnectAck = false; // B6: 断开 ACK
let disconnectAckTimer: ReturnType<typeof setTimeout> | null = null;

async function handleDisconnect(
  sessionId?: number,
  reason: 'streamEnd' | 'userDisconnect' | 'transportError' | 'timeout' = 'userDisconnect',
) {
  // 防重入守卫：onerror 和 onclose 几乎同时触发时，只执行一次
  if (isDisconnecting) return;
  isDisconnecting = true;

  // B6: 清除 ACK 等待
  awaitingDisconnectAck = false;
  if (disconnectAckTimer) {
    clearTimeout(disconnectAckTimer);
    disconnectAckTimer = null;
  }

  try {
    await flushBuffers();
    stopFlushTimer();

    const targetSessionId = sessionId || state.currentSessionId;

    if (targetSessionId) {
      // B3: transport 断开不结算，标 interrupted
      const status = reason === 'transportError' ? 'interrupted' as const : 'completed' as const;
      await dbHelper.endSession(targetSessionId, status, state.likeCount, reason);
    }

    resetState();
    broadcastState();
  } finally {
    isDisconnecting = false;
  }
}

function resetState() {
  const serverOnline = ws?.readyState === WebSocket.OPEN;
  state = {
    status: serverOnline ? 'disconnected' : 'server_offline',
    username: '',
    roomId: '',
    viewerCount: 0,
    commentCount: 0,
    giftCount: 0,
    likeCount: 0,
    followCount: 0,
    shareCount: 0,
    subscribeCount: 0,
    shoppingCount: 0,
    envelopeCount: 0,
    envelopeDiamonds: 0,
    questionCount: 0,
    emoteCount: 0,
    barrageCount: 0,
    currentRank: null,
    currentBattle: null,
    topViewers: [],
    startTime: null,
    currentSessionId: null,
    errorMessage: '',
  };
  isSessionReady = false;
  eventBuffer = [];
  commentBuffer = [];
  giftBuffer = [];
  viewerCountBuffer = [];
  followBuffer = [];
  shareBuffer = [];
  subscribeBuffer = [];
  likeBuffer = [];
  shoppingBuffer = [];
  envelopeBuffer = [];
  questionBuffer = [];
  battleScoreBuffer = [];
  emoteBuffer = [];
  barrageBuffer = [];
  recentComments = [];
  recentCommentsDetail = [];
  recentShoppings = [];
  recentQuestions = [];
  recentBarrages = [];
}

let wsPingTimer: ReturnType<typeof setInterval> | null = null;

async function fetchAuthToken(): Promise<string | null> {
  try {
    // 从 wsUrl 推导 HTTP 地址获取 token
    const url = new URL(wsUrl);
    const httpUrl = `http://${url.hostname}:${url.port}/token`;
    const res = await fetch(httpUrl);
    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

async function connectToServer() {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
    return;
  }

  try {
    // 自动获取 AUTH_TOKEN 并拼接到 WS URL
    let connectUrl = wsUrl;
    const token = await fetchAuthToken();
    if (token) {
      const url = new URL(wsUrl);
      url.searchParams.set('token', token);
      connectUrl = url.toString();
    }
    ws = new WebSocket(connectUrl);
    shouldReconnect = true;

    ws.onopen = () => {
      console.log('[Background] WebSocket connected');
      if (state.status !== 'connected') {
        state.status = 'disconnected';
      }
      broadcastState();
      // B2: 每 25s 发 ping 保持连接
      wsPingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'ping' }));
        }
      }, 25000);
    };

    ws.onclose = async () => {
      console.log('[Background] WebSocket closed');
      if (wsPingTimer) { clearInterval(wsPingTimer); wsPingTimer = null; }
      // B3: transport 断开 → 标 interrupted，不结算
      if (state.currentSessionId) {
        console.warn('[Background] WebSocket closed with active session, marking interrupted');
        await handleDisconnect(undefined, 'transportError');
      } else {
        state.status = 'server_offline';
        broadcastState();
      }

      if (shouldReconnect) {
        scheduleReconnect();
      }
    };

    ws.onerror = async (error) => {
      console.error('[Background] WebSocket error:', error);
      if (wsPingTimer) { clearInterval(wsPingTimer); wsPingTimer = null; }
      // B3: transport 错误 → 标 interrupted
      if (state.currentSessionId) {
        console.warn('[Background] WebSocket error with active session, marking interrupted');
        await handleDisconnect(undefined, 'transportError');
      } else {
        state.status = 'server_offline';
        broadcastState();
      }
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data) as WsMessage;
        // B6: 收到 disconnected ACK → 执行 endSession
        if (message.type === 'disconnected' && awaitingDisconnectAck) {
          await handleDisconnect(undefined, 'userDisconnect');
          return;
        }
        // B2: pong 不需要处理
        if (message.type === 'pong') return;
        await handleWsMessage(message);
      } catch (e) {
        console.error('[Background] Failed to parse message:', e);
      }
    };
  } catch (e) {
    console.error('[Background] Failed to create WebSocket:', e);
    state.status = 'server_offline';
    broadcastState();
    scheduleReconnect();
  }
}

function disconnectFromServer() {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (wsPingTimer) {
    clearInterval(wsPingTimer);
    wsPingTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToServer();
  }, 3000);
}

function connectToLive(username: string) {
  if (ws?.readyState !== WebSocket.OPEN) {
    state.status = 'server_offline';
    broadcastState();
    return;
  }

  state.status = 'connecting';
  state.username = username;
  broadcastState();

  ws.send(JSON.stringify({ action: 'connect', username }));
}

async function disconnectFromLive(sessionId?: number) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'disconnect' }));
    // B6: 等待服务器 ACK，3s 超时兜底
    awaitingDisconnectAck = true;
    disconnectAckTimer = setTimeout(async () => {
      if (awaitingDisconnectAck) {
        console.warn('[Background] Disconnect ACK timeout (3s), force ending session');
        await handleDisconnect(sessionId, 'timeout');
      }
    }, 3000);
    return; // 等 ACK 或超时再 endSession
  }
  await handleDisconnect(sessionId, 'userDisconnect');
}

async function exportSession(): Promise<string | null> {
  if (!state.currentSessionId) return null;

  await flushBuffers();

  const session = await dbHelper.getSession(state.currentSessionId);
  if (!session) return null;

  const { comments, gifts, viewerCounts, follows, shares, subscribes, shoppings, envelopes, questions, battleScores, emotes, barrages, stats } = await dbHelper.getAllSessionData(state.currentSessionId);

  const endTime = session.endTime || new Date();
  const duration = Math.round((endTime.getTime() - session.startTime.getTime()) / 1000);

  const exportData = {
    sessionInfo: {
      username: session.username,
      roomId: session.roomId,
      startTime: session.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
    },
    statistics: {
      ...stats,
      totalLikes: state.likeCount,
    },
    comments: comments.map(c => ({
      id: c.msgId,
      userId: c.userId,
      username: c.username,
      nickname: c.nickname,
      content: c.content,
      timestamp: c.timestamp.toISOString(),
    })),
    gifts: gifts.map(g => ({
      username: g.username,
      nickname: g.nickname,
      giftName: g.giftName,
      repeatCount: g.repeatCount,
      diamondCount: g.diamondCount,
      timestamp: g.timestamp.toISOString(),
    })),
    viewerCounts: viewerCounts.map(v => ({
      count: v.count,
      topViewers: v.topViewers,
      timestamp: v.timestamp.toISOString(),
    })),
    follows: follows.map(f => ({
      username: f.uniqueId,
      nickname: f.nickname,
      timestamp: f.timestamp.toISOString(),
    })),
    shares: shares.map(s => ({
      username: s.uniqueId,
      nickname: s.nickname,
      timestamp: s.timestamp.toISOString(),
    })),
    subscribes: subscribes.map(s => ({
      username: s.uniqueId,
      nickname: s.nickname,
      subMonth: s.subMonth,
      timestamp: s.timestamp.toISOString(),
    })),
    shoppings: shoppings.map(s => ({
      productName: s.productName,
      productPrice: s.productPrice,
      shopName: s.shopName,
      timestamp: s.timestamp.toISOString(),
    })),
    envelopes: envelopes.map(e => ({
      senderNickname: e.senderNickname,
      diamondCount: e.diamondCount,
      participantCount: e.participantCount,
      timestamp: e.timestamp.toISOString(),
    })),
    questions: questions.map(q => ({
      username: q.username,
      nickname: q.nickname,
      content: q.content,
      timestamp: q.timestamp.toISOString(),
    })),
    battleScores: battleScores.map(b => ({
      battleId: b.battleId,
      battleItems: b.battleItems.map(i => ({ hostNickname: i.hostNickname, points: i.points })),
      timestamp: b.timestamp.toISOString(),
    })),
    emotes: emotes.map(e => ({
      username: e.username,
      nickname: e.nickname,
      emoteId: e.emoteId,
      timestamp: e.timestamp.toISOString(),
    })),
    barrages: barrages.map(b => ({
      username: b.username,
      nickname: b.nickname,
      content: b.content,
      barrageType: b.barrageType,
      timestamp: b.timestamp.toISOString(),
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

export default defineBackground(() => {
  console.log('TikTok Live Extension Background Script v3.0 loaded');

  // B3: SW 启动时恢复活跃 session
  async function recoverActiveSession() {
    try {
      const activeSession = await dbHelper.getActiveSession();
      if (activeSession && activeSession.id) {
        console.log('[Background] Recovering active session:', activeSession.id);
        state.currentSessionId = activeSession.id;
        state.username = activeSession.username;
        state.roomId = activeSession.roomId;
        state.startTime = activeSession.startTime.getTime();
        state.status = 'connected';
        isSessionReady = true;

        // 恢复统计计数
        const stats = await dbHelper.getSessionStats(activeSession.id);
        state.commentCount = stats.totalComments;
        state.giftCount = stats.totalGifts;
        state.followCount = stats.totalFollows;
        state.shareCount = stats.totalShares;
        state.subscribeCount = stats.totalSubscribes;
        state.likeCount = activeSession.totalLikes || 0;
        // Recover last known viewer count (not peak) for accurate current display
        const viewerRecords = await dbHelper.getViewerCountsBySession(activeSession.id);
        state.viewerCount = viewerRecords.length > 0
          ? viewerRecords[viewerRecords.length - 1].count
          : 0;
        state.shoppingCount = stats.totalShoppings;
        state.envelopeCount = stats.totalEnvelopes;
        state.envelopeDiamonds = stats.totalEnvelopeDiamonds;
        state.questionCount = stats.totalQuestions;
        state.emoteCount = stats.totalEmotes;
        state.barrageCount = stats.totalBarrages;

        stopFlushTimer();
        startFlushTimer();
        broadcastState();
      }
    } catch (e) {
      console.error('[Background] Failed to recover active session:', e);
    }
  }

  // 加载配置后恢复 session + 连接服务器
  loadConfig().then(async () => {
    await recoverActiveSession();
    connectToServer();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    switch (message.type) {
      case 'getState':
        sendResponse({ state, wsUrl, recentComments, recentCommentsDetail, recentShoppings, recentQuestions, recentBarrages });
        break;

      case 'getConfig':
        sendResponse({ wsUrl });
        break;

      case 'setConfig':
        if (!isValidWsUrl(message.wsUrl)) {
          sendResponse({ success: false, error: '无效的 WebSocket 地址，只允许 localhost 或 127.0.0.1' });
          return true;
        }
        chrome.storage.local.set({ wsUrl: message.wsUrl }).then(() => {
          wsUrl = message.wsUrl;
          // 如果当前断开，尝试重连
          if (state.status === 'server_offline' || state.status === 'disconnected') {
            disconnectFromServer();
            connectToServer();
          }
          sendResponse({ success: true, wsUrl });
        });
        return true;

      case 'connect':
        connectToLive(message.username);
        sendResponse({ success: true });
        break;

      case 'disconnect':
        disconnectFromLive(message.sessionId).then(() => {
          sendResponse({ success: true });
        });
        return true;

      case 'export':
        exportSession().then(data => {
          sendResponse({ data });
        });
        return true;

      case 'reconnectServer':
        disconnectFromServer(); // 先清理旧连接，防 CLOSING 状态下双连接
        shouldReconnect = true; // disconnectFromServer 会设为 false，这里恢复
        setTimeout(() => connectToServer(), 100);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
    return true;
  });

  chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
      if (state.status === 'connected' && ws?.readyState !== WebSocket.OPEN) {
        connectToServer();
      }
    } else if (alarm.name === 'flushBuffers') {
      flushBuffers();
    }
  });
});
