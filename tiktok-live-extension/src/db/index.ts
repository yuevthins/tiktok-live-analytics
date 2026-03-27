import Dexie, { type Table } from 'dexie';
import type { Session, Comment, Gift, ViewerCount, Follow, Share, Subscribe, Like, Shopping, Envelope, Question, BattleScore, EmoteRecord, Barrage } from '../types';
export type { Follow, Share, Subscribe, Like, Shopping, Envelope, Question, BattleScore, EmoteRecord, Barrage };

export class TikTokLiveDB extends Dexie {
  sessions!: Table<Session, number>;
  comments!: Table<Comment, number>;
  gifts!: Table<Gift, number>;
  viewerCounts!: Table<ViewerCount, number>;
  follows!: Table<Follow, number>;
  shares!: Table<Share, number>;
  subscribes!: Table<Subscribe, number>;
  likes!: Table<Like, number>;
  shoppings!: Table<Shopping, number>;
  envelopes!: Table<Envelope, number>;
  questions!: Table<Question, number>;
  battleScores!: Table<BattleScore, number>;
  emotes!: Table<EmoteRecord, number>;
  barrages!: Table<Barrage, number>;

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
    // 版本 6: 电商/红包/问答/PK/表情/弹幕 6 张新表（Dexie 自动继承未变更的表）
    this.version(6).stores({
      shoppings: '++id, sessionId, timestamp',
      envelopes: '++id, sessionId, &[sessionId+envelopeId], timestamp',
      questions: '++id, sessionId, &[sessionId+questionId], timestamp',
      battleScores: '++id, sessionId, battleId, timestamp',
      emotes: '++id, sessionId, timestamp',
      barrages: '++id, sessionId, timestamp',
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

  // ========== 新增表 CRUD（v6） ==========

  async addShopping(sessionId: number, data: {
    productName: string; productPrice: string; shopName: string; productImageUrl?: string; timestamp: number;
  }): Promise<number> {
    return await db.shoppings.add({
      sessionId, productName: data.productName, productPrice: data.productPrice,
      shopName: data.shopName, productImageUrl: data.productImageUrl,
      timestamp: new Date(data.timestamp),
    });
  },

  async addEnvelope(sessionId: number, data: {
    envelopeId: string; senderNickname: string; diamondCount: number; participantCount: number; timestamp: number;
  }): Promise<number> {
    return await db.envelopes.add({
      sessionId, envelopeId: data.envelopeId, senderNickname: data.senderNickname,
      diamondCount: data.diamondCount, participantCount: data.participantCount,
      timestamp: new Date(data.timestamp),
    });
  },

  async addQuestion(sessionId: number, data: {
    questionId: string; userId: string; username: string; nickname: string; content: string; timestamp: number;
  }): Promise<number> {
    return await db.questions.add({
      sessionId, questionId: data.questionId, userId: data.userId,
      username: data.username, nickname: data.nickname, content: data.content,
      timestamp: new Date(data.timestamp),
    });
  },

  async addBattleScore(sessionId: number, data: {
    battleId: string; battleItems: Array<{ hostUserId: string; hostNickname: string; points: number }>; timestamp: number;
  }): Promise<number> {
    return await db.battleScores.add({
      sessionId, battleId: data.battleId, battleItems: data.battleItems,
      timestamp: new Date(data.timestamp),
    });
  },

  async addEmote(sessionId: number, data: {
    userId: string; username: string; nickname: string; emoteId: string; emoteImageUrl?: string; timestamp: number;
  }): Promise<number> {
    return await db.emotes.add({
      sessionId, userId: data.userId, username: data.username,
      nickname: data.nickname, emoteId: data.emoteId, emoteImageUrl: data.emoteImageUrl,
      timestamp: new Date(data.timestamp),
    });
  },

  async addBarrage(sessionId: number, data: {
    userId: string; username: string; nickname: string; content: string; barrageType: string; timestamp: number;
  }): Promise<number> {
    return await db.barrages.add({
      sessionId, userId: data.userId, username: data.username,
      nickname: data.nickname, content: data.content, barrageType: data.barrageType,
      timestamp: new Date(data.timestamp),
    });
  },

  async getShoppingsBySession(sessionId: number): Promise<Shopping[]> {
    return await db.shoppings.where('sessionId').equals(sessionId).toArray();
  },
  async getEnvelopesBySession(sessionId: number): Promise<Envelope[]> {
    return await db.envelopes.where('sessionId').equals(sessionId).toArray();
  },
  async getQuestionsBySession(sessionId: number): Promise<Question[]> {
    return await db.questions.where('sessionId').equals(sessionId).toArray();
  },
  async getBattleScoresBySession(sessionId: number): Promise<BattleScore[]> {
    return await db.battleScores.where('sessionId').equals(sessionId).toArray();
  },
  async getEmotesBySession(sessionId: number): Promise<EmoteRecord[]> {
    return await db.emotes.where('sessionId').equals(sessionId).toArray();
  },
  async getBarragesBySession(sessionId: number): Promise<Barrage[]> {
    return await db.barrages.where('sessionId').equals(sessionId).toArray();
  },

  // 一次性获取会话所有数据（供导出使用）
  async getAllSessionData(sessionId: number) {
    const [comments, gifts, viewerCounts, follows, shares, subscribes, shoppings, envelopes, questions, battleScores, emotes, barrages, stats] = await Promise.all([
      this.getCommentsBySession(sessionId),
      this.getGiftsBySession(sessionId),
      this.getViewerCountsBySession(sessionId),
      this.getFollowsBySession(sessionId),
      this.getSharesBySession(sessionId),
      this.getSubscribesBySession(sessionId),
      this.getShoppingsBySession(sessionId),
      this.getEnvelopesBySession(sessionId),
      this.getQuestionsBySession(sessionId),
      this.getBattleScoresBySession(sessionId),
      this.getEmotesBySession(sessionId),
      this.getBarragesBySession(sessionId),
      this.getSessionStats(sessionId),
    ]);
    return { comments, gifts, viewerCounts, follows, shares, subscribes, shoppings, envelopes, questions, battleScores, emotes, barrages, stats };
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
    totalShoppings: number;
    totalEnvelopes: number;
    totalEnvelopeDiamonds: number;
    totalQuestions: number;
    totalEmotes: number;
    totalBarrages: number;
    peakViewers: number;
    avgViewers: number;
  }> {
    const q = (table: typeof db.comments) => table.where('sessionId').equals(sessionId);

    const [totalComments, giftRows, totalFollows, totalShares, totalSubscribes,
           viewerRows, totalShoppings, envelopeRows, totalQuestions, totalEmotes, totalBarrages] = await Promise.all([
      q(db.comments).count(),
      q(db.gifts).toArray(),
      q(db.follows).count(),
      q(db.shares).count(),
      q(db.subscribes).count(),
      q(db.viewerCounts).toArray(),
      q(db.shoppings).count(),
      q(db.envelopes).toArray(),
      q(db.questions).count(),
      q(db.emotes).count(),
      q(db.barrages).count(),
    ]);

    const totalGifts = giftRows.length;
    const totalDiamonds = giftRows.reduce((sum, g) => sum + (g.diamondCount || 0) * (g.repeatCount || 1), 0);

    const totalEnvelopes = envelopeRows.length;
    const totalEnvelopeDiamonds = envelopeRows.reduce((sum, e) => sum + (e.diamondCount || 0), 0);

    let peakViewers = 0;
    let totalViewers = 0;
    let viewerRecords = 0;
    for (const record of viewerRows) {
      const count = record.count;
      if (typeof count === 'number' && !isNaN(count)) {
        viewerRecords++;
        totalViewers += count;
        if (count > peakViewers) peakViewers = count;
      }
    }
    const avgViewers = viewerRecords > 0 ? Math.round(totalViewers / viewerRecords) : 0;

    return {
      totalComments,
      totalGifts,
      totalDiamonds,
      totalFollows,
      totalShares,
      totalSubscribes,
      totalShoppings,
      totalEnvelopes,
      totalEnvelopeDiamonds,
      totalQuestions,
      totalEmotes,
      totalBarrages,
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
    await db.transaction('rw', [db.sessions, db.comments, db.gifts, db.viewerCounts, db.follows, db.shares, db.subscribes, db.likes, db.shoppings, db.envelopes, db.questions, db.battleScores, db.emotes, db.barrages], async () => {
      await db.comments.where('sessionId').equals(sessionId).delete();
      await db.gifts.where('sessionId').equals(sessionId).delete();
      await db.viewerCounts.where('sessionId').equals(sessionId).delete();
      await db.follows.where('sessionId').equals(sessionId).delete();
      await db.shares.where('sessionId').equals(sessionId).delete();
      await db.subscribes.where('sessionId').equals(sessionId).delete();
      await db.likes.where('sessionId').equals(sessionId).delete();
      await db.shoppings.where('sessionId').equals(sessionId).delete();
      await db.envelopes.where('sessionId').equals(sessionId).delete();
      await db.questions.where('sessionId').equals(sessionId).delete();
      await db.battleScores.where('sessionId').equals(sessionId).delete();
      await db.emotes.where('sessionId').equals(sessionId).delete();
      await db.barrages.where('sessionId').equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    });
  },

  // 清除所有数据（事务化，防止中途崩溃导致数据不一致）
  async clearAll(): Promise<void> {
    await db.transaction('rw', [db.sessions, db.comments, db.gifts, db.viewerCounts, db.follows, db.shares, db.subscribes, db.likes, db.shoppings, db.envelopes, db.questions, db.battleScores, db.emotes, db.barrages], async () => {
      await db.sessions.clear();
      await db.comments.clear();
      await db.gifts.clear();
      await db.viewerCounts.clear();
      await db.follows.clear();
      await db.shares.clear();
      await db.subscribes.clear();
      await db.likes.clear();
      await db.shoppings.clear();
      await db.envelopes.clear();
      await db.questions.clear();
      await db.battleScores.clear();
      await db.emotes.clear();
      await db.barrages.clear();
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
