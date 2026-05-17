/**
 * CheckpointPanel.test.tsx
 * 测试 CheckpointPanel 时间轴视图（FEAT-512）：
 * 空状态、Checkpoint 列表渲染、展开/折叠、回滚确认弹窗
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

    expect(screen.getByText('暂无文件修改记录')).toBeInTheDocument();
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

    expect(screen.getByText('暂无文件修改记录')).toBeInTheDocument();
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

    expect(screen.getByText('暂无文件修改记录')).toBeInTheDocument();
  });
});

// ── 有记录时的渲染 ────────────────────────────────────────────────────────────

describe('CheckpointPanel - 有记录', () => {
  it('Write 操作显示时间轴快照数量', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('w1', '/project/src/App.tsx'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText(/变更时间轴（1 个快照）/)).toBeInTheDocument();
    expect(screen.getByText(/1 个文件变更/)).toBeInTheDocument();
  });

  it('多个消息各自生成独立 Checkpoint', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('w3', '/proj/a.ts'));
    useAppStore.getState().addMessage(makeWriteMsg('w4', '/proj/b.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText(/变更时间轴（2 个快照）/)).toBeInTheDocument();
    expect(screen.getByText(/共 2 次文件操作/)).toBeInTheDocument();
  });

  it('Edit 操作显示"编辑"操作标签', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeEditMsg('e1', '/proj/utils.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('Write 操作显示"写入"操作标签', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('w5', '/proj/main.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByText('写入')).toBeInTheDocument();
  });

  it('每个 Checkpoint 显示"回滚到此点"按钮', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('roll1', '/proj/index.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    expect(screen.getByRole('button', { name: /回滚到此点/ })).toBeInTheDocument();
  });
});

// ── 展开 / 折叠 ───────────────────────────────────────────────────────────────

describe('CheckpointPanel - 展开/折叠', () => {
  it('点击 Checkpoint 标题可展开和折叠文件列表', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('fold1', '/proj/index.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    // 初始折叠，找不到 title
    expect(screen.queryByTitle('/proj/index.ts')).not.toBeInTheDocument();

    // 直接点击文字 span（事件冒泡到有 onClick 的父 div）
    fireEvent.click(screen.getByText(/1 个文件变更/));
    expect(screen.getByTitle('/proj/index.ts')).toBeInTheDocument();

    // 再次点击折叠
    fireEvent.click(screen.getByText(/1 个文件变更/));
    expect(screen.queryByTitle('/proj/index.ts')).not.toBeInTheDocument();
  });
});

// ── 回滚确认弹窗 ──────────────────────────────────────────────────────────────

describe('CheckpointPanel - 回滚确认弹窗', () => {
  it('点击"回滚到此点"显示确认弹窗', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('dlg1', '/workspace/project/src/App.tsx'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /回滚到此点/ }));

    expect(screen.getByText('确认回滚到此快照点？')).toBeInTheDocument();
    // shortPath('/workspace/project/src/App.tsx') = 'project/src/App.tsx'
    expect(screen.getByText('project/src/App.tsx')).toBeInTheDocument();
  });

  it('点击"取消"关闭确认弹窗', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('dlg2', '/proj/index.tsx'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /回滚到此点/ }));
    expect(screen.getByText('确认回滚到此快照点？')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByText('确认回滚到此快照点？')).not.toBeInTheDocument();
  });

  it('点击遮罩层关闭确认弹窗', async () => {
    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('dlg3', '/proj/store.ts'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    const { container } = render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /回滚到此点/ }));
    expect(screen.getByText('确认回滚到此快照点？')).toBeInTheDocument();

    const overlay = container.querySelector('[style*="position: fixed"]') as HTMLElement;
    fireEvent.click(overlay);
    expect(screen.queryByText('确认回滚到此快照点？')).not.toBeInTheDocument();
  });

  it('只有一个 checkpoint 时回滚自身 entries', async () => {
    mockElectronAPI.writeFile.mockResolvedValue({ success: true });

    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('single', '/proj/target.ts', '旧内容'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /回滚到此点/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '确认回滚' }));
    });

    await waitFor(() => {
      expect(mockElectronAPI.writeFile).toHaveBeenCalledWith('/proj/target.ts', '旧内容');
    });
    await waitFor(() => {
      expect(screen.getByText('已回滚')).toBeInTheDocument();
    });
  });

  it('writeFile 失败时显示"失败"提示', async () => {
    mockElectronAPI.writeFile.mockResolvedValue({ success: false });

    const { useAppStore } = await import('../stores/useAppStore');
    useAppStore.getState().clearMessages();
    useAppStore.getState().addMessage(makeWriteMsg('restore2', '/proj/fail.ts', '旧内容'));

    const { CheckpointPanel } = await import('./CheckpointPanel');
    render(<CheckpointPanel />);

    fireEvent.click(screen.getByRole('button', { name: /回滚到此点/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '确认回滚' }));
    });

    await waitFor(() => {
      expect(screen.getByText('失败')).toBeInTheDocument();
    });
  });
});
