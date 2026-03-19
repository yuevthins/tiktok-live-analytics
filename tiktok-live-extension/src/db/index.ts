import Dexie, { type Table } from 'dexie';
import type { Session, Comment, Gift, ViewerCount, Follow, Share, Subscribe, Like } from '../types';
export type { Follow, Share, Subscribe, Like };

export class TikTokLiveDB extends Dexie {
  sessions!: Table<Session, number>;
  comments!: Table<Comment, number>;
  gifts!: Table<Gift, number>;
  viewerCounts!: Table<ViewerCount, number>;
  follows!: Table<Follow, number>;
  shares!: Table<Share, number>;
  subscribes!: Table<Subscribe, number>;
  likes!: Table<Like, number>;

  constructor() {
    super('TikTokLiveDB');
    // 版本 3: 添加 gifts 表
    this.version(3).stores({
      sessions: '++id, username, roomId, status, startTime',
      comments: '++id, sessionId, &[sessionId+msgId], timestamp',
      gifts: '++id, sessionId, timestamp',
      viewerCounts: '++id, sessionId, timestamp',
    });
    // 版本 4: 添加 follows, shares, subscribes 表
    this.version(4).stores({
      sessions: '++id, username, roomId, status, startTime',
      comments: '++id, sessionId, &[sessionId+msgId], timestamp',
      gifts: '++id, sessionId, timestamp',
      viewerCounts: '++id, sessionId, timestamp',
      follows: '++id, sessionId, timestamp',
      shares: '++id, sessionId, timestamp',
      subscribes: '++id, sessionId, timestamp',
    });
    // 版本 5: 去重索引 + likes 表 + comments 角色字段
    this.version(5).stores({
      sessions: '++id, username, roomId, status, startTime',
      comments: '++id, sessionId, &[sessionId+msgId], timestamp',
      gifts: '++id, sessionId, &[sessionId+odl], timestamp',
      viewerCounts: '++id, sessionId, timestamp',
      follows: '++id, sessionId, &[sessionId+uniqueId], timestamp',
      shares: '++id, sessionId, &[sessionId+uniqueId], timestamp',
      subscribes: '++id, sessionId, &[sessionId+uniqueId], timestamp',
      likes: '++id, sessionId, timestamp',
    });
  }
}

export const db = new TikTokLiveDB();

