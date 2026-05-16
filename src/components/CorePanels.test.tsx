/**
 * CostPanel 与 HistoryPanel 集成测试
 * 覆盖：空状态渲染、数据展示、store 联动
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock
// ──────────────────────────────────────────
const mockElectronAPI = {
  loadCliHistory: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  onCliOutput: vi.fn().mockReturnValue(() => {}),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  useAppStore.setState({ conversationHistory: [], tokenHistory: [] });
});

// ──────────────────────────────────────────
// CostPanel：纯 store 驱动，无需 electronAPI
// ──────────────────────────────────────────
describe('CostPanel - 空状态', () => {
  it('tokenHistory 为空时应显示"暂无记录"提示', async () => {
    const { CostPanel } = await import('./CostPanel');
    render(<CostPanel />);

    await waitFor(() => {
      expect(screen.getByText(/暂无记录/)).toBeInTheDocument();
    });
  });

  it('tokenHistory 为空时不应显示汇总卡片', async () => {
    const { CostPanel } = await import('./CostPanel');
    render(<CostPanel />);

    await waitFor(() => {
      // 汇总卡片只在有数据时显示
      expect(screen.queryByText('今日成本')).not.toBeInTheDocument();
    });
  });

  it('标题栏始终显示"Token 成本追踪"', async () => {
    const { CostPanel } = await import('./CostPanel');
    render(<CostPanel />);

    expect(screen.getByText('Token 成本追踪')).toBeInTheDocument();
  });
});

describe('CostPanel - 有数据时', () => {
  beforeEach(() => {
    useAppStore.setState({
      tokenHistory: [
        { id: 'r1', sessionId: 's1', inputTokens: 1000, outputTokens: 500, costUsd: 0.015, model: 'claude-3-5-sonnet', timestamp: Date.now() },
        { id: 'r2', sessionId: 's2', inputTokens: 2000, outputTokens: 800, costUsd: 0.025, model: 'claude-3-5-sonnet', timestamp: Date.now() - 3600000 },
      ],
    });
  });

  it('有数据时应显示"今日成本"汇总卡片', async () => {
    const { CostPanel } = await import('./CostPanel');
    render(<CostPanel />);

    await waitFor(() => {
      expect(screen.getByText('今日成本')).toBeInTheDocument();
    });
  });

  it('有数据时应显示"累计总成本"卡片', async () => {
    const { CostPanel } = await import('./CostPanel');
    render(<CostPanel />);

    await waitFor(() => {
      expect(screen.getByText('累计总成本')).toBeInTheDocument();
    });
  });

  it('共 N 条记录文字应正确显示', async () => {
    const { CostPanel } = await import('./CostPanel');
    render(<CostPanel />);

    await waitFor(() => {
      expect(screen.getByText(/共 2 条记录/)).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// HistoryPanel：需要 loadCliHistory mock
// ──────────────────────────────────────────
describe('HistoryPanel - 无历史记录时的空状态', () => {
  it('无对话记录时应显示"暂无历史对话"', async () => {
    // loadCliHistory 失败→ cliSessions 为空；conversationHistory 也为空
    const { HistoryPanel } = await import('./HistoryPanel');
    render(<HistoryPanel />);

    // 等待 loading 结束后显示空状态
    await waitFor(() => {
      expect(screen.getByText('暂无历史对话')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('空状态时应有引导子文案', async () => {
    const { HistoryPanel } = await import('./HistoryPanel');
    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText(/完成一次对话后将自动保存在这里/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('HistoryPanel - 有对话记录时', () => {
  beforeEach(() => {
    const now = Date.now();
    useAppStore.setState({
      conversationHistory: [
        {
          sessionId: 'sess-001',
          projectDir: 'd--My-Project',
          preview: '你好，帮我写一个函数',
          startedAt: now - 3600000,
          lastMessageAt: now,
          workingDirectory: 'D:\\My Project',
        },
      ],
    });
    // loadCliHistory 成功但返回空列表
    mockElectronAPI.loadCliHistory.mockResolvedValue({ success: true, sessions: [] });
  });

  it('有历史记录时不显示"暂无历史对话"', async () => {
    const { HistoryPanel } = await import('./HistoryPanel');
    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.queryByText('暂无历史对话')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('应在项目列表中显示工作目录名称', async () => {
    const { HistoryPanel } = await import('./HistoryPanel');
    render(<HistoryPanel />);

    // "My Project" 是 D:\My Project 的最后一段
    await waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

// ──────────────────────────────────────────
// CostPanel 纯函数工具验证（通过 UI 间接）
// ──────────────────────────────────────────
describe('CostPanel - 清空操作确认流程', () => {
  beforeEach(() => {
    useAppStore.setState({
      tokenHistory: [
        { id: 'r1', sessionId: 's1', inputTokens: 100, outputTokens: 50, costUsd: 0.001, timestamp: Date.now() },
      ],
    });
  });

  it('"清空"按钮初始应为可见状态', async () => {
    const { CostPanel } = await import('./CostPanel');
    render(<CostPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /清空/ })).toBeInTheDocument();
    });
  });
});
