/**
 * SessionList.test.tsx
 * 测试会话列表基础渲染及交互
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionList } from './SessionList';
import { useAppStore } from '../stores/useAppStore';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockLoadCliHistory = vi.fn();
const mockLoadSessionMessages = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadCliHistory.mockResolvedValue({ success: true, sessions: [] });
  mockLoadSessionMessages.mockResolvedValue({ success: true, messages: [] });

  (window as unknown as Record<string, unknown>).electronAPI = {
    loadCliHistory: mockLoadCliHistory,
    loadSessionMessages: mockLoadSessionMessages,
  };

  useAppStore.setState({
    conversationHistory: [],
    session: { workingDirectory: '', conversationSessionId: undefined } as never,
  } as never);
});

// ─── 基础渲染 ─────────────────────────────────────────────────────────────────

describe('SessionList - 基础渲染', () => {
  it('显示搜索按钮', async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByTitle('搜索')).toBeInTheDocument();
    });
  });

  it('显示新建对话按钮', async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByTitle('新建对话')).toBeInTheDocument();
    });
  });

  it('加载时调用 loadCliHistory', async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(mockLoadCliHistory).toHaveBeenCalled();
    });
  });
});

// ─── 搜索功能 ─────────────────────────────────────────────────────────────────

describe('SessionList - 搜索', () => {
  it('点击搜索按钮显示搜索框', async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByTitle('搜索')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('搜索'));
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});

// ─── 有历史会话 ───────────────────────────────────────────────────────────────

describe('SessionList - 有本地会话', () => {
  beforeEach(() => {
    const now = Date.now();
    useAppStore.setState({
      conversationHistory: [
        {
          sessionId: 'session-1',
          workingDirectory: '/project/myapp',
          preview: '帮我写一个 React 组件',
          startedAt: now - 10000,
          lastMessageAt: now - 1000,
        },
        {
          sessionId: 'session-2',
          workingDirectory: '/project/myapp',
          preview: '修复 TypeScript 错误',
          startedAt: now - 20000,
          lastMessageAt: now - 5000,
        },
      ],
    } as never);
  });

  it('显示会话列表条目', async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByText(/帮我写一个 React 组件/)).toBeInTheDocument();
    });
  });

  it('显示项目名称（最后一级目录）', async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByText('myapp')).toBeInTheDocument();
    });
  });

  it('显示会话数量', async () => {
    render(<SessionList />);
    await waitFor(() => {
      // 两条会话，同属一个项目组
      expect(screen.getByText(/修复 TypeScript 错误/)).toBeInTheDocument();
    });
  });
});

// ─── CLI 会话 ─────────────────────────────────────────────────────────────────

describe('SessionList - CLI 会话', () => {
  beforeEach(() => {
    mockLoadCliHistory.mockResolvedValue({
      success: true,
      sessions: [
        {
          sessionId: 'cli-session-1',
          projectDirName: 'd--project-cli',
          workingDirectory: '/project/cli',
          preview: 'CLI 会话内容',
          startedAt: Date.now() - 5000,
          lastMessageAt: Date.now() - 1000,
        },
      ],
    });
  });

  it('显示 CLI 会话条目', async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByText(/CLI 会话内容/)).toBeInTheDocument();
    });
  });
});

// ─── 空状态 ───────────────────────────────────────────────────────────────────

describe('SessionList - 空状态', () => {
  it('无会话时显示"暂无历史对话"', async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByText(/暂无历史对话/)).toBeInTheDocument();
    });
  });
});

// ─── 搜索过滤 ─────────────────────────────────────────────────────────────────

describe('SessionList - 搜索过滤', () => {
  beforeEach(() => {
    const now = Date.now();
    useAppStore.setState({
      conversationHistory: [
        {
          sessionId: 'session-a',
          workingDirectory: '/project/search-test',
          preview: '优化前端性能',
          startedAt: now - 10000,
          lastMessageAt: now - 1000,
        },
        {
          sessionId: 'session-b',
          workingDirectory: '/project/search-test',
          preview: '数据库迁移方案',
          startedAt: now - 20000,
          lastMessageAt: now - 5000,
        },
      ],
    } as never);
  });

  it('搜索框输入后过滤会话', async () => {
    render(<SessionList />);
    // 先打开搜索框
    await waitFor(() => expect(screen.getByTitle('搜索')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('搜索'));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
    // 输入关键词
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '前端' } });
    await waitFor(() => {
      expect(screen.getByText(/优化前端性能/)).toBeInTheDocument();
      expect(screen.queryByText(/数据库迁移/)).not.toBeInTheDocument();
    });
  });
});

// ─── 分组折叠 ─────────────────────────────────────────────────────────────────

describe('SessionList - 分组折叠', () => {
  beforeEach(() => {
    const now = Date.now();
    useAppStore.setState({
      conversationHistory: [
        {
          sessionId: 'group-s1',
          workingDirectory: '/project/collapsetest',
          preview: '测试折叠功能',
          startedAt: now - 10000,
          lastMessageAt: now - 1000,
        },
      ],
    } as never);
  });

  it('点击分组标题折叠/展开', async () => {
    render(<SessionList />);
    await waitFor(() => expect(screen.getByText('collapsetest')).toBeInTheDocument());
    // 折叠
    fireEvent.click(screen.getByText('collapsetest'));
    await waitFor(() => {
      expect(screen.queryByText(/测试折叠功能/)).not.toBeInTheDocument();
    });
    // 再次点击展开
    fireEvent.click(screen.getByText('collapsetest'));
    await waitFor(() => {
      expect(screen.getByText(/测试折叠功能/)).toBeInTheDocument();
    });
  });
});
