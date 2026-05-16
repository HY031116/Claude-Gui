/**
 * NavRail 导航栏测试
 * 覆盖：导航项渲染、主题切换按钮、工作区管理交互
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  localStorage.removeItem('claude-gui-workspaces');
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

// ──────────────────────────────────────────
// 情景 4：工作区 Popover
// ──────────────────────────────────────────
describe('NavRail - 工作区管理', () => {
  it('点击 Logo 按钮应打开工作区 Popover', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    const trigger = screen.getByTitle('工作区管理');
    fireEvent.click(trigger);
    expect(screen.getByText('工作区')).toBeInTheDocument();
  });

  it('Popover 中应显示"全部会话"选项', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    fireEvent.click(screen.getByTitle('工作区管理'));
    expect(screen.getByText('全部会话')).toBeInTheDocument();
  });

  it('Popover 中应显示"新建工作区"按钮', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    fireEvent.click(screen.getByTitle('工作区管理'));
    expect(screen.getByText('新建工作区')).toBeInTheDocument();
  });

  it('点击"新建工作区"应展示工作区名称输入框', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    fireEvent.click(screen.getByTitle('工作区管理'));
    fireEvent.click(screen.getByText('新建工作区'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('工作区名称')).toBeInTheDocument();
    });
  });

  it('输入名称后按 Enter 应创建工作区并关闭 Popover', async () => {
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    fireEvent.click(screen.getByTitle('工作区管理'));
    fireEvent.click(screen.getByText('新建工作区'));

    const input = await screen.findByPlaceholderText('工作区名称');
    fireEvent.change(input, { target: { value: '测试工作区' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      // Popover 关闭后，"工作区"字样不再可见
      expect(screen.queryByText('全部会话')).not.toBeInTheDocument();
    });

    // store 中应已创建工作区
    const { workspaces } = useAppStore.getState();
    expect(workspaces.some((w) => w.name === '测试工作区')).toBe(true);
  });

  it('有工作区时，工作区触发器 title 应变为工作区名称', async () => {
    useAppStore.setState({
      workspaces: [{ id: 'ws-1', name: '项目一', path: '/project', createdAt: Date.now() }],
      activeWorkspacePath: '/project',
    });
    const { NavRail } = await import('./NavRail');
    render(<NavRail onNavClick={mockOnNavClick} />);
    // 有活动工作区时 title 是 "工作区：项目一"
    expect(screen.getByTitle('工作区：项目一')).toBeInTheDocument();
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
