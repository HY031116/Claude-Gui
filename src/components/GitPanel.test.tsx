/**
 * GitPanel 测试
 * 覆盖：无工作目录提示、非 Git 仓库提示、有状态时渲染提交区
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock（GitPanel 仅 refresh 时调用）
// ──────────────────────────────────────────
const mockElectronAPI = {
  gitIsRepo: vi.fn().mockResolvedValue({ isRepo: false }),
  gitStatus: vi.fn().mockResolvedValue({ success: true, status: { staged: [], unstaged: [], untracked: [], branch: 'main', ahead: 0, behind: 0 } }),
  gitDiff: vi.fn().mockResolvedValue({ diff: '' }),
  gitAdd: vi.fn().mockResolvedValue({ success: true }),
  gitUnstage: vi.fn().mockResolvedValue({ success: true }),
  gitCommit: vi.fn().mockResolvedValue({ success: true, hash: 'abc1234' }),
  gitPush: vi.fn().mockResolvedValue({ success: true }),
  gitPull: vi.fn().mockResolvedValue({ success: true }),
  gitLog: vi.fn().mockResolvedValue({ success: true, log: [] }),
  gitCreatePR: vi.fn().mockResolvedValue({ success: false, error: '未连接' }),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.gitIsRepo.mockResolvedValue({ isRepo: false });
  mockElectronAPI.gitStatus.mockResolvedValue({ success: true, status: { staged: [], unstaged: [], untracked: [], branch: 'main', ahead: 0, behind: 0 } });
});

// ──────────────────────────────────────────
// 情景 1：无工作目录
// ──────────────────────────────────────────
describe('GitPanel - 无工作目录', () => {
  beforeEach(() => {
    useAppStore.setState({ session: { isConnected: false, workingDirectory: '' } });
  });

  it('应显示"请先选择工作目录"提示', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);
    expect(screen.getByText('请先选择工作目录')).toBeInTheDocument();
  });

  it('不应调用 gitIsRepo（cwd 为空时直接返回）', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);
    expect(mockElectronAPI.gitIsRepo).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────
// 情景 2：有工作目录但非 Git 仓库
// ──────────────────────────────────────────
describe('GitPanel - 非 Git 仓库', () => {
  beforeEach(() => {
    useAppStore.setState({ session: { isConnected: false, workingDirectory: 'D:\\My Project\\demo' } });
    mockElectronAPI.gitIsRepo.mockResolvedValue({ isRepo: false });
  });

  it('应显示"当前目录不是 Git 仓库"提示', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('当前目录不是 Git 仓库')).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// 情景 3：有工作目录且是 Git 仓库，无变更
// ──────────────────────────────────────────
describe('GitPanel - Git 仓库（无变更）', () => {
  beforeEach(() => {
    useAppStore.setState({ session: { isConnected: true, workingDirectory: 'D:\\My Project\\demo' } });
    mockElectronAPI.gitIsRepo.mockResolvedValue({ isRepo: true });
    mockElectronAPI.gitStatus.mockResolvedValue({
      success: true,
      status: { staged: [], unstaged: [], untracked: [], branch: 'main', ahead: 0, behind: 0 },
    });
  });

  it('加载后应显示分支名称"main"', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });
  });

  it('应调用 gitIsRepo 和 gitStatus', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);

    await waitFor(() => {
      expect(mockElectronAPI.gitIsRepo).toHaveBeenCalledWith('D:\\My Project\\demo');
      expect(mockElectronAPI.gitStatus).toHaveBeenCalledWith('D:\\My Project\\demo');
    });
  });
});

// ──────────────────────────────────────────
// 情景 4：有 staged 文件时提交区应激活
// ──────────────────────────────────────────
describe('GitPanel - 有 staged 变更', () => {
  beforeEach(() => {
    useAppStore.setState({ session: { isConnected: true, workingDirectory: 'D:\\My Project\\demo' } });
    mockElectronAPI.gitIsRepo.mockResolvedValue({ isRepo: true });
    mockElectronAPI.gitStatus.mockResolvedValue({
      success: true,
      status: {
        staged: [{ path: 'src/index.ts', status: 'M' }],
        unstaged: [],
        untracked: [],
        branch: 'feat/test',
        ahead: 1,
        behind: 0,
      },
    });
  });

  it('应渲染 staged 文件名（取路径最后一段）', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);

    await waitFor(() => {
      // FileRow 只渲染 path.split('/').pop()，即 "index.ts"
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// 情景 5：PR 创建流程（FEAT-511）
// ──────────────────────────────────────────
describe('GitPanel - PR 创建流程', () => {
  beforeEach(() => {
    useAppStore.setState({ session: { isConnected: true, workingDirectory: 'D:\\proj' } });
    mockElectronAPI.gitIsRepo.mockResolvedValue({ isRepo: true });
    mockElectronAPI.gitStatus.mockResolvedValue({
      success: true,
      status: { staged: [], unstaged: [], untracked: [], branch: 'feat/pr-test', ahead: 1, behind: 0 },
    });
  });

  it('显示"创建 Pull Request"按钮', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);
    await waitFor(() => {
      expect(screen.getByText(/创建 Pull Request/)).toBeInTheDocument();
    });
  });

  it('点击"创建 Pull Request"展开 PR 表单', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);
    await waitFor(() => screen.getByText(/创建 Pull Request/));

    fireEvent.click(screen.getByText(/创建 Pull Request/));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('PR 标题…')).toBeInTheDocument();
    });
  });

  it('点击"取消"收起 PR 表单', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);
    await waitFor(() => screen.getByText(/创建 Pull Request/));

    fireEvent.click(screen.getByText(/创建 Pull Request/));
    await waitFor(() => screen.getByPlaceholderText('PR 标题…'));

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('PR 标题…')).not.toBeInTheDocument();
    });
  });

  it('未填写标题时"提交 PR"按钮禁用', async () => {
    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);
    await waitFor(() => screen.getByText(/创建 Pull Request/));

    fireEvent.click(screen.getByText(/创建 Pull Request/));
    await waitFor(() => screen.getByText('提交 PR'));

    expect(screen.getByText('提交 PR').closest('button')).toBeDisabled();
  });

  it('填写标题后提交成功显示"PR 已创建"', async () => {
    mockElectronAPI.gitCreatePR.mockResolvedValue({ success: true, url: 'https://github.com/test/repo/pull/1' });

    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);
    await waitFor(() => screen.getByText(/创建 Pull Request/));

    fireEvent.click(screen.getByText(/创建 Pull Request/));
    await waitFor(() => screen.getByPlaceholderText('PR 标题…'));

    fireEvent.change(screen.getByPlaceholderText('PR 标题…'), { target: { value: 'feat: 新功能' } });

    await act(async () => {
      fireEvent.click(screen.getByText('提交 PR'));
    });

    await waitFor(() => {
      expect(mockElectronAPI.gitCreatePR).toHaveBeenCalledWith('D:\\proj', 'feat: 新功能', '');
    });
    await waitFor(() => {
      expect(screen.getByText('PR 已创建')).toBeInTheDocument();
    });
  });

  it('PR 创建失败显示错误信息', async () => {
    mockElectronAPI.gitCreatePR.mockResolvedValue({ success: false, error: 'gh 未登录' });

    const { GitPanel } = await import('./GitPanel');
    render(<GitPanel />);
    await waitFor(() => screen.getByText(/创建 Pull Request/));

    fireEvent.click(screen.getByText(/创建 Pull Request/));
    await waitFor(() => screen.getByPlaceholderText('PR 标题…'));

    fireEvent.change(screen.getByPlaceholderText('PR 标题…'), { target: { value: '错误测试' } });

    await act(async () => {
      fireEvent.click(screen.getByText('提交 PR'));
    });

    await waitFor(() => {
      expect(screen.getByText('gh 未登录')).toBeInTheDocument();
    });
  });
});
