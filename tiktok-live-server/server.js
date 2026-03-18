/**
 * TikTok 直播评论采集服务 v2.2
 *
 * 功能：
 * - 广播事件：comment, roomUser, gift, like, member, follow, share, subscribe
 * - 打赏榜 Top 用户 (topViewers)
 * - 连接冲突保护
 * - 支持后台持续采集
 *
 * 使用方法：
 * 1. node server.js
 * 2. 在浏览器访问 http://localhost:3456
 * 3. Chrome 扩展连接 ws://localhost:3456
 */

const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');
const http = require('http');
const { escapeHtml, isValidUsername, isAllowedOrigin } = require('./utils');

const PORT = 3456;

// 存储所有连接的客户端
const clients = new Set();

// 当前连接的直播间
let currentConnection = null;
let currentUsername = null;
let isConnecting = false;

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
      clients: clients.size,
    }));
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
          <h1>🎵 TikTok Live Server v2.2</h1>
          <div class="status ${currentConnection ? 'connected' : 'disconnected'}">
            <p><strong>状态:</strong> ${currentConnection ? '✅ 已连接 @' + safeUsername : '❌ 未连接'}</p>
            <p><strong>WebSocket:</strong> ws://localhost:${PORT}</p>
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

  console.log('[WS] 新客户端连接, origin:', origin || 'local');
  clients.add(ws);

  // 发送当前状态
  ws.send(JSON.stringify({
    type: 'status',
    connected: currentConnection !== null,
    username: currentUsername,
  }));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      console.log('[WS] 收到消息:', msg);

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

  // 安全超时：30s 内未收到 connected 事件则重置 isConnecting，防止死锁
  const connectTimeout = setTimeout(() => {
    if (isConnecting) {
      console.warn('[TikTok] 连接超时（30s），重置 isConnecting');
      isConnecting = false;
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
      console.log(`[TikTok] ✅ 已连接! Room ID: ${state.roomId}`);
      clearTimeout(connectTimeout);
      isConnecting = false;
      broadcast({
        type: 'connected',
        username,
        roomId: state.roomId,
        viewerCount: state.viewerCount,
      });
    });

    // 断开连接
    connection.on('disconnected', () => {
      console.log('[TikTok] 已断开');
      clearTimeout(connectTimeout);
      broadcast({ type: 'disconnected' });
      currentConnection = null;
      currentUsername = null;
      isConnecting = false;
    });

    // 错误
    connection.on('error', (err) => {
      console.error('[TikTok] ❌ 错误:', err.message);
      clearTimeout(connectTimeout);
      const errorMsg = err.message || '连接失败';
      // 提供更友好的错误提示
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
      broadcast({
        type: 'roomUser',
        viewerCount: data.viewerCount,
        topViewers: data.topViewers?.map(v => ({
          uniqueId: v.uniqueId,
          nickname: v.nickname,
          profilePictureUrl: v.profilePictureUrl,
          coinCount: v.coinCount,
        })) || [],
        timestamp: Date.now(),
      });
    });

    // 直播结束
    connection.on('streamEnd', () => {
      console.log('[TikTok] 📴 直播已结束');
      broadcast({ type: 'streamEnd' });
      currentConnection = null;
      currentUsername = null;
    });

    // ========== 礼物和点赞事件（广播给前端） ==========

    // 礼物
    connection.on('gift', (data) => {
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

    await connection.connect();
    currentConnection = connection;

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
  if (currentConnection) {
    console.log('[TikTok] 断开连接...');
    currentConnection.disconnect();
    currentConnection = null;
    currentUsername = null;
    broadcast({ type: 'disconnected' });
  }
}

// 启动服务器
httpServer.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🎵 TikTok 直播评论采集服务 v2.2');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  HTTP:      http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('  采集事件:');
  console.log('  - comment:   评论');
  console.log('  - roomUser:  观众数 + 打赏榜Top');
  console.log('  - gift:      礼物（含钻石价值）');
  console.log('  - like:      点赞');
  console.log('  - member:    观众进入');
  console.log('  - follow:    关注主播');
  console.log('  - share:     分享直播');
  console.log('  - subscribe: 订阅粉丝团');
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
