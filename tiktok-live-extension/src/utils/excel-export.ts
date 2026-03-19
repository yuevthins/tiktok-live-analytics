import * as XLSX from 'xlsx';
import type { Comment, Gift, ViewerCount, Follow, Share, Subscribe } from '../types';

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
    peakViewers: number;
    avgViewers: number;
  };
  comments: Comment[];
  gifts: Gift[];
  viewerCounts: ViewerCount[];
  follows: Follow[];
  shares: Share[];
  subscribes: Subscribe[];
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
