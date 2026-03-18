<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { Chart, registerables } from 'chart.js';
import type { ViewerCount } from '../types';

Chart.register(...registerables);

const props = defineProps<{
  data: ViewerCount[];
  startTime: Date;
  peakValue?: number;
  isDark?: boolean;
}>();

const chartRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

// Theme-aware colors
const colors = computed(() => ({
  primary: '#3B82F6',
  primaryLight: 'rgba(59, 130, 246, 0.15)',
  primaryGlow: 'rgba(59, 130, 246, 0.05)',
  grid: props.isDark ? '#334155' : '#E2E8F0',
  text: props.isDark ? '#94A3B8' : '#64748B',
  tooltip: {
    bg: props.isDark ? '#1E293B' : '#0F172A',
    border: props.isDark ? '#475569' : '#334155',
    text: '#F8FAFC',
    accent: '#3B82F6',
  },
  peak: '#EF4444',
}));

function formatTime(date: Date): string {
  const d = new Date(date);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function renderChart() {
  if (!chartRef.value || props.data.length === 0) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = chartRef.value.getContext('2d');
  if (!ctx) return;

  const labels = props.data.map(v => formatTime(v.timestamp));
  const values = props.data.map(v => v.count);

  // Find peak index
  const peakIndex = props.peakValue
    ? values.indexOf(Math.max(...values))
    : -1;

  // Create gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 140);
  gradient.addColorStop(0, colors.value.primaryLight);
  gradient.addColorStop(1, colors.value.primaryGlow);

  // Point colors - highlight peak
  const pointBackgroundColors = values.map((_, i) =>
    i === peakIndex ? colors.value.peak : colors.value.primary
  );
  const pointRadii = values.map((_, i) =>
    i === peakIndex ? 6 : 0
  );
  const pointHoverRadii = values.map((_, i) =>
    i === peakIndex ? 8 : 4
  );

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '观众数',
        data: values,
        borderColor: colors.value.primary,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointRadius: pointRadii,
        pointHoverRadius: pointHoverRadii,
        pointBackgroundColor: pointBackgroundColors,
        pointBorderColor: pointBackgroundColors,
        pointBorderWidth: 2,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: colors.value.tooltip.bg,
          titleColor: colors.value.tooltip.text,
          bodyColor: colors.value.tooltip.accent,
          borderColor: colors.value.tooltip.border,
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: {
            size: 12,
            weight: '600',
          },
          bodyFont: {
            size: 14,
            weight: '700',
          },
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${item.formattedValue} 观众`,
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            color: colors.value.grid,
            lineWidth: 1,
          },
          border: {
            display: false,
          },
          ticks: {
            color: colors.value.text,
            font: {
              size: 10,
              family: "'JetBrains Mono', 'SF Mono', monospace",
            },
            maxTicksLimit: 5,
            padding: 4,
          },
        },
        y: {
          display: true,
          grid: {
            color: colors.value.grid,
            lineWidth: 1,
          },
          border: {
            display: false,
          },
          ticks: {
            color: colors.value.text,
            font: {
              size: 10,
              family: "'JetBrains Mono', 'SF Mono', monospace",
            },
            padding: 8,
            callback: (value) => {
              const num = Number(value);
              if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
              }
              return value;
            },
          },
          beginAtZero: true,
        },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      animation: {
        duration: 300,
      },
    },
  });
}

watch(() => [props.data, props.isDark], renderChart, { deep: true });

onMounted(() => {
  renderChart();
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>

<template>
  <div class="chart-container" :class="{ 'chart-dark': isDark }">
    <canvas ref="chartRef"></canvas>
  </div>
</template>

<style scoped>
.chart-container {
  width: 100%;
  height: 140px;
  background: var(--bg-elevated, #F1F5F9);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-3, 12px);
  border: 1px solid var(--border, #E2E8F0);
}

.chart-dark {
  background: #1E293B;
  border-color: #334155;
}
</style>
