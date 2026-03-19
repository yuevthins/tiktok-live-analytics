/**
 * 安全工具函数（从 server.js 提取，便于单元测试）
 */

/**
 * HTML 转义，防止 XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 验证 TikTok 用户名格式
 * 规则：只允许字母、数字、下划线和点，长度 1-24
 */
function isValidUsername(username) {
  if (typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_.]{1,24}$/.test(username);
}

/**
 * 验证请求来源（允许 Chrome 扩展和本地访问）
 * - 无 origin 默认拒绝（除非 --debug 模式）
 * - 支持 ALLOWED_EXTENSION_ID 环境变量精确匹配扩展 ID
 */
function isAllowedOrigin(origin) {
  const debugMode = process.argv.includes('--debug');
  if (!origin) return debugMode; // 无 origin 仅 debug 模式放行
  try {
    const url = new URL(origin);
    // Chrome 扩展：支持 ALLOWED_EXTENSION_ID 环境变量精确匹配
    if (url.protocol === 'chrome-extension:') {
      const allowedId = process.env.ALLOWED_EXTENSION_ID;
      if (allowedId) return url.hostname === allowedId;
      return true; // 未配置则放行所有扩展
    }
    return (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
           (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

module.exports = { escapeHtml, isValidUsername, isAllowedOrigin };
