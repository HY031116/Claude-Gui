/**
 * AgentsView 集成测试
 * 覆盖：Tab 渲染、切换、默认空状态
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock（WorktreePanel/AgentPanel 可能调用）
// ──────────────────────────────────────────
const mockElectronAPI = {
  gitWorktreeList: vi.fn().mockResolvedValue({ success: true, worktrees: [] }),
  listAgents: vi.fn().mockResolvedValue({ success: true, agents: [] }),
  deleteAgent: vi.fn().mockResolvedValue({ success: true }),
  selectDirectory: vi.fn().mockResolvedValue({ success: false }),
  gitWorktreeAdd: vi.fn().mockResolvedValue({ success: true }),
  gitWorktreeRemove: vi.fn().mockResolvedValue({ success: true }),
  gitWorktreePrune: vi.fn().mockResolvedValue({ success: true }),
  loadSettings: vi.fn().mockResolvedValue({ success: true, settings: {} }),  // AgentTeamsPanel 需要
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.gitWorktreeList.mockResolvedValue({ success: true, worktrees: [] });
  mockElectronAPI.listAgents.mockResolvedValue({ success: true, agents: [] });
  // 无工作目录：WorktreePanel 不调用 API
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
  });
});

// ──────────────────────────────────────────
// 情景 1：Tab 栏渲染
// ──────────────────────────────────────────
describe('AgentsView - Tab 渲染', () => {
  it('应渲染"Worktrees（并行会话）"tab', async () => {
    const { AgentsView } = await import('./views/AgentsView');
    render(<AgentsView />);
    expect(screen.getByRole('button', { name: /Worktrees（并行会话）/ })).toBeInTheDocument();
  });

  it('应渲染"Agent 定义"tab', async () => {
    const { AgentsView } = await import('./views/AgentsView');
    render(<AgentsView />);
    expect(screen.getByRole('button', { name: /Agent 定义/ })).toBeInTheDocument();
  });

  it('应渲染"Agent Teams"tab 并显示"实验"标签', async () => {
    const { AgentsView } = await import('./views/AgentsView');
    render(<AgentsView />);
    expect(screen.getByRole('button', { name: /Agent Teams/ })).toBeInTheDocument();
    expect(screen.getByText('实验')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────
// 情景 2：默认 Tab（worktrees）空状态
// ──────────────────────────────────────────
describe('AgentsView - Worktrees 空状态', () => {
  it('无工作目录时应显示"请先在聊天面板设置工作目录"', async () => {
    const { AgentsView } = await import('./views/AgentsView');
    render(<AgentsView />);
    await waitFor(() => {
      expect(screen.getByText('请先在聊天面板设置工作目录')).toBeInTheDocument();
    });
  });

  it('应显示"并行 Worktree 会话"章节标题', async () => {
    const { AgentsView } = await import('./views/AgentsView');
    render(<AgentsView />);
    expect(screen.getByText('并行 Worktree 会话')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────
// 情景 3：Tab 切换
// ──────────────────────────────────────────
describe('AgentsView - Tab 切换', () => {
  it('点击"Agent 定义" tab 应切换（无崩溃）', async () => {
    const { AgentsView } = await import('./views/AgentsView');
    render(<AgentsView />);

    const agentTab = screen.getByRole('button', { name: /Agent 定义/ });
    fireEvent.click(agentTab);

    await waitFor(() => {
      expect(agentTab.className).toContain('active');
    });
  });

  it('点击"Agent Teams" tab 应切换（无崩溃）', async () => {
    const { AgentsView } = await import('./views/AgentsView');
    render(<AgentsView />);

    const teamsTab = screen.getByRole('button', { name: /Agent Teams/ });
    fireEvent.click(teamsTab);

    await waitFor(() => {
      expect(teamsTab.className).toContain('active');
    });
  });
});
