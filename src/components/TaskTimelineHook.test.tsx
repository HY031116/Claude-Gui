/**
 * TaskTimelineHook.test.tsx
 * 覆盖 TaskTimeline（工具调用执行时序面板）+ useCliOutput hook
 * 冲刺 40% 覆盖率目标
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../stores/useAppStore';
import type { Message } from '../types';

// 顶层 mock scrollIntoView（TaskTimeline 有 scrollIntoView 调用）
Element.prototype.scrollIntoView = vi.fn();

// ─── TaskTimeline 测试 ────────────────────────────────────────────────────────
describe('TaskTimeline', () => {
  // 构造携带 toolCalls 的 assistant 消息
  function makeMsg(toolCalls: Message['toolCalls']): Message {
    return {
      id: `msg-${Math.random()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolCalls,
    };
  }

  beforeEach(() => {
    useAppStore.setState({
      messages: [],
      activePlanSteps: [],
    } as Parameters<typeof useAppStore.setState>[0]);
  });

  it('无工具调用时应不渲染（返回 null）', async () => {
    const { TaskTimeline } = await import('./task/TaskTimeline');
    const { container } = render(<TaskTimeline />);
    expect(container).toBeEmptyDOMElement();
  });

  it('有工具调用时应显示"执行时序"标题', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([
          { id: 'tc1', name: 'Bash', status: 'success', arguments: { command: 'ls -la' } },
        ]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    expect(screen.getByText('执行时序')).toBeInTheDocument();
  });

  it('应正确统计完成/总数（1/1）', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([
          { id: 'tc1', name: 'Read', status: 'success', arguments: { file_path: '/src/index.ts' } },
        ]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    expect(screen.getByText(/1\/1/)).toBeInTheDocument();
  });

  it('应渲染 Bash 工具行并显示命令摘要', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([
          { id: 'tc1', name: 'Bash', status: 'success', arguments: { command: 'npm install' } },
        ]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    // 工具名显示为 "Bash"
    expect(screen.getByText('Bash')).toBeInTheDocument();
    // 命令摘要
    expect(screen.getByText('npm install')).toBeInTheDocument();
  });

  it('pending 状态工具应显示"运行中"', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([
          { id: 'tc1', name: 'Bash', status: 'pending', arguments: { command: 'build' } },
        ]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    expect(screen.getByText('运行中')).toBeInTheDocument();
  });

  it('error 状态时应在统计中显示"错误"', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([
          { id: 'tc1', name: 'Bash', status: 'error', arguments: {} },
        ]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    expect(screen.getByText(/错误/)).toBeInTheDocument();
  });

  it('点击标题栏应折叠时序列表', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([
          { id: 'tc1', name: 'Read', status: 'success', arguments: { file_path: '/a.ts' } },
        ]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    // 折叠前工具名可见
    expect(screen.getByText('Read')).toBeInTheDocument();
    // 通过折叠按钮折叠
    const collapseBtn = screen.getByLabelText('折叠执行时序');
    fireEvent.click(collapseBtn);
    // 折叠后工具名不可见
    expect(screen.queryByText('Read')).not.toBeInTheDocument();
  });

  it('点击折叠按钮应切换展开状态', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([
          { id: 'tc1', name: 'Write', status: 'success', arguments: { file_path: '/b.ts' } },
        ]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    const collapseBtn = screen.getByLabelText('折叠执行时序');
    fireEvent.click(collapseBtn);
    // 折叠后按钮变为"展开"
    expect(screen.getByLabelText('展开执行时序')).toBeInTheDocument();
  });

  it('应渲染 Read 工具的文件路径摘要', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([
          { id: 'tc1', name: 'Read', status: 'success', arguments: { file_path: '/project/src/utils/helper.ts' } },
        ]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    // 长路径会被截断为 …/src/utils/helper.ts
    expect(screen.getByText(/helper\.ts/)).toBeInTheDocument();
  });

  it('activePlanSteps 不为空时应渲染进度条', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([{ id: 'tc1', name: 'Read', status: 'success', arguments: {} }]),
      ],
      activePlanSteps: [
        { id: 'step1', text: '步骤一', status: 'done' },
        { id: 'step2', text: '步骤二', status: 'running' },
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    // 进度条标题有 "1 / 2 步骤完成" 提示
    const progressEl = document.querySelector('.task-plan-progress');
    expect(progressEl).toBeInTheDocument();
  });

  it('多条 assistant 消息中的 toolCalls 应合并显示', async () => {
    useAppStore.setState({
      messages: [
        makeMsg([{ id: 'tc1', name: 'Read', status: 'success', arguments: {} }]),
        makeMsg([{ id: 'tc2', name: 'Edit', status: 'success', arguments: { file_path: '/foo.ts' } }]),
      ],
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskTimeline } = await import('./task/TaskTimeline');
    render(<TaskTimeline />);
    // 统计：2/2
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
  });
});

// ─── useCliOutput 测试 ────────────────────────────────────────────────────────
describe('useCliOutput', () => {
  beforeEach(() => {
    // 重置 store
    useAppStore.setState({
      terminalLines: [],
      messages: [],
      session: { isConnected: false, workingDirectory: '' },
      tokenHistory: [],
    } as Parameters<typeof useAppStore.setState>[0]);
    // 清除 electronAPI
    delete (window as unknown as Record<string, unknown>).electronAPI;
  });

  it('无 electronAPI 时 hook 挂载不报错', async () => {
    const { useCliOutput } = await import('../hooks/useCliOutput');
    expect(() => renderHook(() => useCliOutput())).not.toThrow();
  });

  it('有 electronAPI 时应调用 onCliOutput 注册监听', async () => {
    const mockUnsubscribe = vi.fn();
    const mockOnCliOutput = vi.fn().mockReturnValue(mockUnsubscribe);
    (window as unknown as Record<string, unknown>).electronAPI = {
      onCliOutput: mockOnCliOutput,
    };
    const { useCliOutput } = await import('../hooks/useCliOutput');
    const { unmount } = renderHook(() => useCliOutput());
    expect(mockOnCliOutput).toHaveBeenCalledTimes(1);
    unmount();
    // 卸载时应调用取消订阅函数
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('stdout 事件应通过 RAF 批次写入 terminalLines', async () => {
    vi.useFakeTimers();
    let capturedCallback: ((event: { type: string; data: string }) => void) | null = null;
    (window as unknown as Record<string, unknown>).electronAPI = {
      onCliOutput: vi.fn((cb: (event: { type: string; data: string }) => void) => {
        capturedCallback = cb;
        return vi.fn(); // unsubscribe
      }),
    };
    const { useCliOutput } = await import('../hooks/useCliOutput');
    renderHook(() => useCliOutput());

    act(() => {
      capturedCallback!({ type: 'stdout', data: 'Hello Output' });
    });

    // RAF 未触发前 terminalLines 还是空
    // 触发 RAF
    act(() => {
      vi.runAllTimers();
    });

    const lines = useAppStore.getState().terminalLines;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].type).toBe('stdout');
    expect(lines[0].content).toBe('Hello Output');
    vi.useRealTimers();
  });

  it('exit 事件应清除 session.pid', async () => {
    vi.useFakeTimers();
    let capturedCallback: ((event: { type: string; data: string }) => void) | null = null;
    (window as unknown as Record<string, unknown>).electronAPI = {
      onCliOutput: vi.fn((cb: (event: { type: string; data: string }) => void) => {
        capturedCallback = cb;
        return vi.fn();
      }),
    };
    useAppStore.setState({
      session: { isConnected: true, workingDirectory: '/proj', pid: 1234 },
    } as Parameters<typeof useAppStore.setState>[0]);

    const { useCliOutput } = await import('../hooks/useCliOutput');
    renderHook(() => useCliOutput());

    act(() => {
      capturedCallback!({ type: 'exit', data: '' });
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(useAppStore.getState().session.pid).toBeUndefined();
    vi.useRealTimers();
  });

  it('message-* 类型事件不应写入 terminalLines', async () => {
    vi.useFakeTimers();
    let capturedCallback: ((event: { type: string; data: string }) => void) | null = null;
    (window as unknown as Record<string, unknown>).electronAPI = {
      onCliOutput: vi.fn((cb: (event: { type: string; data: string }) => void) => {
        capturedCallback = cb;
        return vi.fn();
      }),
    };
    const { useCliOutput } = await import('../hooks/useCliOutput');
    renderHook(() => useCliOutput());

    act(() => {
      capturedCallback!({ type: 'message-chunk', data: 'some chat content' });
    });
    act(() => {
      vi.runAllTimers();
    });

    const lines = useAppStore.getState().terminalLines;
    expect(lines.length).toBe(0);
    vi.useRealTimers();
  });
});
