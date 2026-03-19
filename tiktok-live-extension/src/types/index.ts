// WebSocket 消息类型 (从服务端接收)
export interface WsStatusMessage {
  type: 'status';
  connected: boolean;
  username: string | null;
}

export interface WsConnectedMessage {
  type: 'connected';
  username: string;
  roomId: string;
  viewerCount: number;
}

export interface WsDisconnectedMessage {
  type: 'disconnected';
}

export interface WsErrorMessage {
  type: 'error';
  message: string;
}

export interface WsCommentMessage {
  type: 'comment';
  id: string;
  userId: string;
  username: string;
  nickname: string;
  comment: string;
  timestamp: number;
  profilePictureUrl?: string;
  followRole: number;
  isModerator: boolean;
  isSubscriber: boolean;
}

export interface WsGiftMessage {
  type: 'gift';
  userId: string;
  username: string;
  nickname: string;
  giftId: number;
  giftName: string;
  repeatCount: number;
  diamondCount: number;
  timestamp: number;
}

export interface WsLikeMessage {
  type: 'like';
  userId: string;
  username: string;
  nickname: string;
  likeCount: number;
  totalLikeCount: number;
  timestamp: number;
}

export interface WsRoomUserMessage {
  type: 'roomUser';
  viewerCount: number;
  topViewers: Array<{
    uniqueId: string;
    nickname: string;
    profilePictureUrl: string;
    coinCount: number;
  }>;
  timestamp: number;
}

export interface WsMemberMessage {
  type: 'member';
  userId: string;
  username: string;
  nickname: string;
  profilePictureUrl: string;
  followRole: number; // 0=不关注, 1=关注, 2=好友
  userBadges: any[];
  timestamp: number;
}

export interface WsFollowMessage {
  type: 'follow';
  userId: string;
  username: string;
  nickname: string;
  timestamp: number;
}

export interface WsShareMessage {
  type: 'share';
  userId: string;
  username: string;
  nickname: string;
  timestamp: number;
}

export interface WsSubscribeMessage {
  type: 'subscribe';
  userId: string;
  username: string;
  nickname: string;
  subMonth: number;
  timestamp: number;
}

export interface WsStreamEndMessage {
  type: 'streamEnd';
}

export interface WsPongMessage {
  type: 'pong';
}

export type WsMessage =
  | WsStatusMessage
  | WsConnectedMessage
  | WsDisconnectedMessage
  | WsErrorMessage
  | WsCommentMessage
  | WsGiftMessage
  | WsLikeMessage
  | WsRoomUserMessage
  | WsStreamEndMessage
  | WsMemberMessage
  | WsFollowMessage
  | WsShareMessage
  | WsSubscribeMessage
  | WsPongMessage;

// 数据库模型
export interface Session {
  id?: number;
  username: string;
  roomId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'error' | 'interrupted';
  disconnectReason?: 'streamEnd' | 'userDisconnect' | 'transportError' | 'timeout';
  totalLikes?: number;
}

export interface Comment {
  id?: number;
  sessionId: number;
  msgId: string;
  userId: string;
  username: string;
  nickname: string;
  content: string;
  followRole?: number;
  isModerator?: boolean;
  isSubscriber?: boolean;
  timestamp: Date;
}

export interface Gift {
  id?: number;
  sessionId: number;
  odl: string;
  username: string;
  nickname: string;
  giftName: string;
  repeatCount: number;
  diamondCount: number;
  timestamp: Date;
}

export interface ViewerCount {
  id?: number;
  sessionId: number;
  count: number;
  topViewers?: Array<{
    uniqueId: string;
    nickname: string;
    coinCount: number;
  }>;
  timestamp: Date;
}

export interface Member {
  id?: number;
  sessionId: number;
  odl: string; // uniqueId for deduplication
  uniqueId: string;
  nickname: string;
  followRole: number;
  timestamp: Date;
}

export interface Follow {
  id?: number;
  sessionId: number;
  uniqueId: string;
  nickname: string;
  timestamp: Date;
}

export interface Share {
  id?: number;
  sessionId: number;
  uniqueId: string;
  nickname: string;
  timestamp: Date;
}

export interface Subscribe {
  id?: number;
  sessionId: number;
  uniqueId: string;
  nickname: string;
  subMonth: number;
  timestamp: Date;
}

export interface Like {
  id?: number;
  sessionId: number;
  totalLikeCount: number;
  timestamp: Date;
}

// 导出格式
export interface ExportData {
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
  comments: Array<{
    id: string;
    userId: string;
    username: string;
    nickname: string;
    content: string;
    timestamp: string;
  }>;
  gifts: Array<{
    username: string;
    nickname: string;
    giftName: string;
    repeatCount: number;
    diamondCount: number;
    timestamp: string;
  }>;
  viewerCounts: Array<{
    count: number;
    topViewers?: Array<{
      uniqueId: string;
      nickname: string;
      coinCount: number;
    }>;
    timestamp: string;
  }>;
  follows: Array<{
    username: string;
    nickname: string;
    timestamp: string;
  }>;
  shares: Array<{
    username: string;
    nickname: string;
    timestamp: string;
  }>;
  subscribes: Array<{
    username: string;
    nickname: string;
    subMonth: number;
    timestamp: string;
  }>;
}

// 连接状态
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'server_offline';
