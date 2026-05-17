/**
 * CheckpointPanel.test.tsx
 * 测试 CheckpointPanel：空状态、有记录、展开/折叠、确认还原弹窗
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import React from 'react';

const mockElectronAPI = {
  writeFile: vi.fn(),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.resetModules();
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).electronAPI;
});

// ── 辅助：构造带有 toolCalls 的 message ───────────────────────────────────────

function makeWriteMsg(id: string, filePath: string, originalContent = '旧内容') {
  return {
    id,
    role: 'assistant' as const,
    content: '',
    timestamp: Date.now(),
    toolCalls: [
      {
        id: `tc-${id}`,
        name: 'Write',
        arguments: { file_path: filePath, content: '新内容' },
        status: 'success' as const,
        originalContent,
      },
    ],
  };
}

function makeEditMsg(id: string, filePath: string) {
  return {
    id,
    role: 'assistant' as const,
    content: '',
    timestamp: Date.now(),
    toolCalls: [
      {
        id: `tc-${id}`,
        name: 'Edit',
        arguments: { file_path: filePath },
        status: 'success' as const,
        originalContent: '编辑前内容',
      },
    ],
  };
}

// ── 空状态测试 ────────────────────────────────────────────────────────────────

describe('CheckpointPanel - 空状态', () => {
  it('无消息时显示"暂无文件修改记录"', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText('当前会话暂无文件修改记录')).toBeInTheDocument();
  });

  it('消息中没有 Write/Edit toolCalls 时显示空状态', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage({
      id: 'text-msg',
      role: 'user',
      content: '普通文本消息',
      timestamp: Date.now(),
    });

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText('当前会话暂无文件修改记录')).toBeInTheDocument();
  });

  it('toolCalls 状态不是 success 时不显示记录', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage({
      id: 'pending-msg',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolCalls: [
        {
          id: 'tc-p',
          name: 'Write',
          arguments: { file_path: '/tmp/file.ts' },
          status: 'pending' as const,
          originalContent: '旧内容',
        },
      ],
    });

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText('当前会话暂无文件修改记录')).toBeInTheDocument();
  });
});

// ── 有记录时的渲染 ────────────────────────────────────────────────────────────

describe('CheckpointPanel - 有记录', () => {
  it('Write 操作显示文件快照条目数量', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('w1', '/project/src/App.tsx'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText(/文件快照（1 条）/)).toBeInTheDocument();
    expect(screen.getByText(/共 1 个文件/)).toBeInTheDocument();
  });

  it('显示文件路径的后 3 段（短路径）', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('w2', '/very/long/project/src/components/App.tsx'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText('src/components/App.tsx')).toBeInTheDocument();
  });

  it('多个文件显示正确的分组数量', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('w3', '/proj/a.ts'));
    useAppStore.getState().addMessage(makeWriteMsg('w4', '/proj/b.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText(/文件快照（2 条）/)).toBeInTheDocument();
    expect(screen.getByText(/共 2 个文件/)).toBeInTheDocument();
  });

  it('Edit 操作显示"编辑"标签（点击展开后可见）', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeEditMsg('e1', '/proj/utils.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    // 展开文件组
    const toggleBtn = screen.getByRole('button', { name: /utils.ts/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('Write 操作展开后显示"写入"标签和"还原"按钮', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('w5', '/proj/main.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    const toggleBtn = screen.getByRole('button', { name: /main.ts/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('写入')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /还原/ })).toBeInTheDocument();
  });
});

// ── 展开 / 折叠 ───────────────────────────────────────────────────────────────

describe('CheckpointPanel - 展开/折叠', () => {
  it('点击文件标题可展开和折叠条目列表', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('fold1', '/proj/index.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    const toggleBtn = screen.getByRole('button', { name: /index.ts/i });

    // 初始折叠，不显示"还原"
    expect(screen.queryByRole('button', { name: /还原/ })).not.toBeInTheDocument();

    // 点击展开
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /还原/ })).toBeInTheDocument();

    // 再次点击折叠
    fireEvent.click(toggleBtn);
    expect(screen.queryByRole('button', { name: /还原/ })).not.toBeInTheDocument();
  });
});

// ── 确认还原弹窗 ──────────────────────────────────────────────────────────────

describe('CheckpointPanel - 确认还原弹窗', () => {
  it('点击"还原"按钮显示确认弹窗', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('dlg1', '/workspace/project/src/components/App.tsx'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    // 展开（shortPath 只显示最后 3 段）
    fireEvent.click(screen.getByRole('button', { name: /App.tsx/i }));
    // 点击还原
    fireEvent.click(screen.getByRole('button', { name: /还原/ }));

    expect(screen.getByText('确认还原文件？')).toBeInTheDocument();
    // 确认弹窗显示完整路径
    expect(screen.getByText('/workspace/project/src/components/App.tsx')).toBeInTheDocument();
  });

  it('点击"取消"关闭确认弹窗', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('dlg2', '/proj/index.tsx'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /index.tsx/i }));
    fireEvent.click(screen.getByRole('button', { name: /还原/ }));
    expect(screen.getByText('确认还原文件？')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByText('确认还原文件？')).not.toBeInTheDocument();
  });

  it('点击遮罩层关闭确认弹窗', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('dlg3', '/proj/store.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    const { container } = render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /store.ts/i }));
    fireEvent.click(screen.getByRole('button', { name: /还原/ }));
    expect(screen.getByText('确认还原文件？')).toBeInTheDocument();

    // 点击遮罩（position:fixed 的外层 div，不是弹窗内容区）
    const overlay = container.querySelector('[style*="position: fixed"]') as HTMLElement;
    fireEvent.click(overlay);
    expect(screen.queryByText('确认还原文件？')).not.toBeInTheDocument();
  });

  it('点击"确认还原"调用 writeFile 并显示"已还原"', async () => {
    mockElectronAPI.writeFile.mockResolvedValue({ success: true });

    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('restore1', '/proj/target.ts', '旧内容'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /target.ts/i }));
    fireEvent.click(screen.getByRole('button', { name: /还原/ }));
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '确认还原' }));
    });

    await waitFor(() => {
      expect(mockElectronAPI.writeFile).toHaveBeenCalledWith('/proj/target.ts', '旧内容');
    });
    await waitFor(() => {
      expect(screen.getByText('已还原')).toBeInTheDocument();
    });
  });

  it('writeFile 失败时显示"失败"提示', async () => {
    mockElectronAPI.writeFile.mockResolvedValue({ success: false });

    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('restore2', '/proj/fail.ts', '旧内容'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /fail.ts/i }));
    fireEvent.click(screen.getByRole('button', { name: /还原/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '确认还原' }));
    });

    await waitFor(() => {
      expect(screen.getByText('失败')).toBeInTheDocument();
    });
  });
});
