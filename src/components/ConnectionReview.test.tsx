/**
 * ConnectionTab + ReviewQueue 集成测试
 * 使用 userEvent 模拟真实交互
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/stores/useAppStore';
import type { AppSettings } from '@/types';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockElectronAPI = {
  saveSettings: vi.fn().mockResolvedValue({ success: true }),
  cliDoctor: vi.fn().mockResolvedValue({ success: true, output: 'doctor ok' }),
  cliUpdate: vi.fn().mockResolvedValue({ success: true, output: 'update ok' }),
  cliStop: vi.fn().mockResolvedValue({ success: true }),
  cliStart: vi.fn().mockResolvedValue({ success: true, pid: 1234 }),
  launchOfficialLogin: vi.fn().mockResolvedValue({ success: true }),
  writeFile: vi.fn().mockResolvedValue({ success: true }),
};

// ── 最小合法 AppSettings ──────────────────────────────────────────────────────
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
  });
});

// ════════════════════════════════════════════
// ConnectionTab 测试
// ════════════════════════════════════════════
describe('ConnectionTab - 基础渲染', () => {
  const mockSetSettings = vi.fn();
  const mockSetShowAdvanced = vi.fn();

  const renderConnectionTab = async (settingsOverride?: Partial<AppSettings>) => {
    const { ConnectionTab } = await import('./settings/ConnectionTab');
    const merged = { ...baseSettings, ...settingsOverride };
    render(
      <ConnectionTab
        settings={merged}
        setSettings={mockSetSettings}
        authStatus={null}
        showAdvanced={false}
        setShowAdvanced={mockSetShowAdvanced}
      />
    );
  };

  it('应显示"保存当前 API 配置"按钮', async () => {
    await renderConnectionTab();
    expect(screen.getByRole('button', { name: /保存当前 API 配置/ })).toBeInTheDocument();
  });

  it('未授权时应显示"✗ 未授权"', async () => {
    await renderConnectionTab();
    expect(screen.getByText('✗ 未授权')).toBeInTheDocument();
  });

  it('authStatus.loggedIn=true 时应显示"✓ 官方已授权"', async () => {
    const { ConnectionTab } = await import('./settings/ConnectionTab');
    render(
      <ConnectionTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        authStatus={{ loggedIn: true, authMethod: 'oauth', apiProvider: 'anthropic' }}
        showAdvanced={false}
        setShowAdvanced={mockSetShowAdvanced}
      />
    );
    expect(screen.getByText('✓ 官方已授权')).toBeInTheDocument();
  });

  it('authMode=api-key 且有 apiKey 时应显示"✓ 自定义 API 已配置"', async () => {
    await renderConnectionTab({ authMode: 'api-key', apiKey: 'sk-test-key' });
    expect(screen.getByText('✓ 自定义 API 已配置')).toBeInTheDocument();
  });

  it('应显示 CLI 维护区域的"健康诊断"按钮', async () => {
    await renderConnectionTab();
    expect(screen.getByRole('button', { name: /健康诊断/ })).toBeInTheDocument();
  });

  it('应显示"更新 CLI"按钮', async () => {
    await renderConnectionTab();
    expect(screen.getByRole('button', { name: /更新 CLI/ })).toBeInTheDocument();
  });
});

describe('ConnectionTab - userEvent 交互', () => {
  const mockSetSettings = vi.fn();
  const mockSetShowAdvanced = vi.fn();

  it('点击"保存当前 API 配置"后展开配置文件名称输入框', async () => {
    const user = userEvent.setup();
    const { ConnectionTab } = await import('./settings/ConnectionTab');
    render(
      <ConnectionTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        authStatus={null}
        showAdvanced={false}
        setShowAdvanced={mockSetShowAdvanced}
      />
    );

    await user.click(screen.getByRole('button', { name: /保存当前 API 配置/ }));

    // 展开后应出现配置文件名称输入框
    await waitFor(() => {
      expect(screen.getByPlaceholderText('配置文件名称…')).toBeInTheDocument();
    });
  });

  it('输入配置文件名称后点击确认，调用 setSettings', async () => {
    const user = userEvent.setup();
    const { ConnectionTab } = await import('./settings/ConnectionTab');
    render(
      <ConnectionTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        authStatus={null}
        showAdvanced={false}
        setShowAdvanced={mockSetShowAdvanced}
      />
    );

    // 展开输入框
    await user.click(screen.getByRole('button', { name: /保存当前 API 配置/ }));
    const nameInput = await screen.findByPlaceholderText('配置文件名称…');
    await user.type(nameInput, '测试配置');
    await user.click(screen.getByRole('button', { name: '确认' }));

    // setSettings 应被调用
    expect(mockSetSettings).toHaveBeenCalled();
  });

  it('点击"🩺 健康诊断"后调用 cliDoctor', async () => {
    const user = userEvent.setup();
    const { ConnectionTab } = await import('./settings/ConnectionTab');
    render(
      <ConnectionTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        authStatus={null}
        showAdvanced={false}
        setShowAdvanced={mockSetShowAdvanced}
      />
    );

    await user.click(screen.getByRole('button', { name: /健康诊断/ }));

    await waitFor(() => {
      expect(mockElectronAPI.cliDoctor).toHaveBeenCalled();
    });
  });
});

// ════════════════════════════════════════════
// ReviewQueue 测试
// ════════════════════════════════════════════
describe('ReviewQueue - 基础渲染', () => {
  it('无文件变更时显示"本轮任务暂无文件变更"', async () => {
    const { ReviewQueue } = await import('./task/ReviewQueue');
    render(<ReviewQueue />);
    expect(screen.getByText('本轮任务暂无文件变更')).toBeInTheDocument();
  });

  it('已有接受的变更时显示"所有变更已审查完成"', async () => {
    useAppStore.setState({
      messages: [{
        id: 'msg-1',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now(),
        toolCalls: [{
          id: 'tc-1',
          name: 'write_file',
          status: 'success' as const,
          diffReviewStatus: 'accepted' as const,
          arguments: { file_path: '/tmp/test.ts', content: 'hello' },
        }],
      }],
    });
    const { ReviewQueue } = await import('./task/ReviewQueue');
    render(<ReviewQueue />);
    expect(screen.getByText('所有变更已审查完成')).toBeInTheDocument();
  });

  it('已审查完成时显示"提交到 Git"按钮', async () => {
    useAppStore.setState({
      messages: [{
        id: 'msg-1',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now(),
        toolCalls: [{
          id: 'tc-1',
          name: 'write_file',
          status: 'success' as const,
          diffReviewStatus: 'accepted' as const,
          arguments: { file_path: '/tmp/test.ts', content: 'hello' },
        }],
      }],
    });
    const { ReviewQueue } = await import('./task/ReviewQueue');
    render(<ReviewQueue />);
    expect(screen.getByRole('button', { name: /提交到 Git/ })).toBeInTheDocument();
  });

  it('有待审查文件时显示"全部接受"按钮', async () => {
    useAppStore.setState({
      messages: [{
        id: 'msg-2',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now(),
        toolCalls: [{
          id: 'tc-2',
          name: 'write_file',
          status: 'success' as const,
          arguments: { file_path: '/tmp/app.ts', content: 'const x = 1;' },
        }],
      }],
    });
    const { ReviewQueue } = await import('./task/ReviewQueue');
    render(<ReviewQueue />);
    expect(screen.getByRole('button', { name: /全部接受/ })).toBeInTheDocument();
  });
});

describe('ReviewQueue - userEvent 交互', () => {
  it('点击"全部接受"后调用 updateMessage 将 diffReviewStatus 设为 accepted', async () => {
    const user = userEvent.setup();
    useAppStore.setState({
      messages: [{
        id: 'msg-3',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now(),
        toolCalls: [{
          id: 'tc-3',
          name: 'edit_file',
          status: 'success' as const,
          arguments: { file_path: '/tmp/edit.ts', old_string: 'a', new_string: 'b' },
        }],
      }],
    });
    const { ReviewQueue } = await import('./task/ReviewQueue');
    render(<ReviewQueue />);

    const acceptAllBtn = screen.getByRole('button', { name: /全部接受/ });
    await user.click(acceptAllBtn);

    // 点击后 diffReviewStatus 应更新，ReviewQueue 空状态"所有变更已审查完成"出现
    await waitFor(() => {
      expect(screen.getByText('所有变更已审查完成')).toBeInTheDocument();
    });
  });
});
