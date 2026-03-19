import { describe, it, expect } from 'vitest';
const { escapeHtml, isValidUsername, isAllowedOrigin } = require('./utils');

// Fix #5: CORS — isAllowedOrigin 验证
describe('isAllowedOrigin', () => {
  it('allows chrome-extension origin', () => {
    expect(isAllowedOrigin('chrome-extension://abc123')).toBe(true);
  });

  it('allows localhost origin', () => {
    expect(isAllowedOrigin('http://localhost')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3456')).toBe(true);
  });

  it('allows 127.0.0.1 origin', () => {
    expect(isAllowedOrigin('http://127.0.0.1')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3456')).toBe(true);
  });

  it('rejects missing origin by default (non-debug)', () => {
    expect(isAllowedOrigin(undefined)).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin('')).toBe(false);
  });

  it('rejects external origins', () => {
    expect(isAllowedOrigin('http://attacker.com')).toBe(false);
    expect(isAllowedOrigin('https://evil.site')).toBe(false);
    expect(isAllowedOrigin('http://localhost.evil.com')).toBe(false);
  });
});

// Fix #5: CORS — server 使用 isAllowedOrigin 限制 CORS（集成层面由 server.js 实现）
// 这里验证核心逻辑：只有合法来源才应被允许

describe('isValidUsername', () => {
  it('accepts valid usernames', () => {
    expect(isValidUsername('user123')).toBe(true);
    expect(isValidUsername('test.user')).toBe(true);
    expect(isValidUsername('a_b')).toBe(true);
  });

  it('rejects invalid usernames', () => {
    expect(isValidUsername('')).toBe(false);
    expect(isValidUsername('a'.repeat(25))).toBe(false);
    expect(isValidUsername('user name')).toBe(false);
    expect(isValidUsername('user<script>')).toBe(false);
    expect(isValidUsername(123)).toBe(false);
    expect(isValidUsername(null)).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('handles empty/null input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
