/**
 * ArtifactsView.test.tsx
 * 测试 ArtifactsView：Tab 切换 + ChangeHistoryPanel（FEAT-513）
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ─── Mock electronAPI ─────────────────────────────────────────────────────────
const mockElectronAPI = {
  gitIsRepo: vi.fn().mockResolvedValue({ isRepo: false }),
  gitStatus: vi.fn().mockResolvedValue({ success: true, status: { staged: [], unstaged: [], untracked: [], branch: 'main', ahead: 0, behind: 0 } }),
  gitDiff: vi.fn().mockResolvedValue({ diff: '' }),
  gitAdd: vi.fn().mockResolvedValue({ success: true }),
  gitUnstage: vi.fn().mockResolvedValue({ success: true }),
  gitCommit: vi.fn().mockResolvedValue({ success: true }),
  gitPush: vi.fn().mockResolvedValue({ success: true }),
  gitPull: vi.fn().mockResolvedValue({ success: true }),
  gitLog: vi.fn().mockResolvedValue({ success: true, log: [] }),
  gitCreatePR: vi.fn().mockResolvedValue({ success: false, error: '未连接' }),
  listDir: vi.fn().mockResolvedValue({ success: true, entries: [] }),
  getConversationHistory: vi.fn().mockResolvedValue({ success: true, conversations: [] }),
  loadCost: vi.fn().mockResolvedValue({ success: false }),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.gitIsRepo.mockResolvedValue({ isRepo: false });
  mockElectronAPI.gitStatus.mockResolvedValue({ success: true, status: { staged: [], unstaged: [], untracked: [], branch: 'main', ahead: 0, behind: 0 } });
  mockElectronAPI.listDir.mockResolvedValue({ success: true, entries: [] });
  mockElectronAPI.getConversationHistory.mockResolvedValue({ success: true, conversations: [] });
  mockElectronAPI.loadCost.mockResolvedValue({ success: false });
  useAppStore.getState().clearMessages();
  useAppStore.setState({ session: { isConnected: false, workingDirectory: '/proj' } });
});

// ─── 辅助：构造 Write toolCall 消息 ──────────────────────────────────────────

function makeWriteMsg(id: string, filePath: string) {
  return {
    id,
    role: 'assistant' as const,
    content: '',
    timestamp: Date.now(),
    toolCalls: [
      {
        id: `tc-${id}`,
        name: 'Write',
        arguments: { file_path: filePath, content: '新内容' },
        status: 'success' as const,
        originalContent: '旧内容',
      },
    ],
  };
}

// ─── Tab 基础渲染 ─────────────────────────────────────────────────────────────

describe('ArtifactsView - Tab 切换', () => {
  it('默认显示"AI 产物"Tab', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    // AI Tab 应该是激活状态
    expect(screen.getByRole('button', { name: /AI 产物/ })).toBeInTheDocument();
  });

  it('包含"变更历史"Tab 按钮', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    expect(screen.getByRole('button', { name: /变更历史/ })).toBeInTheDocument();
  });

  it('点击"变更历史"Tab 切换到 ChangeHistoryPanel', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);

    fireEvent.click(screen.getByRole('button', { name: /变更历史/ }));

    await waitFor(() => {
      expect(screen.getByText('暂无文件变更记录')).toBeInTheDocument();
    });
  });
});

// ─── ChangeHistoryPanel 空状态 ────────────────────────────────────────────────

describe('ChangeHistoryPanel - 空状态', () => {
  it('无 Write/Edit 消息时显示"暂无文件变更记录"', async () => {
    useAppStore.getState().clearMessages();

    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    fireEvent.click(screen.getByRole('button', { name: /变更历史/ }));

    await waitFor(() => {
      expect(screen.getByText('暂无文件变更记录')).toBeInTheDocument();
    });
  });

  it('有普通文本消息但无工具调用时仍显示空状态', async () => {
    useAppStore.getState().addMessage({
      id: 'text-msg',
      role: 'user',
      content: '普通文本',
      timestamp: Date.now(),
    });

    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    fireEvent.click(screen.getByRole('button', { name: /变更历史/ }));

    await waitFor(() => {
      expect(screen.getByText('暂无文件变更记录')).toBeInTheDocument();
    });
  });
});

// ─── ChangeHistoryPanel 有记录 ───────────────────────────────────────────────

describe('ChangeHistoryPanel - 有记录', () => {
  it('单条 Write 消息显示"1 批次"', async () => {
    useAppStore.getState().addMessage(makeWriteMsg('w1', '/proj/src/App.tsx'));

    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    fireEvent.click(screen.getByRole('button', { name: /变更历史/ }));

    await waitFor(() => {
      expect(screen.getByText(/变更历史（1 批次）/)).toBeInTheDocument();
    });
  });

  it('两条 Write 消息显示"2 批次"', async () => {
    useAppStore.getState().addMessage(makeWriteMsg('w2', '/proj/a.ts'));
    useAppStore.getState().addMessage(makeWriteMsg('w3', '/proj/b.ts'));

    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    fireEvent.click(screen.getByRole('button', { name: /变更历史/ }));

    await waitFor(() => {
      expect(screen.getByText(/变更历史（2 批次）/)).toBeInTheDocument();
    });
  });

  it('每批次显示正确的文件数', async () => {
    useAppStore.getState().addMessage({
      id: 'multi',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolCalls: [
        { id: 'tc1', name: 'Write', arguments: { file_path: '/proj/a.ts', content: '...' }, status: 'success', originalContent: '' },
        { id: 'tc2', name: 'Write', arguments: { file_path: '/proj/b.ts', content: '...' }, status: 'success', originalContent: '' },
      ],
    });

    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    fireEvent.click(screen.getByRole('button', { name: /变更历史/ }));

    await waitFor(() => {
      expect(screen.getByText(/2 个文件变更/)).toBeInTheDocument();
    });
  });

  it('点击批次标题展开文件列表', async () => {
    useAppStore.getState().addMessage(makeWriteMsg('expand1', '/proj/src/utils.ts'));

    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    fireEvent.click(screen.getByRole('button', { name: /变更历史/ }));

    await waitFor(() => screen.getByText(/1 个文件变更/));

    // 初始折叠：不显示完整路径
    expect(screen.queryByText(/utils\.ts.*写入/)).not.toBeInTheDocument();

    // 点击展开
    fireEvent.click(screen.getByText(/1 个文件变更/));

    // 展开后应显示文件名（basename 结果）
    await waitFor(() => {
      expect(screen.getByText('utils.ts')).toBeInTheDocument();
    });
  });
});
