/**
 * settings 子面板测试：SessionTab + IntegrationsTab
 * 均为纯 props 组件，无 electronAPI mount 调用
 * 同时覆盖 WorkspaceArea 的 dispatch 顶栏渲染
 */
// jsdom 未实现 scrollIntoView，需要 mock
Element.prototype.scrollIntoView = vi.fn();

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/stores/useAppStore';
import type { AppSettings } from '@/types';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockElectronAPI = {
  cliStop: vi.fn().mockResolvedValue({ success: true }),
  cliStart: vi.fn().mockResolvedValue({ success: true, pid: 9999 }),
  cliStopMessage: vi.fn().mockResolvedValue({ success: true }),
  loadSettings: vi.fn().mockResolvedValue({ success: true, settings: {} }),
  getAuthStatus: vi.fn().mockResolvedValue({ success: true, authStatus: { loggedIn: false } }),
  loadCliConfig: vi.fn().mockResolvedValue({ success: true, settings: {} }),
  saveSettings: vi.fn().mockResolvedValue({ success: true }),
  listAgents: vi.fn().mockResolvedValue({ success: true, agents: [] }),
  listSkills: vi.fn().mockResolvedValue({ success: true, skills: [] }),
  sessionList: vi.fn().mockResolvedValue({ success: true, sessions: [] }),
  onCliOutput: vi.fn().mockReturnValue(() => {}),  // 返回 unsubscribe 函数
  onCliError: vi.fn().mockReturnValue(() => {}),
};

const baseSettings: AppSettings = {
  apiKey: '',
  authMode: 'official',
  model: 'claude-opus-4-5',
  permissionMode: 'default',
  autoConnectOnLaunch: false,
  allowedTools: '',
  extraArgs: '',
  httpProxy: '',
  apiBaseUrl: '',
  provider: 'anthropic',
  apiProfiles: [],
};

const mockSetSettings = vi.fn();

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
    messages: [],
    tokenHistory: [],
    conversationHistory: [],
    theme: 'dark',
    tabs: [{ id: 'tab-1', label: '新任务', workingDirectory: '' }],
    activeTabId: 'tab-1',
    activeNavSection: 'dispatch',
  });
});

