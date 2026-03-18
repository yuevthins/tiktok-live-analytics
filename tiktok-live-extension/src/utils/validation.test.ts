import { describe, it, expect } from 'vitest';
import { isValidWsUrl } from './validation';

// Fix #4: wsUrl 安全校验
describe('isValidWsUrl', () => {
  it('accepts ws://localhost', () => {
    expect(isValidWsUrl('ws://localhost')).toBe(true);
    expect(isValidWsUrl('ws://localhost/')).toBe(true);
  });

  it('accepts ws://localhost with port', () => {
    expect(isValidWsUrl('ws://localhost:3456')).toBe(true);
    expect(isValidWsUrl('ws://localhost:3456/')).toBe(true);
  });

  it('accepts ws://127.0.0.1', () => {
    expect(isValidWsUrl('ws://127.0.0.1')).toBe(true);
    expect(isValidWsUrl('ws://127.0.0.1:3456')).toBe(true);
  });

  it('accepts wss:// (secure WebSocket)', () => {
    expect(isValidWsUrl('wss://localhost:3456')).toBe(true);
    expect(isValidWsUrl('wss://127.0.0.1:3456')).toBe(true);
  });

  it('rejects external URLs', () => {
    expect(isValidWsUrl('ws://attacker.com')).toBe(false);
    expect(isValidWsUrl('ws://evil.localhost')).toBe(false);
    expect(isValidWsUrl('ws://127.0.0.2:3456')).toBe(false);
  });

  it('rejects non-ws protocols', () => {
    expect(isValidWsUrl('http://localhost:3456')).toBe(false);
    expect(isValidWsUrl('ftp://localhost')).toBe(false);
  });

  it('rejects URLs with paths', () => {
    expect(isValidWsUrl('ws://localhost:3456/evil')).toBe(false);
    expect(isValidWsUrl('ws://localhost/path/to/something')).toBe(false);
  });

  it('rejects empty/malformed input', () => {
    expect(isValidWsUrl('')).toBe(false);
    expect(isValidWsUrl('not-a-url')).toBe(false);
    expect(isValidWsUrl('ws://')).toBe(false);
  });
});
