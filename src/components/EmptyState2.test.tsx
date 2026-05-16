/**
 * 组件空状态引导集成测试（第二组）
 * 覆盖：MemoryEditPanel 无工作目录引导、ReviewView 计划审查 tab 空状态
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// 全局 electronAPI mock（无后端模拟）
// ──────────────────────────────────────────
const mockElectronAPI = {
  readFile: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  writeFile: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  listDirectory: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  onCliOutput: vi.fn().mockReturnValue(() => {}),
  loadSettings: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  getAuthStatus: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  gitStatus: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  listAgents: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  checkClaudeMem: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  // 重置 store 到默认状态
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
    messages: [],
  });
});

// ──────────────────────────────────────────
// MemoryEditPanel：无工作目录时显示引导
// ──────────────────────────────────────────
describe('MemoryEditPanel - 无工作目录时的空状态', () => {
  it('session.workingDirectory 为空时应显示引导文案', async () => {
    const { MemoryEditPanel } = await import('./MemoryEditPanel');
    render(<MemoryEditPanel />);

    await waitFor(() => {
      expect(screen.getByText('请先在委派视图中设置工作目录')).toBeInTheDocument();
    });
  });

  it('session.workingDirectory 为空时应显示"前往委派"引导按钮', async () => {
    const { MemoryEditPanel } = await import('./MemoryEditPanel');
    render(<MemoryEditPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /前往委派/ })).toBeInTheDocument();
    });
  });

  it('路径栏应显示"请先选择工作目录"占位文案', async () => {
    const { MemoryEditPanel } = await import('./MemoryEditPanel');
    render(<MemoryEditPanel />);

    await waitFor(() => {
      expect(screen.getByText('请先选择工作目录')).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// MemoryEditPanel：有工作目录时不显示引导
// ──────────────────────────────────────────
describe('MemoryEditPanel - 有工作目录时不显示空状态', () => {
  beforeEach(() => {
    useAppStore.setState({
      session: { isConnected: false, workingDirectory: 'D:\\test-project' },
    });
    // readFile 返回成功但内容为空
    mockElectronAPI.readFile.mockResolvedValue({ success: true, content: '' });
  });

  it('有工作目录时不应显示"前往委派"空状态按钮', async () => {
    const { MemoryEditPanel } = await import('./MemoryEditPanel');
    render(<MemoryEditPanel />);

    // 等待加载完成
    await waitFor(() => {
      expect(screen.queryByText('请先在委派视图中设置工作目录')).not.toBeInTheDocument();
    });
  });

  it('有工作目录时应渲染 textarea 编辑器', async () => {
    const { MemoryEditPanel } = await import('./MemoryEditPanel');
    render(<MemoryEditPanel />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// ReviewView：计划审查 tab 在无消息时显示空状态
// ──────────────────────────────────────────
describe('ReviewView - 计划审查 tab 空状态', () => {
  it('messages 为空时"计划审查"tab 内应显示"本次会话暂无执行计划"', async () => {
    const { ReviewView } = await import('./views/ReviewView');
    render(<ReviewView />);

    // 切换到"计划审查"tab（默认是"Diff 变更"）
    const planTab = screen.getByRole('button', { name: /计划审查/ });
    fireEvent.click(planTab);

    await waitFor(() => {
      expect(screen.getByText('本次会话暂无执行计划')).toBeInTheDocument();
    });
  });

  it('无执行计划时应显示"前往委派，启动会话"引导按钮', async () => {
    const { ReviewView } = await import('./views/ReviewView');
    render(<ReviewView />);

    const planTab = screen.getByRole('button', { name: /计划审查/ });
    fireEvent.click(planTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /前往委派，启动会话/ })).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// MemSearchPanel：checkClaudeMem 失败时静默降级
// ──────────────────────────────────────────
describe('MemSearchPanel - 插件检测失败时静默降级', () => {
  it('checkClaudeMem 失败后不应显示 TypeError 原始错误', async () => {
    const { MemSearchPanel } = await import('./MemSearchPanel');
    render(<MemSearchPanel />);

    await waitFor(() => {
      expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    });
  });
});
