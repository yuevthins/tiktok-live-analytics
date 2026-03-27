import * as XLSX from 'xlsx';
import type { Comment, Gift, ViewerCount, Follow, Share, Subscribe, Shopping, Envelope, Question, BattleScore, EmoteRecord, Barrage } from '../types';

interface ExcelExportData {
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
    totalShoppings: number;
    totalEnvelopes: number;
    totalEnvelopeDiamonds: number;
    totalQuestions: number;
    totalEmotes: number;
    totalBarrages: number;
    peakViewers: number;
    avgViewers: number;
  };
  comments: Comment[];
  gifts: Gift[];
  viewerCounts: ViewerCount[];
  follows: Follow[];
  shares: Share[];
  subscribes: Subscribe[];
  shoppings?: Shopping[];
  envelopes?: Envelope[];
  questions?: Question[];
  battleScores?: BattleScore[];
  emotes?: EmoteRecord[];
  barrages?: Barrage[];
}

export function exportToExcel(data: ExcelExportData, filename: string): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 概览
  const overviewData = [
    ['TikTok 直播数据报告'],
    [],
    ['基本信息'],
    ['主播', data.sessionInfo.username],
    ['Room ID', data.sessionInfo.roomId],
    ['开始时间', data.sessionInfo.startTime],
    ['结束时间', data.sessionInfo.endTime],
    ['时长（秒）', data.sessionInfo.duration],
    [],
    ['统计数据'],
    ['总评论数', data.statistics.totalComments],
    ['总礼物数', data.statistics.totalGifts],
    ['总钻石数', data.statistics.totalDiamonds],
    ['总点赞数', data.statistics.totalLikes],
    ['总关注数', data.statistics.totalFollows],
    ['总分享数', data.statistics.totalShares],
    ['总订阅数', data.statistics.totalSubscribes],
    ['总商品推荐', data.statistics.totalShoppings],
    ['总红包数', data.statistics.totalEnvelopes],
    ['红包钻石总额', data.statistics.totalEnvelopeDiamonds],
    ['总问答数', data.statistics.totalQuestions],
    ['总表情数', data.statistics.totalEmotes],
    ['总VIP弹幕', data.statistics.totalBarrages],
    ['峰值观众', data.statistics.peakViewers],
    ['平均观众', data.statistics.avgViewers],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [{ wch: 15 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, '概览');

  // Sheet 2: 评论
  if (data.comments.length > 0) {
    const commentRows = data.comments.map(c => ({
      '时间': formatTime(c.timestamp),
      '用户名': c.username,
      '昵称': c.nickname,
      '评论内容': c.content,
      '用户ID': c.userId,
    }));
    const wsComments = XLSX.utils.json_to_sheet(commentRows);
    wsComments['!cols'] = [
      { wch: 20 },  // 时间
      { wch: 20 },  // 用户名
      { wch: 20 },  // 昵称
      { wch: 50 },  // 评论内容
      { wch: 20 },  // 用户ID
    ];
    XLSX.utils.book_append_sheet(wb, wsComments, '评论');
  }

  // Sheet 3: 礼物
  if (data.gifts.length > 0) {
    const giftRows = data.gifts.map(g => ({
      '时间': formatTime(g.timestamp),
      '用户名': g.username,
      '昵称': g.nickname,
      '礼物名称': g.giftName,
      '数量': g.repeatCount,
      '钻石价值': g.diamondCount * g.repeatCount,
    }));
    const wsGifts = XLSX.utils.json_to_sheet(giftRows);
    wsGifts['!cols'] = [
      { wch: 20 },  // 时间
      { wch: 20 },  // 用户名
      { wch: 20 },  // 昵称
      { wch: 15 },  // 礼物名称
      { wch: 8 },   // 数量
      { wch: 12 },  // 钻石价值
    ];
    XLSX.utils.book_append_sheet(wb, wsGifts, '礼物');
  }

  // Sheet 4: 观众数变化
  if (data.viewerCounts.length > 0) {
    const viewerRows = data.viewerCounts.map(v => ({
      '时间': formatTime(v.timestamp),
      '观众数': v.count,
    }));
    const wsViewers = XLSX.utils.json_to_sheet(viewerRows);
    wsViewers['!cols'] = [
      { wch: 20 },  // 时间
      { wch: 10 },  // 观众数
    ];
    XLSX.utils.book_append_sheet(wb, wsViewers, '观众数');
  }

  // Sheet 5: 关注
  if (data.follows.length > 0) {
    const followRows = data.follows.map(f => ({
      '时间': formatTime(f.timestamp),
      '用户名': f.uniqueId,
      '昵称': f.nickname,
    }));
    const wsFollows = XLSX.utils.json_to_sheet(followRows);
    wsFollows['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsFollows, '关注');
  }

  // Sheet 6: 分享
  if (data.shares.length > 0) {
    const shareRows = data.shares.map(s => ({
      '时间': formatTime(s.timestamp),
      '用户名': s.uniqueId,
      '昵称': s.nickname,
    }));
    const wsShares = XLSX.utils.json_to_sheet(shareRows);
    wsShares['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsShares, '分享');
  }

  // Sheet 7: 订阅
  if (data.subscribes.length > 0) {
    const subscribeRows = data.subscribes.map(s => ({
      '时间': formatTime(s.timestamp),
      '用户名': s.uniqueId,
      '昵称': s.nickname,
      '订阅月数': s.subMonth,
    }));
    const wsSubscribes = XLSX.utils.json_to_sheet(subscribeRows);
    wsSubscribes['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsSubscribes, '订阅');
  }

  // Sheet 8: 商品推荐
  if (data.shoppings && data.shoppings.length > 0) {
    const rows = data.shoppings.map(s => ({
      '时间': formatTime(s.timestamp),
      '商品名称': s.productName,
      '价格': s.productPrice,
      '店铺名': s.shopName,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '商品推荐');
  }

  // Sheet 9: 红包
  if (data.envelopes && data.envelopes.length > 0) {
    const rows = data.envelopes.map(e => ({
      '时间': formatTime(e.timestamp),
      '发送者': e.senderNickname,
      '钻石数': e.diamondCount,
      '参与人数': e.participantCount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, '红包');
  }

  // Sheet 10: 问答
  if (data.questions && data.questions.length > 0) {
    const rows = data.questions.map(q => ({
      '时间': formatTime(q.timestamp),
      '用户名': q.username,
      '昵称': q.nickname,
      '问题内容': q.content,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, '问答');
  }

  // Sheet 11: PK 积分
  if (data.battleScores && data.battleScores.length > 0) {
    const rows = data.battleScores.map(b => ({
      '时间': formatTime(b.timestamp),
      '对战ID': b.battleId,
      '队伍积分': b.battleItems.map(i => `${i.hostNickname}: ${i.points}`).join(' | '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'PK积分');
  }

  // Sheet 12: 表情
  if (data.emotes && data.emotes.length > 0) {
    const rows = data.emotes.map(e => ({
      '时间': formatTime(e.timestamp),
      '用户名': e.username,
      '昵称': e.nickname,
      '表情ID': e.emoteId,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '表情');
  }

  // Sheet 13: VIP 弹幕
  if (data.barrages && data.barrages.length > 0) {
    const rows = data.barrages.map(b => ({
      '时间': formatTime(b.timestamp),
      '类型': b.barrageType,
      '用户名': b.username,
      '昵称': b.nickname,
      '内容': b.content,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'VIP弹幕');
  }

  // 生成并下载
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function formatTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
