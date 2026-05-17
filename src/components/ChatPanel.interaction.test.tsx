/**
 * ChatPanel 交互测试
 * 覆盖：输入框状态、发送消息流、suggestion chip 点击、新对话按钮
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// jsdom 不实现 scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// ──────────────────────────────────────────
// electronAPI mock
// ──────────────────────────────────────────
const mockElectronAPI = {
  onCliOutput: vi.fn().mockReturnValue(() => {}),
  loadSettings: vi.fn().mockResolvedValue({ success: true, settings: { model: 'claude-3-5-sonnet', permissionMode: 'auto' } }),
  loadCliConfig: vi.fn().mockResolvedValue({ success: true, settings: {} }),
  agentList: vi.fn().mockResolvedValue({ success: true, agents: [] }),
  cliSendMessage: vi.fn().mockResolvedValue({ success: true }),
  cliSend: vi.fn().mockResolvedValue({ success: true }),
  saveSettings: vi.fn().mockResolvedValue({ success: true }),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  localStorage.setItem('claude-gui-onboarding-v1', '1'); // 跳过引导，进入正常模式
  vi.clearAllMocks();
  mockElectronAPI.onCliOutput.mockReturnValue(() => {});
  mockElectronAPI.loadSettings.mockResolvedValue({ success: true, settings: { model: 'claude-3-5-sonnet', permissionMode: 'auto' } });
  mockElectronAPI.loadCliConfig.mockResolvedValue({ success: true, settings: {} });
  mockElectronAPI.agentList.mockResolvedValue({ success: true, agents: [] });
  mockElectronAPI.cliSendMessage.mockResolvedValue({ success: true });
});

afterEach(() => {
  localStorage.removeItem('claude-gui-onboarding-v1');
});

// ──────────────────────────────────────────
// 情景 1：输入框禁用状态
// ──────────────────────────────────────────
describe('ChatPanel 交互 - 输入框状态', () => {
  it('会话未连接时输入框应被禁用', async () => {
    useAppStore.setState({
      messages: [],
      session: { isConnected: false, workingDirectory: '' },
    });
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      const textarea = document.querySelector('textarea');
      expect(textarea).not.toBeNull();
      expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
    });
  });

  it('会话已连接时输入框应可用', async () => {
    useAppStore.setState({
      messages: [],
      session: { isConnected: true, workingDirectory: '/project' },
    });
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      const textarea = document.querySelector('textarea');
      expect(textarea).not.toBeNull();
      expect((textarea as HTMLTextAreaElement).disabled).toBe(false);
    });
  });

  it('未连接时输入框 placeholder 应为"请先启动会话"', async () => {
    useAppStore.setState({
      messages: [],
      session: { isConnected: false, workingDirectory: '' },
    });
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      const textarea = document.querySelector('textarea');
      expect((textarea as HTMLTextAreaElement).placeholder).toBe('请先启动会话');
    });
  });
});

// ──────────────────────────────────────────
// 情景 2：suggestion chip 点击填充输入
// ──────────────────────────────────────────
describe('ChatPanel 交互 - Suggestion Chip', () => {
  beforeEach(() => {
    useAppStore.setState({
      messages: [],
      session: { isConnected: true, workingDirectory: '/project' },
    });
  });

  it('点击"帮我修复 Bug"应将文本填入输入框', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText('帮我修复 Bug')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('帮我修复 Bug'));

    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('帮我修复 Bug');
    });
  });
});

// ──────────────────────────────────────────
// 情景 3：发送消息流
// ──────────────────────────────────────────
describe('ChatPanel 交互 - 发送消息', () => {
  beforeEach(() => {
    useAppStore.setState({
      messages: [],
      session: { isConnected: true, workingDirectory: '/project' },
    });
  });

  it('输入文字后发送按钮应变为可用', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      const textarea = document.querySelector('textarea');
      expect(textarea).not.toBeNull();
    });

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '你好，Claude！' } });

    await waitFor(() => {
      const sendBtn = document.querySelector('.chat-send-btn') as HTMLButtonElement | null;
      expect(sendBtn).not.toBeNull();
      expect(sendBtn!.disabled).toBe(false);
    });
  });

  it('输入文字后按 Enter 应调用 cliSendMessage', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      const textarea = document.querySelector('textarea');
      expect(textarea).not.toBeNull();
    });

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '这是一条测试消息' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(mockElectronAPI.cliSendMessage).toHaveBeenCalledWith(
        '这是一条测试消息',
        '/project',
        undefined,  // effectiveSessionId
        undefined,  // images
        undefined,  // agent
        expect.any(String), // activeTabId
      );
    });
  });

  it('发送后消息应出现在 store（addMessage 被调用）', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      const textarea = document.querySelector('textarea');
      expect(textarea).not.toBeNull();
    });

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '发送测试' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: false });

    await waitFor(() => {
      const msgs = useAppStore.getState().messages;
      expect(msgs.some((m) => m.content === '发送测试' && m.role === 'user')).toBe(true);
    });
  });

  it('Shift+Enter 不应发送消息（换行）', async () => {
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      const textarea = document.querySelector('textarea');
      expect(textarea).not.toBeNull();
    });

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '测试换行' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });

    // cliSendMessage 不应被调用
    expect(mockElectronAPI.cliSendMessage).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────
// 情景 4：新对话按钮
// ──────────────────────────────────────────
describe('ChatPanel 交互 - 新对话按钮', () => {
  it('有 conversationSessionId 时应显示"+ 新对话"按钮', async () => {
    useAppStore.setState({
      messages: [{ id: 'msg-1', role: 'user', content: '旧消息', timestamp: Date.now() }],
      session: { isConnected: false, workingDirectory: '', conversationSessionId: 'sess-old-001' },
    });
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText('+ 新对话')).toBeInTheDocument();
    });
  });

  it('无 conversationSessionId 时不应显示"+ 新对话"按钮', async () => {
    useAppStore.setState({
      messages: [],
      session: { isConnected: true, workingDirectory: '/project' },
    });
    const { ChatPanel } = await import('./ChatPanel');
    render(<ChatPanel />);

    await waitFor(() => {
      // 等待渲染稳定
      expect(screen.queryByText('+ 新对话')).not.toBeInTheDocument();
    });
  });
});
