/**
 * 安全：只允许 localhost/127.0.0.1 的 WebSocket URL
 */
export function isValidWsUrl(url: string): boolean {
  return /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url);
}
