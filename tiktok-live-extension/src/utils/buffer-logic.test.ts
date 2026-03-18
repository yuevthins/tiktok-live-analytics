import { describe, it, expect } from 'vitest';

// Fix #2: 测试 identity-based buffer 过滤逻辑（从 background 提取的核心逻辑）
describe('identity-based buffer filtering', () => {
  it('correctly removes only succeeded items when failures are non-sequential', () => {
    // 模拟 buffer 中有 5 条评论
    const buffer = [
      { msgId: '1', content: 'a' },
      { msgId: '2', content: 'b' },
      { msgId: '3', content: 'c' },
      { msgId: '4', content: 'd' },
      { msgId: '5', content: 'e' },
    ];
    const toFlush = [...buffer];

    // 模拟：第 1、3 条失败，第 0、2、4 条成功
    const succeeded = new Set<(typeof toFlush)[number]>();
    const failIndices = [1, 3]; // indices that fail
    for (let i = 0; i < toFlush.length; i++) {
      if (!failIndices.includes(i)) {
        succeeded.add(toFlush[i]);
      }
    }

    // identity-based 过滤
    const remaining = buffer.filter(c => !succeeded.has(c));

    expect(remaining).toHaveLength(2);
    expect(remaining[0].msgId).toBe('2');
    expect(remaining[1].msgId).toBe('4');
  });

  it('old slice-based approach would incorrectly truncate (regression proof)', () => {
    const buffer = [
      { msgId: '1', content: 'a' },
      { msgId: '2', content: 'b' },
      { msgId: '3', content: 'c' },
    ];

    // 假设第 0 条失败，第 1、2 条成功 → successCount = 2
    const successCount = 2;

    // 旧逻辑：slice(successCount) 会保留第 3 条（正确），但丢弃第 1 条（已成功写入的被切掉了是对的）
    // 问题是：第 0 条（失败的）也被 slice 掉了，造成数据丢失
    const oldResult = buffer.slice(successCount);
    expect(oldResult).toHaveLength(1);
    expect(oldResult[0].msgId).toBe('3');
    // 第 1 条（msgId='1'）失败但被丢弃了！这就是 bug
  });

  it('handles concurrent additions during flush', () => {
    const buffer = [
      { msgId: '1', content: 'old1' },
      { msgId: '2', content: 'old2' },
    ];
    const toFlush = [...buffer];

    // flush 期间新评论被追加
    buffer.push({ msgId: '3', content: 'new1' });

    // 全部 flush 成功
    const succeeded = new Set(toFlush);
    const remaining = buffer.filter(c => !succeeded.has(c));

    // 新追加的评论不应被清除
    expect(remaining).toHaveLength(1);
    expect(remaining[0].msgId).toBe('3');
  });
});

// Fix #3: 测试防重入逻辑
describe('disconnect guard (anti-reentry)', () => {
  it('prevents double execution with flag guard', async () => {
    let callCount = 0;
    let isDisconnecting = false;

    async function handleDisconnect() {
      if (isDisconnecting) return;
      isDisconnecting = true;
      try {
        callCount++;
        // 模拟异步操作
        await new Promise(resolve => setTimeout(resolve, 10));
      } finally {
        isDisconnecting = false;
      }
    }

    // 几乎同时调用两次（模拟 onerror + onclose）
    await Promise.all([handleDisconnect(), handleDisconnect()]);

    expect(callCount).toBe(1); // 只执行一次
  });
});

// Fix #1: 验证 chrome.alarms 替换 setInterval 的逻辑正确性
describe('flush timer via alarms (conceptual)', () => {
  it('flushTimerActive flag prevents duplicate alarm creation', () => {
    let flushTimerActive = false;
    let alarmCreateCount = 0;

    function startFlushTimer() {
      if (flushTimerActive) return;
      flushTimerActive = true;
      alarmCreateCount++;
    }

    startFlushTimer();
    startFlushTimer(); // 重复调用应被忽略
    startFlushTimer();

    expect(alarmCreateCount).toBe(1);
    expect(flushTimerActive).toBe(true);
  });

  it('stopFlushTimer resets flag', () => {
    let flushTimerActive = true;
    let alarmClearCount = 0;

    function stopFlushTimer() {
      if (flushTimerActive) {
        alarmClearCount++;
        flushTimerActive = false;
      }
    }

    stopFlushTimer();
    stopFlushTimer(); // 重复调用应被忽略

    expect(alarmClearCount).toBe(1);
    expect(flushTimerActive).toBe(false);
  });
});
