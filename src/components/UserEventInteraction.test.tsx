/**
 * userEvent 交互测试示范
 * 对比 fireEvent，userEvent 模拟真实用户操作链（逐键输入、完整鼠标事件序列）
 * 覆盖：CommandPalette 键盘搜索/导航、HooksPanel 按钮交互
 */
// scrollIntoView mock
Element.prototype.scrollIntoView = vi.fn();

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/stores/useAppStore';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockElectronAPI = {
  loadCliConfig: vi.fn().mockResolvedValue({ success: true, config: {}, settings: {} }),
  saveCliConfig: vi.fn().mockResolvedValue({ success: true }),
  hookTestRun: vi.fn().mockResolvedValue({ success: true, output: '' }),
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
// CommandPalette — 键盘驱动交互（userEvent）
// ════════════════════════════════════════════
describe('CommandPalette - userEvent 键盘交互', () => {
  it('逐字输入搜索词过滤命令列表', async () => {
    const user = userEvent.setup();
    const { CommandPalette } = await import('./layout/CommandPalette');
    render(<CommandPalette onClose={mockOnClose} onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} onShowShortcuts={mockOnShowShortcuts} />);

    const input = screen.getByPlaceholderText('搜索命令…');

    // 逐字输入——userEvent 触发完整 keydown/keypress/input/keyup 序列
    await user.type(input, '指挥');

    // 输入后过滤：应显示"指挥中心"
    await waitFor(() => {
      expect(screen.getAllByText('指挥中心').length).toBeGreaterThan(0);
    });
  });

  it('输入无匹配关键词后显示"没有匹配的命令"', async () => {
    const user = userEvent.setup();
    const { CommandPalette } = await import('./layout/CommandPalette');
    render(<CommandPalette onClose={mockOnClose} onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} onShowShortcuts={mockOnShowShortcuts} />);

    const input = screen.getByPlaceholderText('搜索命令…');
    await user.type(input, 'zzznomatchwhatever');

    await waitFor(() => {
      expect(screen.getByText('没有匹配的命令')).toBeInTheDocument();
    });
  });

  it('点击✕按钮清空搜索词后恢复全部命令', async () => {
    const user = userEvent.setup();
    const { CommandPalette } = await import('./layout/CommandPalette');
    render(<CommandPalette onClose={mockOnClose} onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} onShowShortcuts={mockOnShowShortcuts} />);

    const input = screen.getByPlaceholderText('搜索命令…');
    // 输入内容，✕按钮出现
    await user.type(input, '委派');
    const clearBtn = await screen.findByRole('button', { name: '清空' });

    // 点击清空
    await user.click(clearBtn);

    // input 应被清空
    expect(input).toHaveValue('');
    // 全部命令列表恢复，导航分组应再次出现
    expect(screen.getAllByText('导航').length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════
// HooksPanel — 按钮与列表交互（userEvent）
// ════════════════════════════════════════════
describe('HooksPanel - userEvent 按钮交互', () => {
  it('点击"添加 Matcher Group"后右侧编辑区显示"1 个 matcher group"', async () => {
    const user = userEvent.setup();
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);

    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /添加 Matcher Group/ });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('1 个 matcher group')).toBeInTheDocument();
    });
  });

  it('点击"预设"按钮展开预设面板', async () => {
    const user = userEvent.setup();
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeInTheDocument();
    });

    const presetBtn = screen.getByRole('button', { name: /预设/ });
    await user.click(presetBtn);

    // 展开后应显示预设说明文字
    await waitFor(() => {
      expect(screen.getByText(/选择预设模板/)).toBeInTheDocument();
    });
  });

  it('点击左侧"PostToolUse"事件切换右侧面板标题', async () => {
    const user = userEvent.setup();
    const { HooksPanel } = await import('./HooksPanel');
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeInTheDocument();
    });

    const postToolUseBtn = screen.getByRole('button', { name: 'PostToolUse' });
    await user.click(postToolUseBtn);

    // 右侧标题应切换到 PostToolUse
    await waitFor(() => {
      expect(screen.getAllByText('PostToolUse').length).toBeGreaterThan(0);
    });
  });
});
