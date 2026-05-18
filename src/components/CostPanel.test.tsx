/**
 * CostPanel.test.tsx
 * 测试 Token 成本追踪面板
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CostPanel } from './CostPanel';
import { useAppStore } from '../stores/useAppStore';
import type { TokenRecord } from '../types';

// ── 工具函数 ─────────────────────────────────────────────────────────────────
function makeRecord(overrides: Partial<TokenRecord> = {}): TokenRecord {
  return {
    id: 'rec-1',
    timestamp: Date.now() - 1000,
    sessionId: 'sess-1',
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.0123,
    model: 'claude-3-opus',
    workingDirectory: '/project/myapp',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ tokenHistory: [] } as never);
});

// ─── 空状态 ───────────────────────────────────────────────────────────────────

describe('CostPanel - 空状态', () => {
  it('显示标题"Token 成本追踪"', () => {
    render(<CostPanel />);
    expect(screen.getByText('Token 成本追踪')).toBeInTheDocument();
  });

  it('空状态下显示"共 0 条记录"', () => {
    render(<CostPanel />);
    expect(screen.getByText(/共 0 条记录/)).toBeInTheDocument();
  });
});

// ─── 有记录时 ─────────────────────────────────────────────────────────────────

describe('CostPanel - 有 Token 记录', () => {
  beforeEach(() => {
    useAppStore.setState({ tokenHistory: [makeRecord()] } as never);
  });

  it('显示"共 1 条记录"', () => {
    render(<CostPanel />);
    expect(screen.getByText(/共 1 条记录/)).toBeInTheDocument();
  });

  it('显示记录中的工作目录名（最后一段）', () => {
    render(<CostPanel />);
    // 工作目录 /project/myapp → 显示 myapp（可能出现多次）
    expect(screen.getAllByText('myapp').length).toBeGreaterThan(0);
  });

  it('显示格式化后的费用', () => {
    render(<CostPanel />);
    // 费用可能出现在汇总卡片、按模型统计、按项目统计、记录行等多处
    expect(screen.getAllByText('$0.0123').length).toBeGreaterThan(0);
  });

  it('点击记录行可展开详情', () => {
    render(<CostPanel />);
    const allCostSpans = screen.getAllByText('$0.0123');
    const lastCost = allCostSpans[allCostSpans.length - 1];
    const row = lastCost.closest('div[style*="cursor: pointer"]') ?? lastCost.parentElement!;
    fireEvent.click(row);
    expect(screen.getAllByText(/输入 tokens/).length).toBeGreaterThan(0);
  });
});

// ─── 多记录 ───────────────────────────────────────────────────────────────────

describe('CostPanel - 多条记录', () => {
  beforeEach(() => {
    useAppStore.setState({
      tokenHistory: [
        makeRecord({ id: 'r1', costUsd: 0.01, model: 'claude-3-opus', workingDirectory: '/a/proj1' }),
        makeRecord({ id: 'r2', costUsd: 0.02, model: 'claude-3-sonnet', workingDirectory: '/a/proj2' }),
      ],
    } as never);
  });

  it('显示共 2 条记录', () => {
    render(<CostPanel />);
    expect(screen.getByText(/共 2 条记录/)).toBeInTheDocument();
  });

  it('显示清空按钮', () => {
    render(<CostPanel />);
    expect(screen.getByText(/清空/)).toBeInTheDocument();
  });

  it('点击清空显示确认按钮', () => {
    render(<CostPanel />);
    fireEvent.click(screen.getByText(/清空/));
    expect(screen.getByText('确认清空')).toBeInTheDocument();
  });

  it('点击取消后回到初始状态', () => {
    render(<CostPanel />);
    fireEvent.click(screen.getByText(/清空/));
    fireEvent.click(screen.getByText('取消'));
    expect(screen.queryByText('确认清空')).not.toBeInTheDocument();
  });
});

// ─── costUsd 为 0 的记录 ──────────────────────────────────────────────────────

describe('CostPanel - 零成本记录', () => {
  it('costUsd 为 0 时显示"<$0.0001"', () => {
    useAppStore.setState({ tokenHistory: [makeRecord({ costUsd: 0 })] } as never);
    render(<CostPanel />);
    expect(screen.getAllByText('<$0.0001').length).toBeGreaterThan(0);
  });

  it('costUsd 为 undefined 时显示"—"', () => {
    useAppStore.setState({ tokenHistory: [makeRecord({ costUsd: undefined })] } as never);
    render(<CostPanel />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
