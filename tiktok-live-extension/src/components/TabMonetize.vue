<script setup lang="ts">
import { formatNumber, getInitial, formatTime } from '../utils/format';

// Props from parent App.vue
const props = defineProps<{
  giftCount: number;
  envelopeCount: number;
  envelopeDiamonds: number;
  shoppingCount: number;
  topViewers: Array<{ uniqueId: string; nickname: string; coinCount: number }>;
  currentBattle: { battleId: string; status: number; anchors: Array<{ userId: string; nickname: string }> } | null;
  recentShoppings: Array<{ productName: string; productPrice: string; shopName: string; timestamp: number }>;
}>();

function battleStatusText(status: number): string {
  switch (status) {
    case 1: return 'PK 进行中';
    case 2: return 'PK 已结束';
    default: return `状态 ${status}`;
  }
}
</script>

<template>
  <div class="monetize-tab">
    <!-- 收入概览卡片 -->
    <section class="card">
      <div class="card-header">
        <h3 class="card-title">
          <svg class="title-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
          </svg>
          收入概览
        </h3>
      </div>
      <div class="card-content">
        <div class="overview-grid">
          <div class="overview-item overview-item-gift">
            <div class="overview-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
              </svg>
            </div>
            <div class="overview-value">{{ formatNumber(giftCount) }}</div>
            <div class="overview-label">礼物数</div>
          </div>
          <div class="overview-item overview-item-diamond">
            <div class="overview-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5L2 9l10 12L22 9l-3-6zM9.62 8l1.5-3h1.76l1.5 3H9.62zM11 10v6.68L5.44 10H11zm2 0h5.56L13 16.68V10zm6.26-2h-2.65l-1.5-3h2.65l1.5 3zM6.24 5h2.65l-1.5 3H4.74l1.5-3z"/>
              </svg>
            </div>
            <div class="overview-value">{{ formatNumber(envelopeDiamonds) }}</div>
            <div class="overview-label">红包钻石</div>
          </div>
          <div class="overview-item overview-item-envelope">
            <div class="overview-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>
            <div class="overview-value">{{ formatNumber(envelopeCount) }}</div>
            <div class="overview-label">红包次数</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 商品推荐列表 -->
    <section v-if="recentShoppings.length > 0" class="card">
      <div class="card-header">
        <h3 class="card-title">
          <svg class="title-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
          商品推荐
        </h3>
        <span class="card-badge">{{ recentShoppings.length }}</span>
      </div>
      <div class="card-content shopping-content">
        <div
          v-for="(item, index) in recentShoppings.slice(0, 5)"
          :key="`shop-${index}-${item.timestamp}`"
          class="shopping-item"
        >
          <div class="shopping-info">
            <span class="shopping-name">{{ item.productName }}</span>
            <span class="shopping-shop">{{ item.shopName }}</span>
          </div>
          <div class="shopping-meta">
            <span class="shopping-price">{{ item.productPrice }}</span>
            <span class="shopping-time">{{ formatTime(item.timestamp) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 贡献榜 -->
    <section v-if="topViewers.length > 0" class="card">
      <div class="card-header">
        <h3 class="card-title">
          <svg class="title-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm7 6c-1.65 0-3-1.35-3-3V5h6v6c0 1.65-1.35 3-3 3zm7-6c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
          </svg>
          贡献榜
        </h3>
      </div>
      <div class="card-content">
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
              {{ getInitial(user.nickname || user.uniqueId) }}
            </span>
            <span class="rank-name">{{ user.nickname || user.uniqueId }}</span>
            <span class="rank-coins">
              <svg class="coin-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
              {{ formatNumber(user.coinCount) }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- PK 状态 -->
    <section v-if="currentBattle" class="card card-battle">
      <div class="card-header">
        <h3 class="card-title">
          <svg class="title-icon title-icon-battle" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 16.89 19.32C18.55 17.68 19.09 15.15 18.03 13.01L17.86 12.68C17.81 12.53 17.74 12.38 17.66 11.2ZM14.5 17.5C14.22 17.74 13.76 18 13.4 18.1C12.28 18.5 11.16 17.94 10.5 17.28C11.69 17 12.4 16.12 12.61 15.23C12.78 14.43 12.46 13.77 12.33 13C12.21 12.26 12.23 11.63 12.5 10.94C12.69 11.32 12.89 11.7 13.13 12C13.9 13 15.11 13.44 15.37 14.8C15.41 14.94 15.43 15.08 15.43 15.23C15.46 16.05 15.1 16.95 14.5 17.5Z"/>
          </svg>
          PK 对战
        </h3>
        <span class="battle-status" :class="{ 'battle-live': currentBattle.status === 1 }">
          {{ battleStatusText(currentBattle.status) }}
        </span>
      </div>
      <div class="card-content">
        <div class="battle-id">
          <span class="battle-id-label">Battle ID</span>
          <span class="battle-id-value">{{ currentBattle.battleId }}</span>
        </div>
        <div v-if="currentBattle.anchors.length > 0" class="battle-anchors">
          <div class="battle-anchors-label">参战主播</div>
          <div class="battle-anchor-list">
            <div
              v-for="(anchor, index) in currentBattle.anchors"
              :key="anchor.userId"
              class="battle-anchor"
            >
              <span class="battle-anchor-avatar" :class="`avatar-${(index % 5) + 1}`">
                {{ getInitial(anchor.nickname) }}
              </span>
              <span class="battle-anchor-name">{{ anchor.nickname }}</span>
            </div>
            <div v-if="currentBattle.anchors.length >= 2" class="battle-vs">VS</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 空状态 -->
    <div
      v-if="giftCount === 0 && envelopeCount === 0 && topViewers.length === 0 && !currentBattle && recentShoppings.length === 0"
      class="empty-state"
    >
      <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
      </svg>
      <p class="empty-text">暂无变现数据</p>
      <p class="empty-hint">连接直播间后，礼物和商品数据将在此显示</p>
    </div>
  </div>
</template>

<style scoped>
.monetize-tab {
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
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.title-icon {
  width: 18px;
  height: 18px;
  color: var(--accent-gift);
}

.title-icon-battle {
  color: var(--accent-live);
}

.card-content {
  padding: var(--space-4);
}

.card-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border-radius: var(--radius-full);
}

/* ========== 收入概览 Grid ========== */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.overview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  text-align: center;
  transition: all 0.2s ease;
}

.overview-item:hover {
  background: var(--border);
}

.overview-icon {
  width: 24px;
  height: 24px;
}

.overview-item-gift .overview-icon {
  color: var(--accent-gift);
}

.overview-item-diamond .overview-icon {
  color: var(--accent-primary);
}

.overview-item-envelope .overview-icon {
  color: var(--accent-warning);
}

.overview-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
}

.overview-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-muted);
}

