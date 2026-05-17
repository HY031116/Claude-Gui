/**
 * WorkspaceSelector 单元测试
 * 覆盖基础渲染和下拉开关交互
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAppStore } from '../../stores/useAppStore';

const mockAPI = {
  selectDirectory: vi.fn().mockResolvedValue({ success: true, path: '/new/workspace' }),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockAPI,
  writable: true,
  configurable: true,
});

describe('WorkspaceSelector - 基础渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      workspaces: [],
      activeWorkspacePath: '',
    });
  });

  it('无工作区时显示「全部会话」', async () => {
    const { WorkspaceSelector } = await import('./WorkspaceSelector');
    render(<WorkspaceSelector />);
    expect(screen.getByText('全部会话')).toBeInTheDocument();
  });

  it('点击触发按钮应打开下拉', async () => {
    const { WorkspaceSelector } = await import('./WorkspaceSelector');
    render(<WorkspaceSelector />);

    const trigger = screen.getByRole('button', { name: /全部会话/ });
    fireEvent.click(trigger);

    await waitFor(() => {
      // 下拉打开后会出现多个「全部会话」（触发按钮 + 下拉中的选项）
      expect(screen.getAllByText('全部会话').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('有工作区时显示工作区名称', async () => {
    useAppStore.setState({
      workspaces: [{ id: 'ws-1', name: 'MyProject', path: '/my/project' }],
      activeWorkspacePath: '/my/project',
    });

    const { WorkspaceSelector } = await import('./WorkspaceSelector');
    render(<WorkspaceSelector />);

    expect(screen.getByText('MyProject')).toBeInTheDocument();
  });

  it('下拉打开后点击「全部会话」应关闭并清空激活路径', async () => {
    useAppStore.setState({
      workspaces: [{ id: 'ws-1', name: 'MyProject', path: '/my/project' }],
      activeWorkspacePath: '/my/project',
    });

    const { WorkspaceSelector } = await import('./WorkspaceSelector');
    render(<WorkspaceSelector />);

    // 打开下拉
    fireEvent.click(screen.getByText('MyProject'));

    await waitFor(() => {
      // 下拉中的全部会话按钮
      const allButtons = screen.getAllByText('全部会话');
      expect(allButtons.length).toBeGreaterThan(0);
    });

    // 点击全部会话
    fireEvent.click(screen.getAllByText('全部会话')[0]);

    await waitFor(() => {
      expect(useAppStore.getState().activeWorkspacePath).toBe('');
    });
  });
});