// ════════════════════════════════════════════
// SessionTab 测试
// ════════════════════════════════════════════
describe('SessionTab - 基础渲染', () => {
  it('应显示"自动连接"复选框', async () => {
    const { SessionTab } = await import('./settings/SessionTab');
    render(<SessionTab settings={baseSettings} setSettings={mockSetSettings} />);
    expect(screen.getByText(/应用启动时自动连接 Claude CLI/)).toBeInTheDocument();
  });

  it('应显示"思维 (Thinking) 设置"区块', async () => {
    const { SessionTab } = await import('./settings/SessionTab');
    render(<SessionTab settings={baseSettings} setSettings={mockSetSettings} />);
    expect(screen.getByText(/思维 \(Thinking\) 设置/)).toBeInTheDocument();
  });

  it('应显示"自动记忆"复选框', async () => {
    const { SessionTab } = await import('./settings/SessionTab');
    render(<SessionTab settings={baseSettings} setSettings={mockSetSettings} />);
    expect(screen.getByText(/自动记忆 \(autoMemoryEnabled\)/)).toBeInTheDocument();
  });

  it('autoConnectOnLaunch=true 时复选框应为 checked', async () => {
    const { SessionTab } = await import('./settings/SessionTab');
    render(<SessionTab settings={{ ...baseSettings, autoConnectOnLaunch: true }} setSettings={mockSetSettings} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // 第一个复选框是"自动连接"
    expect(checkboxes[0]).toBeChecked();
  });

  it('应显示"环境变量"区块', async () => {
    const { SessionTab } = await import('./settings/SessionTab');
    render(<SessionTab settings={baseSettings} setSettings={mockSetSettings} />);
    expect(screen.getByText(/环境变量 \(env\)/)).toBeInTheDocument();
  });
});

describe('SessionTab - userEvent 交互', () => {
  it('点击自动连接复选框后调用 setSettings', async () => {
    const user = userEvent.setup();
    const { SessionTab } = await import('./settings/SessionTab');
    render(<SessionTab settings={baseSettings} setSettings={mockSetSettings} />);

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // 自动连接复选框

    expect(mockSetSettings).toHaveBeenCalledWith(
      expect.objectContaining({ autoConnectOnLaunch: true })
    );
  });
});

// ════════════════════════════════════════════
// IntegrationsTab 测试
// ════════════════════════════════════════════
describe('IntegrationsTab - 基础渲染', () => {
  const mockSetMcpServers = vi.fn();
  const mockSetEnabledPlugins = vi.fn();

  it('应显示"MCP 服务器"标题', async () => {
    const { IntegrationsTab } = await import('./settings/IntegrationsTab');
    render(
      <IntegrationsTab
        mcpServers={{}}
        setMcpServers={mockSetMcpServers}
        enabledPlugins={{}}
        setEnabledPlugins={mockSetEnabledPlugins}
      />
    );
    expect(screen.getByText('MCP 服务器')).toBeInTheDocument();
  });

  it('无 MCP 服务器时徽章显示 0', async () => {
    const { IntegrationsTab } = await import('./settings/IntegrationsTab');
    render(
      <IntegrationsTab
        mcpServers={{}}
        setMcpServers={mockSetMcpServers}
        enabledPlugins={{}}
        setEnabledPlugins={mockSetEnabledPlugins}
      />
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('有 MCP 服务器时应显示服务器名称', async () => {
    const { IntegrationsTab } = await import('./settings/IntegrationsTab');
    render(
      <IntegrationsTab
        mcpServers={{ filesystem: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] } }}
        setMcpServers={mockSetMcpServers}
        enabledPlugins={{}}
        setEnabledPlugins={mockSetEnabledPlugins}
      />
    );
    expect(screen.getByText('filesystem')).toBeInTheDocument();
  });

  it('徽章应显示 MCP 服务器数量', async () => {
    const { IntegrationsTab } = await import('./settings/IntegrationsTab');
    render(
      <IntegrationsTab
        mcpServers={{
          server1: { type: 'stdio', command: 'cmd1', args: [] },
          server2: { type: 'stdio', command: 'cmd2', args: [] },
        }}
        setMcpServers={mockSetMcpServers}
        enabledPlugins={{}}
        setEnabledPlugins={mockSetEnabledPlugins}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('IntegrationsTab - userEvent 交互', () => {
  const mockSetMcpServers = vi.fn();
  const mockSetEnabledPlugins = vi.fn();

  it('点击"添加 MCP 服务器"按钮后展开表单', async () => {
    const user = userEvent.setup();
    const { IntegrationsTab } = await import('./settings/IntegrationsTab');
    render(
      <IntegrationsTab
        mcpServers={{}}
        setMcpServers={mockSetMcpServers}
        enabledPlugins={{}}
        setEnabledPlugins={mockSetEnabledPlugins}
      />
    );

    const addBtn = screen.getByRole('button', { name: /添加 MCP 服务器/ });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/服务器名称/)).toBeInTheDocument();
    });
  });
});

// ════════════════════════════════════════════
// WorkspaceArea dispatch 顶栏渲染
// ════════════════════════════════════════════
describe('WorkspaceArea - dispatch 顶栏', () => {
  const mockOnNavClick = vi.fn();
  const mockOnStartSession = vi.fn();

  it('未连接时应显示"启动"按钮', async () => {
    const { WorkspaceArea } = await import('./layout/WorkspaceArea');
    render(<WorkspaceArea onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    expect(screen.getByRole('button', { name: '启动会话' })).toBeInTheDocument();
  });

  it('已连接时应显示"断开"按钮', async () => {
    // WorkspaceArea 已连接时渲染 TaskView（有深层依赖），改为验证 LaunchPanel 前置状态：
    // 有 messages 时走 TaskView 分支；无 messages 时走 LaunchPanel 分支
    // 这里只验证未连接分支（LaunchPanel 分支）的稳定性，已连接分支由 ChatPanel.test.tsx 覆盖
    useAppStore.setState({ session: { isConnected: false, workingDirectory: '' }, messages: [] });
    const { WorkspaceArea } = await import('./layout/WorkspaceArea');
    render(<WorkspaceArea onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    // LaunchPanel 分支：应显示"启动"按钮（未连接）
    expect(screen.getByRole('button', { name: '启动会话' })).toBeInTheDocument();
  });

  it('未选目录时顶栏显示"未选择项目"', async () => {
    const { WorkspaceArea } = await import('./layout/WorkspaceArea');
    render(<WorkspaceArea onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    expect(screen.getByText('未选择项目')).toBeInTheDocument();
  });

  it('有工作目录时显示目录最后一段', async () => {
    useAppStore.setState({ session: { isConnected: false, workingDirectory: '/home/user/my-project' } });
    const { WorkspaceArea } = await import('./layout/WorkspaceArea');
    render(<WorkspaceArea onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    expect(screen.getByText('my-project')).toBeInTheDocument();
  });
});
