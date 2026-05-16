/**
 * HomeView + RulesPanel 集成测试
 * 覆盖：空状态、有数据状态、API 调用
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock
// ──────────────────────────────────────────
const mockElectronAPI = {
  selectDirectory: vi.fn().mockResolvedValue({ success: false }),
  gitStatus: vi.fn().mockResolvedValue({ success: true, files: [] }),
  listDirectory: vi.fn().mockResolvedValue({ success: true, entries: [] }),
  sessionList: vi.fn().mockResolvedValue({ success: true, sessions: [] }),
  sessionDelete: vi.fn().mockResolvedValue({ success: true }),
  sessionLoad: vi.fn().mockResolvedValue({ success: true, messages: [] }),
  loadCliConfig: vi.fn().mockResolvedValue({ success: true, config: {} }),
  saveCliConfig: vi.fn().mockResolvedValue({ success: true }),
};

const mockOnStartSession = vi.fn();

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.loadCliConfig.mockResolvedValue({ success: true, config: {} });
  mockElectronAPI.sessionList.mockResolvedValue({ success: true, sessions: [] });
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
    conversationHistory: [],
    tokenHistory: [],
    messages: [],
    workspaces: [],
    activeWorkspacePath: null,
  });
});

// ════════════════════════════════════════════
// HomeView 测试
// ════════════════════════════════════════════
describe('HomeView - 基础渲染', () => {
  it('应显示"继续任务"标题', async () => {
    const { HomeView } = await import('./task/HomeView');
    render(<HomeView onStartSession={mockOnStartSession} />);
    expect(screen.getByText('继续任务')).toBeInTheDocument();
  });

  it('无历史会话时应显示"暂无历史会话"', async () => {
    const { HomeView } = await import('./task/HomeView');
    render(<HomeView onStartSession={mockOnStartSession} />);
    expect(screen.getByText('暂无历史会话')).toBeInTheDocument();
  });

  it('应显示"新建任务"按钮', async () => {
    const { HomeView } = await import('./task/HomeView');
    render(<HomeView onStartSession={mockOnStartSession} />);
    expect(screen.getByRole('button', { name: /新建任务/ })).toBeInTheDocument();
  });

  it('点击"新建任务"按钮应调用 onStartSession', async () => {
    const { HomeView } = await import('./task/HomeView');
    render(<HomeView onStartSession={mockOnStartSession} />);

    const btn = screen.getByRole('button', { name: /新建任务/ });
    fireEvent.click(btn);

    expect(mockOnStartSession).toHaveBeenCalledTimes(1);
  });
});

describe('HomeView - 有历史会话', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversationHistory: [
        {
          sessionId: 'sess-xyz',
          workingDirectory: '/home/user/project',
          lastMessageAt: Date.now() - 7200000,
          messageCount: 12,
          preview: '重构用户认证模块',
        },
      ],
    });
  });

  it('有历史会话时不应显示"暂无历史会话"', async () => {
    const { HomeView } = await import('./task/HomeView');
    render(<HomeView onStartSession={mockOnStartSession} />);
    await waitFor(() => {
      expect(screen.queryByText('暂无历史会话')).not.toBeInTheDocument();
    });
  });

  it('应显示会话预览文字', async () => {
    const { HomeView } = await import('./task/HomeView');
    render(<HomeView onStartSession={mockOnStartSession} />);
    await waitFor(() => {
      expect(screen.getByText('重构用户认证模块')).toBeInTheDocument();
    });
  });
});

// ════════════════════════════════════════════
// RulesPanel 测试
// ════════════════════════════════════════════
describe('RulesPanel - 基础渲染', () => {
  it('应显示"权限规则管理"标题', async () => {
    const { RulesPanel } = await import('./RulesPanel');
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('权限规则管理')).toBeInTheDocument();
    });
  });

  it('加载后应显示"暂无规则"提示', async () => {
    const { RulesPanel } = await import('./RulesPanel');
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/暂无规则/)).toBeInTheDocument();
    });
  });

  it('挂载时应调用 loadCliConfig', async () => {
    const { RulesPanel } = await import('./RulesPanel');
    render(<RulesPanel />);
    await waitFor(() => {
      expect(mockElectronAPI.loadCliConfig).toHaveBeenCalled();
    });
  });

  it('应显示"添加空规则"按钮', async () => {
    const { RulesPanel } = await import('./RulesPanel');
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/添加空规则/)).toBeInTheDocument();
    });
  });
});

describe('RulesPanel - API 失败降级', () => {
  beforeEach(() => {
    mockElectronAPI.loadCliConfig.mockResolvedValue({ success: false });
  });

  it('API 失败时仍应渲染标题（不崩溃）', async () => {
    const { RulesPanel } = await import('./RulesPanel');
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('权限规则管理')).toBeInTheDocument();
    });
  });
});
