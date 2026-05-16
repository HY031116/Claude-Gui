/**
 * NavRail 导航栏测试
 * 覆盖：导航项渲染、主题切换按钮、onUpdateStatus 订阅（可选）
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock
// ──────────────────────────────────────────
const mockElectronAPI = {
  onUpdateStatus: vi.fn().mockReturnValue(() => {}),
  selectDirectory: vi.fn().mockResolvedValue({ success: false, path: null }),
  setNativeTheme: vi.fn(),
};

const mockOnNavClick = vi.fn();

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.onUpdateStatus.mockReturnValue(() => {});
  useAppStore.setState({
    theme: 'dark',
    activeNavSection: 'command',
    messages: [],
    processingTabs: {},
    tokenUsage: null,
    workspaces: [],
    activeWorkspacePath: '',
  });
});

// ──────────────────────────────────────────
// 情景 1：导航项渲染
// ──────────────────────────────────────────
describe('NavRail - 导航项渲染', () => {
  it('应渲染"指挥中心"导航按钮', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    expect(screen.getByRole('button', { name: '指挥中心' })).toBeInTheDocument();
  });

  it('应渲染"委派"导航按钮', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    expect(screen.getByRole('button', { name: '委派' })).toBeInTheDocument();
  });

  it('应渲染"Agents"导航按钮', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    expect(screen.getByRole('button', { name: 'Agents' })).toBeInTheDocument();
  });

  it('应渲染"审查"导航按钮', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    expect(screen.getByRole('button', { name: '审查' })).toBeInTheDocument();
  });

  it('应渲染"设置"导航按钮', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────
// 情景 2：点击触发 onNavClick
// ──────────────────────────────────────────
describe('NavRail - 点击触发回调', () => {
  it('点击"审查"按钮应触发 onNavClick("review")', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    fireEvent.click(screen.getByRole('button', { name: '审查' }));
    expect(mockOnNavClick).toHaveBeenCalledWith('review');
  });

  it('点击"Agents"按钮应触发 onNavClick("agents")', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agents' }));
    expect(mockOnNavClick).toHaveBeenCalledWith('agents');
  });
});

// ──────────────────────────────────────────
// 情景 3：主题切换按钮
// ──────────────────────────────────────────
describe('NavRail - 主题切换', () => {
  it('暗色主题时应显示"切换浅色"按钮', async () => {
    useAppStore.setState({ theme: 'dark' });
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    expect(screen.getByRole('button', { name: '切换浅色' })).toBeInTheDocument();
  });

  it('亮色主题时应显示"切换深色"按钮', async () => {
    useAppStore.setState({ theme: 'light' });
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    expect(screen.getByRole('button', { name: '切换深色' })).toBeInTheDocument();
  });
});
