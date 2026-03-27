export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export function getInitial(name: string): string {
  if (!name) return '?';
  const char = name.charAt(0).toUpperCase();
  if (/[\u4e00-\u9fa5]/.test(char)) return char;
  if (/[A-Z]/.test(char)) return char;
  return char || '?';
}

export function formatTime(ts: number | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
