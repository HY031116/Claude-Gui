/**
 * SmallComponents.test.tsx
 * 覆盖 UpdateBanner / StatusBar / AuxPanel / ShortcutsModal 等小型组件
 * 补充覆盖率，冲刺 35%
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../stores/useAppStore';

// ─── UpdateBanner 测试 ────────────────────────────────────────────────────────
describe('UpdateBanner', () => {
  beforeEach(() => {
    // 确保 electronAPI 中不包含 onUpdateStatus（让组件走 return null 路径）
    (window as unknown as Record<string, unknown>).electronAPI = {
      onUpdateStatus: undefined,
    };
  });

  it('无 onUpdateStatus 时不渲染任何内容', async () => {
    const { UpdateBanner } = await import('./UpdateBanner');
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('有 onUpdateStatus 且状态为 available 时显示版本信息', async () => {
    let capturedCallback: ((s: { type: string; version?: string }) => void) | null = null;
    (window as unknown as Record<string, unknown>).electronAPI = {
      onUpdateStatus: vi.fn((cb: (s: { type: string; version?: string }) => void) => {
        capturedCallback = cb;
        return () => {}; // 取消订阅函数
      }),
      downloadUpdate: vi.fn().mockResolvedValue({}),
    };
    const { UpdateBanner } = await import('./UpdateBanner');
    render(<UpdateBanner />);
    // 触发回调
    capturedCallback!({ type: 'available', version: '5.0.0' });
    // 等 React 重新渲染（act 已被 @testing-library 自动包裹）
    expect(await screen.findByText(/v5\.0\.0/)).toBeInTheDocument();
  });

  it('available 状态下点击"下载"应调用 downloadUpdate', async () => {
    const mockDownload = vi.fn().mockResolvedValue({});
    let capturedCallback: ((s: { type: string; version?: string }) => void) | null = null;
    (window as unknown as Record<string, unknown>).electronAPI = {
      onUpdateStatus: vi.fn((cb: (s: { type: string; version?: string }) => void) => {
        capturedCallback = cb;
        return () => {};
      }),
      downloadUpdate: mockDownload,
    };
    const { UpdateBanner } = await import('./UpdateBanner');
    render(<UpdateBanner />);
    capturedCallback!({ type: 'available', version: '5.0.0' });
    const dlBtn = await screen.findByRole('button', { name: '下载' });
    fireEvent.click(dlBtn);
    expect(mockDownload).toHaveBeenCalled();
  });

  it('点击关闭按钮应隐藏横幅', async () => {
    let capturedCallback: ((s: { type: string; version?: string }) => void) | null = null;
    (window as unknown as Record<string, unknown>).electronAPI = {
      onUpdateStatus: vi.fn((cb: (s: { type: string; version?: string }) => void) => {
        capturedCallback = cb;
        return () => {};
      }),
    };
    const { UpdateBanner } = await import('./UpdateBanner');
    render(<UpdateBanner />);
    capturedCallback!({ type: 'available', version: '5.0.0' });
    await screen.findByRole('alert');
    fireEvent.click(screen.getByLabelText('关闭'));
    // 横幅消失
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── StatusBar 测试 ───────────────────────────────────────────────────────────
describe('StatusBar', () => {
  beforeEach(() => {
    // 模拟 Electron 环境（有 electronAPI）
    (window as unknown as Record<string, unknown>).electronAPI = {};
    useAppStore.setState({
      session: { isConnected: false, workingDirectory: '' },
      tokenUsage: null,
    } as Parameters<typeof useAppStore.setState>[0]);
  });

  it('未连接时应显示"未连接"', async () => {
    const { StatusBar } = await import('./layout/StatusBar');
    render(<StatusBar />);
    expect(screen.getByText('未连接')).toBeInTheDocument();
  });

  it('已连接时应显示"已连接"', async () => {
    useAppStore.setState({
      session: { isConnected: true, workingDirectory: '/project' },
    } as Parameters<typeof useAppStore.setState>[0]);
    const { StatusBar } = await import('./layout/StatusBar');
    render(<StatusBar />);
    expect(screen.getByText('已连接')).toBeInTheDocument();
  });
});

// ─── ShortcutsModal 测试 ──────────────────────────────────────────────────────
describe('ShortcutsModal', () => {
  it('应渲染快捷键标题', async () => {
    const { ShortcutsModal } = await import('./layout/ShortcutsModal');
    const onClose = vi.fn();
    render(<ShortcutsModal onClose={onClose} />);
    expect(screen.getByText(/快捷键一览/)).toBeInTheDocument();
  });

  it('应渲染快捷键列表（至少包含 Ctrl+K）', async () => {
    const { ShortcutsModal } = await import('./layout/ShortcutsModal');
    const onClose = vi.fn();
    render(<ShortcutsModal onClose={onClose} />);
    expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
    expect(screen.getByText(/打开命令面板/)).toBeInTheDocument();
  });

  it('点击关闭按钮应调用 onClose', async () => {
    const { ShortcutsModal } = await import('./layout/ShortcutsModal');
    const onClose = vi.fn();
    render(<ShortcutsModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('按 Escape 键应调用 onClose', async () => {
    const { ShortcutsModal } = await import('./layout/ShortcutsModal');
    const onClose = vi.fn();
    render(<ShortcutsModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应调用 onClose', async () => {
    const { ShortcutsModal } = await import('./layout/ShortcutsModal');
    const onClose = vi.fn();
    render(<ShortcutsModal onClose={onClose} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击 modal 内容区不应触发关闭', async () => {
    const { ShortcutsModal } = await import('./layout/ShortcutsModal');
    const onClose = vi.fn();
    render(<ShortcutsModal onClose={onClose} />);
    // 点击内部 kbd 元素（stopPropagation 已阻止冒泡至 overlay）
    fireEvent.click(screen.getByText('Ctrl+K'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── AuxPanel 测试 ────────────────────────────────────────────────────────────
describe('AuxPanel', () => {
  const mockProps = {
    width: 280,
    onResizeMouseDown: vi.fn(),
  };

  beforeEach(() => {
    (window as unknown as Record<string, unknown>).electronAPI = {
      loadCliConfig: vi.fn().mockResolvedValue({ success: true, settings: {} }),
      getAuthStatus: vi.fn().mockResolvedValue({ success: true, authStatus: { loggedIn: false } }),
      gitStatus: vi.fn().mockResolvedValue({ success: true, status: null }),
      gitIsRepo: vi.fn().mockResolvedValue({ isRepo: false }),
    };
  });

  it('非 dispatch 模式下应不渲染（返回 null）', async () => {
    useAppStore.setState({ activeNavSection: 'monitor' } as Parameters<typeof useAppStore.setState>[0]);
    const { AuxPanel } = await import('./layout/AuxPanel');
    const { container } = render(<AuxPanel {...mockProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('dispatch 模式下应渲染辅助面板标签栏', async () => {
    useAppStore.setState({ activeNavSection: 'dispatch', activeAuxSubPanel: 'files' } as Parameters<typeof useAppStore.setState>[0]);
    const { AuxPanel } = await import('./layout/AuxPanel');
    render(<AuxPanel {...mockProps} />);
    // 标签栏应包含文件/Git/变更等标签
    expect(screen.getByTitle('文件')).toBeInTheDocument();
    expect(screen.getByTitle('Git')).toBeInTheDocument();
    expect(screen.getByTitle('变更')).toBeInTheDocument();
  });

  it('dispatch 模式下点击 Git 标签应切换 activeAuxSubPanel', async () => {
    useAppStore.setState({ activeNavSection: 'dispatch', activeAuxSubPanel: 'files' } as Parameters<typeof useAppStore.setState>[0]);
    const { AuxPanel } = await import('./layout/AuxPanel');
    render(<AuxPanel {...mockProps} />);
    fireEvent.click(screen.getByTitle('Git'));
    expect(useAppStore.getState().activeAuxSubPanel).toBe('git');
  });
});