// 数据库操作辅助函数
export const dbHelper = {
  // 创建新会话
  async createSession(username: string, roomId: string): Promise<number> {
    return await db.sessions.add({
      username,
      roomId,
      startTime: new Date(),
      status: 'active',
    });
  },

  // 结束会话
  async endSession(
    sessionId: number,
    status: 'completed' | 'error' | 'interrupted' = 'completed',
    totalLikes?: number,
    disconnectReason?: 'streamEnd' | 'userDisconnect' | 'transportError' | 'timeout',
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      endTime: new Date(),
      status,
    };
    if (totalLikes !== undefined) {
      updateData.totalLikes = totalLikes;
    }
    if (disconnectReason) {
      updateData.disconnectReason = disconnectReason;
    }
    await db.sessions.update(sessionId, updateData);
  },

  // 添加评论（带去重）
  async addComment(sessionId: number, data: {
    msgId: string;
    userId: string;
    username: string;
    nickname: string;
    content: string;
    timestamp: number;
  }): Promise<number | null> {
    try {
      return await db.comments.add({
        sessionId,
        msgId: data.msgId,
        userId: data.userId,
        username: data.username,
        nickname: data.nickname,
        content: data.content,
        timestamp: new Date(data.timestamp),
      });
    } catch (e) {
      if ((e as any)?.name === 'ConstraintError') {
        return null;
      }
      throw e;
    }
  },

  // 添加礼物
  async addGift(sessionId: number, data: {
    odl: string;
    username: string;
    nickname: string;
    giftName: string;
    repeatCount: number;
    diamondCount: number;
    timestamp: number;
  }): Promise<number> {
    return await db.gifts.add({
      sessionId,
      odl: data.odl,
      username: data.username,
      nickname: data.nickname,
      giftName: data.giftName,
      repeatCount: data.repeatCount,
      diamondCount: data.diamondCount,
      timestamp: new Date(data.timestamp),
    });
  },

  // 添加观众数记录
  async addViewerCount(sessionId: number, count: number, timestamp: number): Promise<number> {
    return await db.viewerCounts.add({
      sessionId,
      count,
      timestamp: new Date(timestamp),
    });
  },

  // 获取会话的所有评论
  async getCommentsBySession(sessionId: number): Promise<Comment[]> {
    return await db.comments.where('sessionId').equals(sessionId).toArray();
  },

  // 获取会话的所有礼物
  async getGiftsBySession(sessionId: number): Promise<Gift[]> {
    return await db.gifts.where('sessionId').equals(sessionId).toArray();
  },

  // 获取会话的所有观众数记录
  async getViewerCountsBySession(sessionId: number): Promise<ViewerCount[]> {
    return await db.viewerCounts.where('sessionId').equals(sessionId).toArray();
  },

  // 添加关注记录
  async addFollow(sessionId: number, data: {
    uniqueId: string;
    nickname: string;
    timestamp: number;
  }): Promise<number> {
    return await db.follows.add({
      sessionId,
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      timestamp: new Date(data.timestamp),
    });
  },

  // 添加分享记录
  async addShare(sessionId: number, data: {
    uniqueId: string;
    nickname: string;
    timestamp: number;
  }): Promise<number> {
    return await db.shares.add({
      sessionId,
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      timestamp: new Date(data.timestamp),
    });
  },

  // 添加订阅记录
  async addSubscribe(sessionId: number, data: {
    uniqueId: string;
    nickname: string;
    subMonth: number;
    timestamp: number;
  }): Promise<number> {
    return await db.subscribes.add({
      sessionId,
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      subMonth: data.subMonth,
      timestamp: new Date(data.timestamp),
    });
  },

  // 获取会话的所有关注记录
  async getFollowsBySession(sessionId: number): Promise<Follow[]> {
    return await db.follows.where('sessionId').equals(sessionId).toArray();
  },

  // 获取会话的所有分享记录
  async getSharesBySession(sessionId: number): Promise<Share[]> {
    return await db.shares.where('sessionId').equals(sessionId).toArray();
  },

  // 获取会话的所有订阅记录
  async getSubscribesBySession(sessionId: number): Promise<Subscribe[]> {
    return await db.subscribes.where('sessionId').equals(sessionId).toArray();
  },

  // 获取会话的所有点赞记录
  async getLikesBySession(sessionId: number): Promise<Like[]> {
    return await db.likes.where('sessionId').equals(sessionId).toArray();
  },

  // 获取会话
  async getSession(sessionId: number): Promise<Session | undefined> {
    return await db.sessions.get(sessionId);
  },

  // 获取活跃会话
  async getActiveSession(): Promise<Session | undefined> {
    return await db.sessions.where('status').equals('active').first();
  },

  // 获取会话统计（优化版）
  async getSessionStats(sessionId: number): Promise<{
    totalComments: number;
    totalGifts: number;
    totalDiamonds: number;
    totalFollows: number;
    totalShares: number;
    totalSubscribes: number;
    peakViewers: number;
    avgViewers: number;
  }> {
    const totalComments = await db.comments.where('sessionId').equals(sessionId).count();

    // 礼物统计：totalGifts = 礼物记录条数（送了几次），totalDiamonds = 钻石总价值
    const totalGifts = await db.gifts.where('sessionId').equals(sessionId).count();
    let totalDiamonds = 0;
    await db.gifts.where('sessionId').equals(sessionId).each(gift => {
      const count = gift.repeatCount || 1;
      const diamonds = gift.diamondCount || 0;
      totalDiamonds += diamonds * count;
    });

    // 新增统计
    const totalFollows = await db.follows.where('sessionId').equals(sessionId).count();
    const totalShares = await db.shares.where('sessionId').equals(sessionId).count();
    const totalSubscribes = await db.subscribes.where('sessionId').equals(sessionId).count();

    // 观众数统计
    let peakViewers = 0;
    let totalViewers = 0;
    let viewerRecords = 0;

    await db.viewerCounts.where('sessionId').equals(sessionId).each(record => {
      const count = record.count;
      if (typeof count === 'number' && !isNaN(count)) {
        viewerRecords++;
        totalViewers += count;
        if (count > peakViewers) {
          peakViewers = count;
        }
      }
    });

    const avgViewers = viewerRecords > 0 ? Math.round(totalViewers / viewerRecords) : 0;

    return {
      totalComments,
      totalGifts,
      totalDiamonds,
      totalFollows,
      totalShares,
      totalSubscribes,
      peakViewers,
      avgViewers,
    };
  },

  // 获取所有会话
  async getAllSessions(): Promise<Session[]> {
    return await db.sessions.orderBy('startTime').reverse().toArray();
  },

  // 删除会话及其数据
  async deleteSession(sessionId: number): Promise<void> {
    await db.transaction('rw', [db.sessions, db.comments, db.gifts, db.viewerCounts, db.follows, db.shares, db.subscribes, db.likes], async () => {
      await db.comments.where('sessionId').equals(sessionId).delete();
      await db.gifts.where('sessionId').equals(sessionId).delete();
      await db.viewerCounts.where('sessionId').equals(sessionId).delete();
      await db.follows.where('sessionId').equals(sessionId).delete();
      await db.shares.where('sessionId').equals(sessionId).delete();
      await db.subscribes.where('sessionId').equals(sessionId).delete();
      await db.likes.where('sessionId').equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    });
  },

  // 清除所有数据（事务化，防止中途崩溃导致数据不一致）
  async clearAll(): Promise<void> {
    await db.transaction('rw', [db.sessions, db.comments, db.gifts, db.viewerCounts, db.follows, db.shares, db.subscribes, db.likes], async () => {
      await db.sessions.clear();
      await db.comments.clear();
      await db.gifts.clear();
      await db.viewerCounts.clear();
      await db.follows.clear();
      await db.shares.clear();
      await db.subscribes.clear();
      await db.likes.clear();
    });
  },

  // 获取去重的历史用户名（按最近使用排序）
  async getDistinctUsernames(limit = 10): Promise<string[]> {
    const sessions = await db.sessions
      .orderBy('startTime')
      .reverse()
      .toArray();
    const seen = new Set<string>();
    const result: string[] = [];
    for (const session of sessions) {
      if (session.username && !seen.has(session.username)) {
        seen.add(session.username);
        result.push(session.username);
        if (result.length >= limit) break;
      }
    }
    return result;
  },
};
