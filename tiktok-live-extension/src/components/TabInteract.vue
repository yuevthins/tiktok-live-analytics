<script setup lang="ts">
import { formatNumber, getInitial, formatTime } from '../utils/format';

const props = defineProps<{
  questionCount: number;
  emoteCount: number;
  barrageCount: number;
  currentRank: { rankType: string; rank: number } | null;
  recentQuestions: Array<{ nickname: string; content: string; timestamp: number }>;
  recentBarrages: Array<{ nickname: string; content: string; barrageType: string; timestamp: number }>;
}>();
</script>

<template>
  <div class="interact-container">
    <!-- Overview Grid -->
    <div class="overview-grid">
      <div class="overview-item overview-question">
        <div class="overview-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
          </svg>
        </div>
        <div class="overview-value">{{ formatNumber(questionCount) }}</div>
        <div class="overview-label">问答数</div>
      </div>
      <div class="overview-item overview-emote">
        <div class="overview-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
          </svg>
        </div>
        <div class="overview-value">{{ formatNumber(emoteCount) }}</div>
        <div class="overview-label">表情数</div>
      </div>
      <div class="overview-item overview-barrage">
        <div class="overview-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
          </svg>
        </div>
        <div class="overview-value">{{ formatNumber(barrageCount) }}</div>
        <div class="overview-label">VIP弹幕</div>
      </div>
    </div>

    <!-- Recent Questions -->
    <section v-if="recentQuestions.length > 0" class="list-section">
      <div class="section-header">
        <svg class="section-icon section-icon-question" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
        </svg>
        <span class="section-title">最近问答</span>
        <span class="section-count">{{ recentQuestions.length }}</span>
      </div>
      <div class="item-list">
        <div
          v-for="(q, index) in recentQuestions.slice(-10).reverse()"
          :key="`q-${q.timestamp}-${index}`"
          class="item-row"
        >
          <span class="item-avatar" :class="`avatar-${(index % 5) + 1}`">
            {{ getInitial(q.nickname) }}
          </span>
          <div class="item-body">
            <span class="item-author">{{ q.nickname }}</span>
            <span class="item-content">{{ q.content }}</span>
          </div>
          <span class="item-time">{{ formatTime(q.timestamp) }}</span>
        </div>
      </div>
    </section>

    <!-- Rank Status -->
    <section v-if="currentRank" class="rank-section">
      <div class="rank-card">
        <div class="rank-trophy">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm7 6c-1.65 0-3-1.35-3-3V5h6v6c0 1.65-1.35 3-3 3zm7-6c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
          </svg>
        </div>
        <div class="rank-info">
          <span class="rank-type">{{ currentRank.rankType }}</span>
          <span class="rank-number">#{{ currentRank.rank }}</span>
        </div>
      </div>
    </section>

    <!-- Recent Barrages -->
    <section v-if="recentBarrages.length > 0" class="list-section">
      <div class="section-header">
        <svg class="section-icon section-icon-barrage" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
        </svg>
        <span class="section-title">VIP弹幕</span>
        <span class="section-count">{{ recentBarrages.length }}</span>
      </div>
      <div class="item-list">
        <div
          v-for="(b, index) in recentBarrages.slice(-10).reverse()"
          :key="`b-${b.timestamp}-${index}`"
          class="item-row"
        >
          <span class="barrage-badge">{{ b.barrageType }}</span>
          <span class="item-avatar item-avatar-sm" :class="`avatar-${(index % 5) + 1}`">
            {{ getInitial(b.nickname) }}
          </span>
          <div class="item-body">
            <span class="item-author">{{ b.nickname }}</span>
            <span class="item-content">{{ b.content }}</span>
          </div>
          <span class="item-time">{{ formatTime(b.timestamp) }}</span>
        </div>
      </div>
    </section>

    <!-- Empty State -->
    <div
      v-if="questionCount === 0 && emoteCount === 0 && barrageCount === 0"
      class="empty-state"
    >
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
        </svg>
      </div>
      <p class="empty-text">暂无互动数据</p>
      <p class="empty-hint">连接直播间后，互动数据将在这里展示</p>
    </div>
  </div>
</template>

<style scoped>
/* ========== Container ========== */
.interact-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ========== Overview Grid ========== */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.overview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
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

.overview-icon svg {
  width: 100%;
  height: 100%;
}

.overview-question .overview-icon {
  color: var(--accent-primary);
}

.overview-emote .overview-icon {
  color: var(--accent-warning);
}

.overview-barrage .overview-icon {
  color: var(--accent-gift);
}

.overview-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
}

.overview-question .overview-value {
  color: var(--accent-primary);
}

.overview-emote .overview-value {
  color: var(--accent-warning);
}

.overview-barrage .overview-value {
  color: var(--accent-gift);
}

.overview-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-muted);
}

/* ========== Section Header ========== */
.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.section-icon {
  width: 16px;
  height: 16px;
}

.section-icon-question {
  color: var(--accent-primary);
}

.section-icon-barrage {
  color: var(--accent-gift);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.section-count {
  margin-left: auto;
  padding: 2px 8px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
}

/* ========== List Section ========== */
.list-section {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 200px;
  overflow-y: auto;
}

.item-list::-webkit-scrollbar {
  width: 4px;
}

.item-list::-webkit-scrollbar-track {
  background: transparent;
}

.item-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.item-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  animation: item-slide-in 0.3s ease-out;
}

@keyframes item-slide-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.item-avatar {
  width: 28px;
  height: 28px;
  min-width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: 600;
  color: white;
  border-radius: 50%;
}

.item-avatar-sm {
  width: 24px;
  height: 24px;
  min-width: 24px;
}

.avatar-1 { background: linear-gradient(135deg, #F97316, #EA580C); }
.avatar-2 { background: linear-gradient(135deg, #3B82F6, #2563EB); }
.avatar-3 { background: linear-gradient(135deg, #22C55E, #16A34A); }
.avatar-4 { background: linear-gradient(135deg, #A855F7, #9333EA); }
.avatar-5 { background: linear-gradient(135deg, #EC4899, #DB2777); }

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-author {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent-primary);
}

.item-content {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.4;
  word-break: break-word;
}

.item-time {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-muted);
  white-space: nowrap;
}

/* ========== Barrage Badge ========== */
.barrage-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent-gift);
  background: rgba(168, 85, 247, 0.15);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  letter-spacing: 0.02em;
}

/* ========== Rank Section ========== */
.rank-section {
  padding: 0;
}

.rank-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 179, 8, 0.08) 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.rank-trophy {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-warning);
}

.rank-trophy svg {
  width: 100%;
  height: 100%;
}

.rank-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rank-type {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.rank-number {
  font-size: var(--text-xl);
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--accent-warning);
  line-height: 1.1;
}

/* ========== Empty State ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
  margin-bottom: var(--space-3);
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-text {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--space-1);
}
</style>
