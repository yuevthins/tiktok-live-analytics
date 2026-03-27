import { dbHelper } from '../db';
import type { ExportData } from '../types';

export async function exportSessionToJson(sessionId: number): Promise<void> {
  const session = await dbHelper.getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const { comments, gifts, viewerCounts, follows, shares, subscribes, shoppings, envelopes, questions, battleScores, emotes, barrages, stats } = await dbHelper.getAllSessionData(sessionId);

  const endTime = session.endTime || new Date();
  const duration = Math.round((endTime.getTime() - session.startTime.getTime()) / 1000);

  const exportData: ExportData = {
    sessionInfo: {
      username: session.username,
      roomId: session.roomId,
      startTime: session.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
    },
    statistics: {
      ...stats,
      totalLikes: session.totalLikes || 0, // P1: 从 session 获取持久化的点赞数
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
      productName: s.productName, productPrice: s.productPrice, shopName: s.shopName,
      timestamp: s.timestamp.toISOString(),
    })),
    envelopes: envelopes.map(e => ({
      senderNickname: e.senderNickname, diamondCount: e.diamondCount, participantCount: e.participantCount,
      timestamp: e.timestamp.toISOString(),
    })),
    questions: questions.map(q => ({
      username: q.username, nickname: q.nickname, content: q.content,
      timestamp: q.timestamp.toISOString(),
    })),
    battleScores: battleScores.map(b => ({
      battleId: b.battleId, battleItems: b.battleItems.map(i => ({ hostNickname: i.hostNickname, points: i.points })),
      timestamp: b.timestamp.toISOString(),
    })),
    emotes: emotes.map(e => ({
      username: e.username, nickname: e.nickname, emoteId: e.emoteId,
      timestamp: e.timestamp.toISOString(),
    })),
    barrages: barrages.map(b => ({
      username: b.username, nickname: b.nickname, content: b.content, barrageType: b.barrageType,
      timestamp: b.timestamp.toISOString(),
    })),
  };

  // 创建下载
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `tiktok-live-${session.username}-${session.startTime.toISOString().slice(0, 10)}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
