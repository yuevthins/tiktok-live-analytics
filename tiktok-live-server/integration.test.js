import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const http = require('http');
const WebSocket = require('ws');
const { isAllowedOrigin } = require('./utils');

// 集成测试：验证 server HTTP + WebSocket 的跨模块行为
// 直接启动 HTTP server 部分（不连接 TikTok API），测试 CORS 和 WS 协议

let httpServer;
let wss;
const TEST_PORT = 13456; // 避免与实际 server 冲突
let clients = new Set();

beforeAll(async () => {
  // 启动精简版 server（只包含 HTTP + WebSocket，不含 TikTok 连接逻辑）
  httpServer = http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || 'http://localhost');
    }
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/status') {
      res.end(JSON.stringify({ connected: false, username: null, clients: clients.size }));
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  wss = new WebSocket.Server({ server: httpServer });
  wss.on('connection', (ws, req) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      ws.close(4001, 'Unauthorized origin');
      return;
    }
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'status', connected: false, username: null }));
    ws.on('close', () => clients.delete(ws));
  });

  await new Promise(resolve => httpServer.listen(TEST_PORT, resolve));
});

afterAll(async () => {
  for (const client of clients) client.close();
  clients.clear();
  wss.close();
  await new Promise(resolve => httpServer.close(resolve));
});

// Fix #5: CORS 限制集成测试 — HTTP /status endpoint
describe('HTTP CORS integration', () => {
  function fetchStatus(origin) {
    return new Promise((resolve, reject) => {
      const headers = {};
      if (origin) headers.origin = origin;
      const req = http.request({ hostname: 'localhost', port: TEST_PORT, path: '/status', headers }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  it('returns CORS header for localhost origin', async () => {
    const res = await fetchStatus('http://localhost:3456');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3456');
    expect(JSON.parse(res.body)).toHaveProperty('connected');
  });

  it('returns CORS header for chrome-extension origin', async () => {
    const res = await fetchStatus('chrome-extension://abcdef123');
    expect(res.headers['access-control-allow-origin']).toBe('chrome-extension://abcdef123');
  });

  it('does NOT return CORS header for external origin', async () => {
    const res = await fetchStatus('http://attacker.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does NOT return CORS header for localhost subdomain bypass', async () => {
    const res = await fetchStatus('http://localhost.evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

// Fix #5 + #6: WebSocket 连接集成测试
describe('WebSocket integration', () => {
  it('accepts connection from localhost origin and sends status', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`, { headers: { origin: 'http://localhost:3456' } });
    const msg = await new Promise((resolve, reject) => {
      ws.on('message', data => resolve(JSON.parse(data)));
      ws.on('error', reject);
    });
    expect(msg.type).toBe('status');
    expect(msg.connected).toBe(false);
    ws.close();
  });

  it('rejects connection from unauthorized origin with code 4001', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`, { headers: { origin: 'http://evil.com' } });
    const code = await new Promise((resolve) => {
      ws.on('close', (code) => resolve(code));
      ws.on('error', () => {}); // suppress error
    });
    expect(code).toBe(4001);
  });
});
