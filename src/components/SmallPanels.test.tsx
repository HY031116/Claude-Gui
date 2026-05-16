/**
 * 小型面板集成测试（TaskPanel、ToolCallView、SessionList）
 * 覆盖：各面板空状态、有数据状态
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock（SessionList 调用 loadCliHistory）
// ──────────────────────────────────────────
const mockElectronAPI = {
  loadCliHistory: vi.fn().mockResolvedValue({ success: true, sessions: [] }),
  loadSessionMessages: vi.fn().mockResolvedValue({ success: true, messages: [] }),
  deleteCliSession: vi.fn().mockResolvedValue({ success: true }),
  deleteAllCliSessions: vi.fn().mockResolvedValue({ success: true }),
  openInEditor: vi.fn().mockResolvedValue({ success: true }),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.loadCliHistory.mockResolvedValue({ success: true, sessions: [] });
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
    messages: [],
    todoItems: [],
    conversationHistory: [],
    tabs: [{ id: 'tab-1', label: '新任务', workingDirectory: '' }],
    activeTabId: 'tab-1',
  });
});

// ════════════════════════════════════════════
// TaskPanel 测试
// ════════════════════════════════════════════
describe('TaskPanel - 空状态', () => {
  it('无任务时应显示"暂无任务"', async () => {
    const { TaskPanel } = await import('./TaskPanel');
    render(<TaskPanel />);
    expect(screen.getByText('暂无任务')).toBeInTheDocument();
  });

  it('空状态应显示辅助说明文字', async () => {
    const { TaskPanel } = await import('./TaskPanel');
    render(<TaskPanel />);
    expect(screen.getByText(/当 Claude 创建待办事项时/)).toBeInTheDocument();
  });
});

describe('TaskPanel - 有任务数据', () => {
  beforeEach(() => {
    useAppStore.setState({
      todoItems: [
        { id: 't1', content: '完成单元测试', status: 'completed' },
        { id: 't2', content: '修复 Bug #42', status: 'in_progress' },
        { id: 't3', content: '代码审查', status: 'pending' },
      ],
    });
  });

  it('应显示任务进度"1/3"', async () => {
    const { TaskPanel } = await import('./TaskPanel');
    render(<TaskPanel />);
    expect(screen.getByText('任务进度 1/3')).toBeInTheDocument();
  });

  it('应显示进度百分比"33%"', async () => {
    const { TaskPanel } = await import('./TaskPanel');
    render(<TaskPanel />);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('应渲染任务条目"完成单元测试"', async () => {
    const { TaskPanel } = await import('./TaskPanel');
    render(<TaskPanel />);
    expect(screen.getByText('完成单元测试')).toBeInTheDocument();
  });

  it('应渲染任务条目"修复 Bug #42"', async () => {
    const { TaskPanel } = await import('./TaskPanel');
    render(<TaskPanel />);
    expect(screen.getByText('修复 Bug #42')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════
// ToolCallView 测试
// ════════════════════════════════════════════
describe('ToolCallView - 空状态（无工具调用）', () => {
  it('应显示"暂无工具调用记录"', async () => {
    const { ToolCallView } = await import('./ToolCallView');
    render(<ToolCallView />);
    expect(screen.getByText('暂无工具调用记录')).toBeInTheDocument();
  });

  it('应显示辅助说明', async () => {
    const { ToolCallView } = await import('./ToolCallView');
    render(<ToolCallView />);
    expect(screen.getByText(/工具调用将显示在这里/)).toBeInTheDocument();
  });
});

describe('ToolCallView - 有工具调用记录', () => {
  beforeEach(() => {
    useAppStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          toolCalls: [
            {
              id: 'tc-1',
              name: 'write_file',
              status: 'success',
              input: { path: '/src/index.ts', content: 'hello' },
              output: '已写入',
            },
            {
              id: 'tc-2',
              name: 'bash',
              status: 'error',
              input: { command: 'npm test' },
              output: '错误信息',
            },
          ],
        },
      ],
    });
  });

  it('有工具调用时应渲染工具名称"write_file"', async () => {
    const { ToolCallView } = await import('./ToolCallView');
    render(<ToolCallView />);
    expect(screen.getByText('write_file')).toBeInTheDocument();
  });

  it('有工具调用时应渲染工具名称"bash"', async () => {
    const { ToolCallView } = await import('./ToolCallView');
    render(<ToolCallView />);
    expect(screen.getByText('bash')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════
// SessionList 测试
// ════════════════════════════════════════════
describe('SessionList - 空状态', () => {
  it('挂载时应调用 loadCliHistory', async () => {
    const { SessionList } = await import('./SessionList');
    render(<SessionList />);
    await waitFor(() => {
      expect(mockElectronAPI.loadCliHistory).toHaveBeenCalled();
    });
  });

  it('无历史会话时应渲染正常（不崩溃）', async () => {
    const { SessionList } = await import('./SessionList');
    render(<SessionList />);
    // 组件挂载不崩溃，内容区域存在
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });
});

describe('SessionList - 有历史会话', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversationHistory: [
        {
          sessionId: 'sess-abc',
          workingDirectory: '/home/user/project',
          lastMessageAt: Date.now() - 3600000,
          messageCount: 10,
          preview: '测试功能修复任务',
        },
      ],
    });
  });

  it('有历史会话时应显示预览文字', async () => {
    const { SessionList } = await import('./SessionList');
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByText('测试功能修复任务')).toBeInTheDocument();
    });
  });
});
