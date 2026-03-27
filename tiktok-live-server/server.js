/**
 * TikTok 直播评论采集服务 v3.0
 *
 * 功能：
 * - 广播事件：comment, roomUser, gift, like, member, follow, share, subscribe
 * - 打赏榜 Top 用户 (topViewers)
 * - 连接冲突保护
 * - 支持后台持续采集
 * - AUTH_TOKEN 连接验证（扩展通过 /token 端点自动获取）
 *
 * 使用方法：
 * 1. node server.js
 * 2. 在浏览器访问 http://127.0.0.1:3456
 * 3. Chrome 扩展自动连接 ws://127.0.0.1:3456?token=xxx
 */

const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const { escapeHtml, isValidUsername, isAllowedOrigin } = require('./utils');

const PORT = 3456;
const AUTH_TOKEN = crypto.randomUUID();

// 存储所有连接的客户端
const clients = new Set();

// 当前连接的直播间
let currentConnection = null;
let currentUsername = null;
let isConnecting = false;
let currentConnectionToken = null;
let currentRoomId = null;
let currentViewerCount = 0;
let connectionStartTime = null;
let connectTimeout = null;

// 创建 HTTP 服务器（用于状态查询）
const httpServer = http.createServer((req, res) => {
  // 安全：限制 CORS 为 localhost，防止任意网页读取状态
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || 'http://localhost');
  }
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/status') {
    res.end(JSON.stringify({
      connected: currentConnection !== null,
      username: currentUsername,
      roomId: currentRoomId,
      viewerCount: currentViewerCount,
      startTime: connectionStartTime,
      clients: clients.size,
    }));
  } else if (req.url === '/token') {
    // 扩展自动获取 token（受 origin 检查保护）
    res.end(JSON.stringify({ token: AUTH_TOKEN }));
  } else if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // 使用 escapeHtml 防止 XSS
    const safeUsername = escapeHtml(currentUsername);
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>TikTok Live Server</title>
          <style>
            body { font-family: -apple-system, sans-serif; padding: 20px; background: #1a1a2e; color: #fff; }
            .status { padding: 10px; border-radius: 8px; margin: 10px 0; }
            .connected { background: #2d5a2d; }
            .disconnected { background: #5a2d2d; }
          </style>
        </head>
        <body>
          <h1>🎵 TikTok Live Server v2.3</h1>
          <div class="status ${currentConnection ? 'connected' : 'disconnected'}">
            <p><strong>状态:</strong> ${currentConnection ? '✅ 已连接 @' + safeUsername : '❌ 未连接'}</p>
            <p><strong>WebSocket:</strong> ws://127.0.0.1:${PORT}?token=...</p>
            <p><strong>客户端数:</strong> ${clients.size}</p>
          </div>
        </body>
      </html>
    `);
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws, req) => {
  // 验证来源
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    console.warn(`[WS] 拒绝未授权来源: ${origin}`);
    ws.close(4001, 'Unauthorized origin');
    return;
  }

  // 校验 AUTH_TOKEN
  const reqUrl = new URL(req.url, 'ws://localhost');
  if (reqUrl.searchParams.get('token') !== AUTH_TOKEN) {
    console.warn('[WS] 拒绝无效 token');
    ws.close(4003, 'Invalid token');
    return;
  }

  if (clients.size >= 10) {
    ws.close(4004, 'Too many clients');
    return;
  }
  console.log('[WS] 新客户端连接, origin:', origin || 'local');
  clients.add(ws);

  // 发送当前状态（含 roomId/viewerCount/startTime）
  ws.send(JSON.stringify({
    type: 'status',
    connected: currentConnection !== null,
    username: currentUsername,
    roomId: currentRoomId,
    viewerCount: currentViewerCount,
    startTime: connectionStartTime,
  }));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      console.log(`[WS] 收到动作: ${msg.action || msg.type || 'unknown'}`);

      switch (msg.action) {
        case 'connect':
          // 验证用户名格式
          if (!isValidUsername(msg.username)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: '无效的用户名格式，只允许字母、数字、下划线和点',
            }));
            return;
          }
          await connectToLive(msg.username, ws);
          break;
        case 'disconnect':
          disconnectFromLive();
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (e) {
      console.error('[WS] 消息处理错误:', e);
    }
  });

  ws.on('close', () => {
    console.log('[WS] 客户端断开');
    clients.delete(ws);
  });
});

// 广播消息给所有客户端
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 连接到直播间
async function connectToLive(username, requestingClient) {
  // 防止重复连接
  if (isConnecting) {
    console.log('[TikTok] 已有连接请求进行中，忽略');
    if (requestingClient) {
      requestingClient.send(JSON.stringify({
        type: 'error',
        message: '已有连接请求进行中，请稍后再试',
      }));
    }
    return;
  }

  // 如果已连接到同一个用户，返回当前状态
  if (currentConnection && currentUsername === username) {
    console.log(`[TikTok] 已连接到 @${username}，返回当前状态`);
    return;
  }

  // 如果已连接到其他用户，先断开
  if (currentConnection) {
    console.log(`[TikTok] 已连接到 @${currentUsername}，切换到 @${username}`);
    disconnectFromLive();
  }

  isConnecting = true;
  console.log(`[TikTok] 连接到 @${username}...`);
  currentUsername = username;

  // A2: 连接 Token 化 — 防止旧连接事件泄漏到新 session
  const connectionToken = Date.now();
  currentConnectionToken = connectionToken;

  // 安全超时：30s 内未收到 connected 事件则重置 isConnecting，防止死锁
  connectTimeout = setTimeout(() => {
    if (isConnecting) {
      console.warn('[TikTok] 连接超时（30s），重置 isConnecting');
      isConnecting = false;
      // A3: 超时时显式断开残留连接
      if (currentConnection) {
        currentConnection.disconnect();
        currentConnection = null;
      }
      broadcast({ type: 'error', message: '连接超时，请重试' });
    }
  }, 30000);

  try {
    const connection = new WebcastPushConnection(username, {
      processInitialData: true,
      enableExtendedGiftInfo: true, // 需要礼物详情（diamondCount）
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 2000,
    });

    // 连接成功
    connection.on('connected', (state) => {
      if (connectionToken !== currentConnectionToken) return;
      console.log(`[TikTok] ✅ 已连接! Room ID: ${state.roomId}`);
      clearTimeout(connectTimeout);
      isConnecting = false;
      currentRoomId = state.roomId;
      currentViewerCount = state.viewerCount;
      connectionStartTime = Date.now();
      broadcast({
        type: 'connected',
        username,
        roomId: state.roomId,
        viewerCount: state.viewerCount,
      });
    });

    // 断开连接
    connection.on('disconnected', () => {
      if (connectionToken !== currentConnectionToken) return;
      console.log('[TikTok] 已断开');
      clearTimeout(connectTimeout);
      broadcast({ type: 'disconnected' });
      currentConnection = null;
      currentUsername = null;
      currentConnectionToken = null;
      currentRoomId = null;
      currentViewerCount = 0;
      connectionStartTime = null;
      isConnecting = false;
    });

    // 错误
    connection.on('error', (err) => {
      if (connectionToken !== currentConnectionToken) return;
      console.error('[TikTok] ❌ 错误:', err.message);
      clearTimeout(connectTimeout);
      const errorMsg = err.message || '连接失败';
      let friendlyMsg = errorMsg;
      if (errorMsg.includes('LIVE has ended') || errorMsg.includes('not found')) {
        friendlyMsg = '直播间未开播或用户不存在';
      } else if (errorMsg.includes('Failed to fetch')) {
        friendlyMsg = '网络连接失败，请检查网络';
      }
      broadcast({ type: 'error', message: friendlyMsg });
      isConnecting = false;
    });

    // ========== 核心事件（广播给前端） ==========

    // 聊天评论
    connection.on('chat', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const comment = {
        type: 'comment',
        id: data.msgId,
        userId: data.userId,
        username: data.uniqueId,
        nickname: data.nickname,
        comment: data.comment,
        timestamp: Date.now(),
        followRole: data.followRole,
        isModerator: data.isModerator,
        isSubscriber: data.isSubscriber,
      };
      console.log(`[评论] ${comment.nickname}: ${comment.comment}`);
      broadcast(comment);
    });

    // 观众数更新（含打赏榜 Top 用户）
    connection.on('roomUser', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      currentViewerCount = data.viewerCount;
      broadcast({
        type: 'roomUser',
        viewerCount: data.viewerCount,
        topViewers: data.topViewers?.map(v => ({
          uniqueId: v.user?.uniqueId || '',
          nickname: v.user?.nickname || '',
          profilePictureUrl: v.user?.profilePictureUrl || '',
          coinCount: v.coinCount || 0,
        })) || [],
        timestamp: Date.now(),
      });
    });

    // 直播结束
    connection.on('streamEnd', () => {
      if (connectionToken !== currentConnectionToken) return;
      console.log('[TikTok] 📴 直播已结束');
      broadcast({ type: 'streamEnd' });
      currentConnection = null;
      currentUsername = null;
      currentConnectionToken = null;
      currentRoomId = null;
      currentViewerCount = 0;
      connectionStartTime = null;
    });

    // ========== 礼物和点赞事件（广播给前端） ==========

    // 礼物
    connection.on('gift', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      // giftType 1 是连续礼物，只在 repeatEnd 时发送
      if (data.giftType === 1 && !data.repeatEnd) return;
      console.log(`[礼物] ${data.nickname} 送出 ${data.giftName} x${data.repeatCount} (${data.diamondCount} 钻)`);
      broadcast({
        type: 'gift',
        userId: data.userId,
        username: data.uniqueId,
        nickname: data.nickname,
        giftId: data.giftId,
        giftName: data.giftName,
        repeatCount: data.repeatCount,
        diamondCount: data.diamondCount,
        timestamp: Date.now(),
      });
    });

    // 点赞
    connection.on('like', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      broadcast({
        type: 'like',
        userId: data.userId,
        username: data.uniqueId,
        nickname: data.nickname,
        likeCount: data.likeCount,
        totalLikeCount: data.totalLikeCount,
        timestamp: Date.now(),
      });
    });

    // ========== 用户行为事件（广播给前端） ==========

    // 用户进入直播间
    connection.on('member', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      broadcast({
        type: 'member',
        userId: data.userId,
        username: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        followRole: data.followRole, // 0=不关注, 1=关注, 2=好友
        userBadges: data.userBadges,
        timestamp: Date.now(),
      });
    });

    // 分享直播间
    connection.on('share', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      console.log(`[分享] ${data.nickname} 分享了直播间`);
      broadcast({
        type: 'share',
        userId: data.userId,
        username: data.uniqueId,
        nickname: data.nickname,
        timestamp: Date.now(),
      });
    });

    // 关注主播
    connection.on('follow', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      console.log(`[关注] ${data.nickname} 关注了主播`);
      broadcast({
        type: 'follow',
        userId: data.userId,
        username: data.uniqueId,
        nickname: data.nickname,
        timestamp: Date.now(),
      });
    });

    // 订阅（付费粉丝团）
    connection.on('subscribe', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      console.log(`[订阅] ${data.nickname} 订阅了粉丝团 (${data.subMonth}个月)`);
      broadcast({
        type: 'subscribe',
        userId: data.userId,
        username: data.uniqueId,
        nickname: data.nickname,
        subMonth: data.subMonth,
        timestamp: Date.now(),
      });
    });

    // ========== Tier 1: 电商/红包/排名事件 ==========

    // 商品推荐
    connection.on('oecLiveShopping', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const shopData = data.shopData || data;
      console.log(`[商品] ${shopData.title || shopData.productName || '未知商品'}`);
      broadcast({
        type: 'oecLiveShopping',
        productName: shopData.title || shopData.productName || '',
        productPrice: shopData.price || shopData.priceStr || '',
        shopName: shopData.shopName || '',
        productImageUrl: shopData.imageUrl || '',
        timestamp: Date.now(),
      });
    });

    // 红包/宝箱
    connection.on('envelope', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const info = data.envelopeInfo || data;
      console.log(`[红包] ${info.sendUserNickname || '未知'} 发了 ${info.diamondCount || 0} 钻红包`);
      broadcast({
        type: 'envelope',
        envelopeId: String(info.envelopeId || info.id || Date.now()),
        senderUserId: String(info.sendUserId || ''),
        senderNickname: info.sendUserNickname || '',
        diamondCount: info.diamondCount || 0,
        participantCount: info.pilotLampNum || info.participantCount || 0,
        timestamp: Date.now(),
      });
    });

    // 小时榜
    connection.on('hourlyRank', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      broadcast({
        type: 'hourlyRank',
        rankType: data.rankType || '',
        rank: data.rank || 0,
        timestamp: Date.now(),
      });
    });

    // 排名更新
    connection.on('rankUpdate', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const updates = (data.updatesList || data.updates || []).map(u => ({
        rankType: u.rankType || '',
        rank: u.rank || 0,
      }));
      broadcast({
        type: 'rankUpdate',
        updates,
        timestamp: Date.now(),
      });
    });

    // 排名文本
    connection.on('rankText', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      broadcast({
        type: 'rankText',
        text: data.text || data.scene?.content || '',
        timestamp: Date.now(),
      });
    });

    // ========== Tier 2: PK/问答/表情/弹幕事件 ==========

    // 观众提问
    connection.on('questionNew', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const details = data.details || data;
      console.log(`[问答] ${details.nickname || details.user?.nickname || '未知'}: ${details.text || details.content || ''}`);
      broadcast({
        type: 'questionNew',
        questionId: String(details.questionId || details.id || Date.now()),
        userId: String(details.userId || details.user?.userId || ''),
        username: details.uniqueId || details.user?.uniqueId || '',
        nickname: details.nickname || details.user?.nickname || '',
        content: details.text || details.content || '',
        timestamp: Date.now(),
      });
    });

    // PK 军团积分
    connection.on('linkMicArmies', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const rawItems = data.battleItems || {};
      const itemsList = Array.isArray(rawItems) ? rawItems : Object.values(rawItems);
      const battleItems = itemsList.map((item) => ({
        odl: String(item.hostUserId || ''),
        hostUserId: String(item.hostUserId || ''),
        hostNickname: item.hostNickname || '',
        points: item.points || 0,
      }));
      console.log(`[PK积分] battleId=${data.battleId || ''} items=${battleItems.length}`);
      broadcast({
        type: 'linkMicArmies',
        battleId: String(data.battleId || ''),
        battleItems,
        timestamp: Date.now(),
      });
    });

    // 表情聊天
    connection.on('emote', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const user = data.user || data;
      broadcast({
        type: 'emote',
        userId: String(user.userId || ''),
        username: user.uniqueId || '',
        nickname: user.nickname || '',
        emoteId: String(data.emoteId || (data.emoteList && data.emoteList[0]?.emoteId) || ''),
        emoteImageUrl: data.emoteImageUrl || (data.emoteList && data.emoteList[0]?.emoteImageUrl) || '',
        timestamp: Date.now(),
      });
    });

    // VIP 弹幕
    connection.on('barrage', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const event = data.event || data;
      const contentKey = data.content?.key || data.commonBarrageContent?.key || '';
      console.log(`[弹幕] ${event.nickname || event.user?.nickname || '未知'}: ${contentKey}`);
      broadcast({
        type: 'barrage',
        userId: String(event.userId || event.user?.userId || ''),
        username: event.uniqueId || event.user?.uniqueId || '',
        nickname: event.nickname || event.user?.nickname || '',
        content: contentKey,
        barrageType: String(data.type || data.barrageType || ''),
        timestamp: Date.now(),
      });
    });

    // PK 对战状态
    connection.on('linkMicBattle', (data) => {
      if (connectionToken !== currentConnectionToken) return;
      const anchors = [];
      if (data.anchorInfo) {
        for (const [, info] of Object.entries(data.anchorInfo)) {
          anchors.push({
            userId: String(info.userId || ''),
            nickname: info.nickname || '',
            profilePictureUrl: info.profilePictureUrl || '',
          });
        }
      }
      console.log(`[PK对战] battleId=${data.battleId || ''} status=${data.status || 0} anchors=${anchors.length}`);
      broadcast({
        type: 'linkMicBattle',
        battleId: String(data.battleId || ''),
        status: data.status || 0,
        anchors,
        timestamp: Date.now(),
      });
    });

    currentConnection = connection;
    await connection.connect();

  } catch (err) {
    console.error('[TikTok] ❌ 连接失败:', err.message);
    clearTimeout(connectTimeout);
    const errorMsg = err.message || '连接失败';
    let friendlyMsg = errorMsg;
    if (errorMsg.includes('LIVE has ended') || errorMsg.includes('not found')) {
      friendlyMsg = '直播间未开播或用户不存在';
    } else if (errorMsg.includes('Failed to fetch')) {
      friendlyMsg = '网络连接失败，请检查网络';
    }
    broadcast({ type: 'error', message: friendlyMsg });
    currentConnection = null;
    currentUsername = null;
    isConnecting = false;
  }
}

// 断开直播间连接
function disconnectFromLive() {
  isConnecting = false;
  if (connectTimeout) {
    clearTimeout(connectTimeout);
    connectTimeout = null;
  }
  if (currentConnection) {
    console.log('[TikTok] 断开连接...');
    // A2: 先失效 token，防止旧事件泄漏
    currentConnectionToken = null;
    currentConnection.disconnect();
    currentConnection = null;
    currentUsername = null;
    currentRoomId = null;
    currentViewerCount = 0;
    connectionStartTime = null;
    broadcast({ type: 'disconnected' });
  }
}

// 启动服务器（绑定 127.0.0.1，仅本机可访问）
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🎵 TikTok 直播评论采集服务 v3.0');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  HTTP:      http://127.0.0.1:${PORT}`);
  console.log(`  WebSocket: ws://127.0.0.1:${PORT}?token=${AUTH_TOKEN}`);
  console.log(`  Token:     ${AUTH_TOKEN}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('  基础事件:');
  console.log('  - comment / roomUser / gift / like / member');
  console.log('  - follow / share / subscribe');
  console.log('  Tier 1 (电商/红包/排名):');
  console.log('  - oecLiveShopping / envelope');
  console.log('  - hourlyRank / rankUpdate / rankText');
  console.log('  Tier 2 (PK/问答/表情/弹幕):');
  console.log('  - questionNew / linkMicArmies / emote');
  console.log('  - barrage / linkMicBattle');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  等待 Chrome 扩展连接...');
  console.log('');
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  disconnectFromLive();
  wss.close();
  httpServer.close();
  process.exit(0);
});
