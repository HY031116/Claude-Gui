/**
 * Vitest 测试环境初始化
 * 自动导入 @testing-library/jest-dom 扩展断言（toBeInTheDocument 等）
 */
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// ── 每条测试后卸载 React 树，避免跨测试污染 ──
afterEach(() => {
  cleanup();
});

// ── 过滤 act() 警告 ──────────────────────────────────────────────────────────
// 原因：mock 的 Promise 在测试断言完成后 resolve，触发 setState，
// 此时已跳出 act() 包裹，React 会发出无实质危害的警告。
// 过滤掉纯噪音，保留真正的错误信息。
const originalError = console.error.bind(console);
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((msg: unknown, ...args: unknown[]) => {
    if (typeof msg === 'string' && (
      msg.includes('act(') ||
      msg.includes('wrap-tests-with-act') ||
      msg.includes('inside a test was not wrapped in act')
    )) {
      return; // 静默 act() 噪音
    }
    originalError(msg, ...args);
  });
});