/* ========== 商品推荐 ========== */
.shopping-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}

.shopping-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.shopping-item:hover {
  background: var(--border);
}

.shopping-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shopping-name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shopping-shop {
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shopping-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.shopping-price {
  font-size: var(--text-sm);
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--accent-warning);
}

.shopping-time {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-muted);
}

/* ========== 贡献榜 ========== */
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

/* ========== PK 对战 ========== */
.card-battle {
  border-color: rgba(239, 68, 68, 0.3);
}

.battle-status {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.battle-status.battle-live {
  background: rgba(239, 68, 68, 0.15);
  color: var(--accent-live);
  animation: battle-pulse 2s ease-in-out infinite;
}

@keyframes battle-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.battle-id {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.battle-id-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-muted);
}

.battle-id-value {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-secondary);
  padding: 2px 6px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.battle-anchors-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: var(--space-2);
}

.battle-anchor-list {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.battle-anchor {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.battle-anchor-avatar {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: 600;
  color: white;
  border-radius: 50%;
}

.battle-anchor-name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.battle-vs {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--accent-live);
  letter-spacing: 0.05em;
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.empty-icon {
  width: 40px;
  height: 40px;
  color: var(--text-muted);
  opacity: 0.5;
  margin-bottom: var(--space-3);
}

.empty-text {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 var(--space-1);
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}
</style>
