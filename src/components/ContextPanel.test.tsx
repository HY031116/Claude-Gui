/**
 * ContextPanel.test.tsx
 * 测试上下文面板基础渲染及各区块展示
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContextPanel } from './ContextPanel';
import { useAppStore } from '../stores/useAppStore';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockReadFile = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockReadFile.mockResolvedValue({ success: false, content: null });

  (window as unknown as Record<string, unknown>).electronAPI = {
    readFile: mockReadFile,
  };

  useAppStore.setState({
    messages: [],
    session: { workingDirectory: '' } as never,
    tokenUsage: null,
  } as never);
});

// ─── 基础渲染 ─────────────────────────────────────────────────────────────────

describe('ContextPanel - 基础渲染', () => {
  it('显示 Token 用量标题', () => {
    render(<ContextPanel />);
    expect(screen.getByText('Token 用量')).toBeInTheDocument();
  });

  it('无 token 数据时显示"暂无数据"', () => {
    render(<ContextPanel />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('显示"已读取文件"区块', () => {
    render(<ContextPanel />);
    expect(screen.getByText('已读取文件')).toBeInTheDocument();
  });

  it('显示 CLAUDE.md 区块', () => {
    render(<ContextPanel />);
    expect(screen.getByText('CLAUDE.md')).toBeInTheDocument();
  });

  it('无已读取文件时显示"本会话暂未读取文件"', () => {
    render(<ContextPanel />);
    expect(screen.getByText('本会话暂未读取文件')).toBeInTheDocument();
  });
});

// ─── Token 用量显示 ───────────────────────────────────────────────────────────

describe('ContextPanel - Token 用量', () => {
  it('有 token 数据时显示进度和数字', () => {
    useAppStore.setState({ tokenUsage: { inputTokens: 1000, outputTokens: 500, costUsd: 0.05 } } as never);
    render(<ContextPanel />);
    expect(screen.getByText(/输入 1,000 · 输出 500/)).toBeInTheDocument();
  });

  it('显示总 token 数与上限', () => {
    useAppStore.setState({ tokenUsage: { inputTokens: 2000, outputTokens: 1000 } } as never);
    render(<ContextPanel />);
    expect(screen.getByText(/3,000 \/ 200k/)).toBeInTheDocument();
  });

  it('有 costUsd 时显示费用', () => {
    useAppStore.setState({ tokenUsage: { inputTokens: 1000, outputTokens: 500, costUsd: 0.0123 } } as never);
    render(<ContextPanel />);
    expect(screen.getByText(/\$0\.0123 USD/)).toBeInTheDocument();
  });
});

// ─── 已读取文件列表 ───────────────────────────────────────────────────────────

describe('ContextPanel - 已读取文件', () => {
  beforeEach(() => {
    useAppStore.setState({
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          toolCalls: [
            {
              id: 'tc1',
              name: 'Read',
              arguments: { file_path: '/project/src/App.tsx' },
              status: 'success',
            },
          ],
        },
      ],
    } as never);
  });

  it('显示已读取的文件名', () => {
    render(<ContextPanel />);
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
  });

  it('点击"已读取文件"标题可折叠', () => {
    render(<ContextPanel />);
    fireEvent.click(screen.getByText('已读取文件'));
    // 折叠后文件名消失
    expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
  });
});

// ─── CLAUDE.md 加载 ───────────────────────────────────────────────────────────

describe('ContextPanel - CLAUDE.md', () => {
  it('有工作目录时调用 readFile 加载 CLAUDE.md', async () => {
    useAppStore.setState({ session: { workingDirectory: '/project' } as never } as never);
    render(<ContextPanel />);
    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('/project/CLAUDE.md');
    });
  });

  it('CLAUDE.md 存在时显示"已加载"', async () => {
    mockReadFile.mockResolvedValue({ success: true, content: '# Project\n\nSome context here.' });
    useAppStore.setState({ session: { workingDirectory: '/project' } as never } as never);
    render(<ContextPanel />);
    await waitFor(() => {
      expect(screen.getByText('已加载')).toBeInTheDocument();
    });
  });

  it('CLAUDE.md 不存在时显示"未检测到"', async () => {
    render(<ContextPanel />);
    await waitFor(() => {
      expect(screen.getByText('未检测到')).toBeInTheDocument();
    });
  });

  it('展开 CLAUDE.md 区块显示内容', async () => {
    mockReadFile.mockResolvedValue({ success: true, content: '# My Instructions\n\nLine 2.' });
    useAppStore.setState({ session: { workingDirectory: '/project' } as never } as never);
    render(<ContextPanel />);
    await waitFor(() => {
      expect(screen.getByText('已加载')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('CLAUDE.md'));
    await waitFor(() => {
      expect(screen.getByText(/My Instructions/)).toBeInTheDocument();
    });
  });
});
