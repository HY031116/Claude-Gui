/**
 * HooksPanel + ArtifactsView + CommandPalette 集成测试
 */
// scrollIntoView mock（CommandPalette 调用）
Element.prototype.scrollIntoView = vi.fn();

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock
// ──────────────────────────────────────────
const mockElectronAPI = {
  loadCliConfig: vi.fn().mockResolvedValue({ success: true, config: {}, settings: {} }),
  saveCliConfig: vi.fn().mockResolvedValue({ success: true }),
  hookTestRun: vi.fn().mockResolvedValue({ success: true, output: '' }),
  gitIsRepo: vi.fn().mockResolvedValue({ isRepo: false }),
  gitStatus: vi.fn().mockResolvedValue({ success: true, status: null }),
  gitAdd: vi.fn().mockResolvedValue({ success: true }),
  setNativeTheme: vi.fn(),
};

const mockOnClose = vi.fn();
const mockOnNavClick = vi.fn();
const mockOnStartSession = vi.fn();
const mockOnShowShortcuts = vi.fn();

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.loadCliConfig.mockResolvedValue({ success: true, config: {}, settings: {} });
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
    messages: [],
    tokenHistory: [],
    conversationHistory: [],
    theme: 'dark',
    tabs: [{ id: 'tab-1', label: '新任务', workingDirectory: '' }],
    activeTabId: 'tab-1',
  });
});

// ════════════════════════════════════════════
// HooksPanel 测试
// ════════════════════════════════════════════
describe('HooksPanel - 基础渲染', () => {
  it('加载完成后应显示"Hooks"标题', async () => {
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeInTheDocument();
    });
  });

  it('挂载时应调用 loadCliConfig', async () => {
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);
    await waitFor(() => {
      expect(mockElectronAPI.loadCliConfig).toHaveBeenCalled();
    });
  });

  it('加载完成后默认事件应显示"该事件暂无 Hook 配置"', async () => {
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('该事件暂无 Hook 配置')).toBeInTheDocument();
    });
  });

  it('应显示"保存"按钮', async () => {
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /保存/ })).toBeInTheDocument();
    });
  });

  it('应显示事件列表（左侧），包含"PreToolUse"', async () => {
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);
    await waitFor(() => {
      // "PreToolUse" 同时出现在左侧事件列表和右侧标题，使用 getAllByText
      expect(screen.getAllByText('PreToolUse').length).toBeGreaterThan(0);
    });
  });
});

describe('HooksPanel - 交互', () => {
  it('点击"添加 Matcher Group"应追加一个 group', async () => {
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /添加 Matcher Group/ });
    fireEvent.click(addBtn);

    // 添加后应显示"1 个 matcher group"
    await waitFor(() => {
      expect(screen.getByText('1 个 matcher group')).toBeInTheDocument();
    });
  });
});

// ════════════════════════════════════════════
// ArtifactsView 测试
// ════════════════════════════════════════════
describe('ArtifactsView - 基础渲染', () => {
  it('应显示"AI 产物"指标卡片', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    expect(screen.getAllByText('AI 产物').length).toBeGreaterThan(0);
  });

  it('应显示"今日成本"指标卡片', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    expect(screen.getByText('今日成本')).toBeInTheDocument();
  });

  it('无 cwd 时 Git 状态应显示"未选目录"', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    expect(screen.getByText('未选目录')).toBeInTheDocument();
  });

  it('无活跃会话时应显示"当前无活跃会话"', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    expect(screen.getByText('当前无活跃会话')).toBeInTheDocument();
  });

  it('有活跃会话无文件时应显示"本次会话暂无文件修改记录"', async () => {
    useAppStore.setState({
      session: { isConnected: true, workingDirectory: '' },
    });
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    expect(screen.getByText('本次会话暂无文件修改记录')).toBeInTheDocument();
  });

  it('应显示"Git" tab 按钮', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    expect(screen.getByRole('button', { name: /Git/ })).toBeInTheDocument();
  });

  it('应显示"成本" tab 按钮', async () => {
    const { ArtifactsView } = await import('./views/ArtifactsView');
    render(<ArtifactsView />);
    expect(screen.getByRole('button', { name: /成本/ })).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════
// CommandPalette 测试
// ════════════════════════════════════════════
describe('CommandPalette - 基础渲染', () => {
  it('应显示搜索输入框（placeholder 含"搜索命令"）', async () => {
    const { CommandPalette } = await import('./layout/CommandPalette');
    render(<CommandPalette onClose={mockOnClose} onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} onShowShortcuts={mockOnShowShortcuts} />);
    expect(screen.getByPlaceholderText('搜索命令…')).toBeInTheDocument();
  });

  it('默认应显示"导航"分组命令', async () => {
    const { CommandPalette } = await import('./layout/CommandPalette');
    render(<CommandPalette onClose={mockOnClose} onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} onShowShortcuts={mockOnShowShortcuts} />);
    // "导航" 分组标题可能出现多次
    expect(screen.getAllByText('导航').length).toBeGreaterThan(0);
  });

  it('搜索无匹配内容时应显示"没有匹配的命令"', async () => {
    const { CommandPalette } = await import('./layout/CommandPalette');
    render(<CommandPalette onClose={mockOnClose} onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} onShowShortcuts={mockOnShowShortcuts} />);

    const input = screen.getByPlaceholderText('搜索命令…');
    fireEvent.change(input, { target: { value: 'xyzabcdef不存在' } });

    await waitFor(() => {
      expect(screen.getByText('没有匹配的命令')).toBeInTheDocument();
    });
  });

  it('应显示"指挥中心"命令', async () => {
    const { CommandPalette } = await import('./layout/CommandPalette');
    render(<CommandPalette onClose={mockOnClose} onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} onShowShortcuts={mockOnShowShortcuts} />);
    expect(screen.getAllByText('指挥中心').length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════
// CapabilitiesView 测试
// ════════════════════════════════════════════
describe('CapabilitiesView - 基础渲染', () => {
  it('挂载时应调用 loadCliConfig', async () => {
    const { CapabilitiesView } = await import('./views/CapabilitiesView');
    render(<CapabilitiesView />);
    await waitFor(() => {
      expect(mockElectronAPI.loadCliConfig).toHaveBeenCalled();
    });
  });

  it('应渲染顶部统计栏：MCP 服务', async () => {
    const { CapabilitiesView } = await import('./views/CapabilitiesView');
    render(<CapabilitiesView />);
    await waitFor(() => {
      expect(screen.getByText(/个 MCP 服务/)).toBeInTheDocument();
    });
  });

  it('应渲染顶部统计栏：Hook 事件', async () => {
    const { CapabilitiesView } = await import('./views/CapabilitiesView');
    render(<CapabilitiesView />);
    await waitFor(() => {
      expect(screen.getByText(/个 Hook 事件/)).toBeInTheDocument();
    });
  });

  it('左侧菜单应显示"Hooks"选项', async () => {
    const { CapabilitiesView } = await import('./views/CapabilitiesView');
    render(<CapabilitiesView />);
    await waitFor(() => {
      // Hooks 出现在左侧菜单和 HooksPanel 标题中，使用 getAllByText
      expect(screen.getAllByText('Hooks').length).toBeGreaterThan(0);
    });
  });
});

