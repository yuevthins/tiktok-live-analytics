/**
 * Chart.js 配置生成器 - Bloomberg Terminal 风格
 */

export interface ViewerDataPoint {
  timestamp: string;
  count: number;
}

/**
 * 生成 Chart.js 初始化脚本
 */
export function generateChartScript(viewerCounts: ViewerDataPoint[]): string {
  const labels = viewerCounts.map(v => {
    const d = new Date(v.timestamp);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  });

  const data = viewerCounts.map(v => v.count);
  const labelsJson = JSON.stringify(labels);
  const dataJson = JSON.stringify(data);

  return `
<script>
(function() {
  function initChart() {
    const ctx = document.getElementById('viewerChart');
    if (!ctx) return;

    const labels = ${labelsJson};
    const data = ${dataJson};

    function getThemeColors() {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      return {
        line: '#ff9500',
        lineLight: '#ffaa33',
        gradient1: isLight ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255, 149, 0, 0.3)',
        gradient2: 'rgba(255, 149, 0, 0)',
        grid: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.06)',
        text: isLight ? '#6e6e73' : '#666666',
        tooltip: isLight ? '#ffffff' : '#1a1a1a',
        tooltipBorder: isLight ? '#d2d2d7' : '#2a2a2a',
        tooltipText: isLight ? '#1d1d1f' : '#e5e5e5'
      };
    }

    let colors = getThemeColors();

    // 创建渐变
    function createGradient(ctx) {
      const colors = getThemeColors();
      const gradient = ctx.createLinearGradient(0, 0, 0, 280);
      gradient.addColorStop(0, colors.gradient1);
      gradient.addColorStop(1, colors.gradient2);
      return gradient;
    }

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Viewers',
          data: data,
          borderColor: colors.line,
          backgroundColor: function(context) {
            const chart = context.chart;
            const {ctx} = chart;
            return createGradient(ctx);
          },
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: colors.line,
          pointHoverBorderColor: '#000000',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: colors.tooltip,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 0,
            displayColors: false,
            titleFont: {
              family: 'JetBrains Mono, monospace',
              size: 10,
              weight: '500'
            },
            bodyFont: {
              family: 'JetBrains Mono, monospace',
              size: 13,
              weight: '600'
            },
            callbacks: {
              title: function(items) {
                return items[0].label;
              },
              label: function(item) {
                return item.formattedValue + ' VIEWERS';
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            border: {
              display: false
            },
            ticks: {
              color: colors.text,
              font: {
                family: 'JetBrains Mono, monospace',
                size: 10
              },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            }
          },
          y: {
            beginAtZero: true,
            border: {
              display: false
            },
            grid: {
              color: colors.grid,
              drawBorder: false
            },
            ticks: {
              color: colors.text,
              font: {
                family: 'JetBrains Mono, monospace',
                size: 10
              },
              padding: 8,
              callback: function(value) {
                if (value >= 1000000) {
                  return (value / 1000000).toFixed(1) + 'M';
                } else if (value >= 1000) {
                  return (value / 1000).toFixed(1) + 'K';
                }
                return value;
              }
            }
          }
        }
      }
    });

    // 监听主题变化
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'data-theme') {
          colors = getThemeColors();
          chart.data.datasets[0].borderColor = colors.line;
          chart.data.datasets[0].pointHoverBackgroundColor = colors.line;
          chart.options.scales.x.ticks.color = colors.text;
          chart.options.scales.y.ticks.color = colors.text;
          chart.options.scales.y.grid.color = colors.grid;
          chart.options.plugins.tooltip.backgroundColor = colors.tooltip;
          chart.options.plugins.tooltip.titleColor = colors.tooltipText;
          chart.options.plugins.tooltip.bodyColor = colors.tooltipText;
          chart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
          chart.update('none');
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChart);
  } else {
    initChart();
  }
})();
</script>`;
}
