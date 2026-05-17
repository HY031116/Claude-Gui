/**
 * TaskViewFileSearch.test.tsx
 * 覆盖 TaskView（mock 子组件）+ FileSearchDropdown
 * 冲刺 40% 覆盖率目标
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../stores/useAppStore';

// 顶层 mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// ─── mock 复杂子组件（防止深层依赖爆炸） ──────────────────────────────────────
vi.mock('./ChatPanel', () => ({
  ChatPanel: () => <div data-testid="mock-chat-panel">ChatPanel</div>,
}));
vi.mock('./task/ReviewQueue', () => ({
  ReviewQueue: () => <div data-testid="mock-review-queue">ReviewQueue</div>,
}));
vi.mock('./task/TaskTimeline', () => ({
  TaskTimeline: () => <div data-testid="mock-task-timeline">TaskTimeline</div>,
}));

// ─── TaskView 测试 ────────────────────────────────────────────────────────────
describe('TaskView', () => {
  beforeEach(() => {
    useAppStore.setState({
      tokenUsage: null,
      toolCalls: [],
      messages: [],
    } as Parameters<typeof useAppStore.setState>[0]);
  });

  it('应渲染 ChatPanel 和 ReviewQueue', async () => {
    const { TaskView } = await import('./task/TaskView');
    render(<TaskView activeTabId="tab-1" />);
    expect(screen.getByTestId('mock-chat-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mock-review-queue')).toBeInTheDocument();
  });

  it('无 tokenUsage 时不显示 Token 监控条', async () => {
    const { TaskView } = await import('./task/TaskView');
    render(<TaskView activeTabId="tab-1" />);
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
  });

  it('有 tokenUsage 时应显示 Token 监控条', async () => {
    useAppStore.setState({
      tokenUsage: { inputTokens: 1500, outputTokens: 800, costUsd: 0.0123 },
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskView } = await import('./task/TaskView');
    render(<TaskView activeTabId="tab-1" />);
    // fmtK(1500) = "1.5K"
    expect(screen.getByText('1.5K')).toBeInTheDocument();
    // fmtK(800) = "800"
    expect(screen.getByText('800')).toBeInTheDocument();
    // 成本
    expect(screen.getByText('$0.0123')).toBeInTheDocument();
  });

  it('默认显示"变更审查"面板标题', async () => {
    const { TaskView } = await import('./task/TaskView');
    render(<TaskView activeTabId="tab-1" />);
    expect(screen.getByText('变更审查')).toBeInTheDocument();
  });

  it('点击收起按钮应折叠审查面板', async () => {
    const { TaskView } = await import('./task/TaskView');
    render(<TaskView activeTabId="tab-1" />);
    const collapseBtn = screen.getByTitle('收起审查面板');
    fireEvent.click(collapseBtn);
    // 折叠后标题不可见
    expect(screen.queryByText('变更审查')).not.toBeInTheDocument();
    // 展开按钮出现
    expect(screen.getByTitle('展开审查面板')).toBeInTheDocument();
  });

  it('折叠后再点击应展开审查面板', async () => {
    const { TaskView } = await import('./task/TaskView');
    render(<TaskView activeTabId="tab-1" />);
    const collapseBtn = screen.getByTitle('收起审查面板');
    fireEvent.click(collapseBtn);
    const expandBtn = screen.getByTitle('展开审查面板');
    fireEvent.click(expandBtn);
    expect(screen.getByText('变更审查')).toBeInTheDocument();
  });

  it('tokenUsage=0 时不显示监控条（inputTokens 为 0）', async () => {
    useAppStore.setState({
      tokenUsage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    } as Parameters<typeof useAppStore.setState>[0]);
    const { TaskView } = await import('./task/TaskView');
    const { container } = render(<TaskView activeTabId="tab-1" />);
    // task-token-bar 不应存在
    expect(container.querySelector('.task-token-bar')).not.toBeInTheDocument();
  });
});

// ─── FileSearchDropdown 测试 ─────────────────────────────────────────────────
describe('FileSearchDropdown', () => {
  const anchorRef = { current: null };
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnClose.mockClear();
    (window as unknown as Record<string, unknown>).electronAPI = {
      listFilesInDir: vi.fn().mockResolvedValue({ success: true, files: ['src/App.tsx', 'src/main.tsx', 'src/index.css'] }),
    };
  });

  it('cwd 为空时不渲染（返回 null）', async () => {
    // 清除 mock
    (window.electronAPI as Record<string, unknown>).listFilesInDir = vi.fn().mockResolvedValue({ success: true, files: [] });
    const { FileSearchDropdown } = await import('./task/FileSearchDropdown');
    const { container } = render(
      <FileSearchDropdown
        cwd=""
        query=""
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        anchorRef={anchorRef as React.RefObject<HTMLTextAreaElement | null>}
      />
    );
    // 空 cwd + 空 query 时 files 为空 → 等待 effect 运行后不渲染
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('有文件结果时应渲染列表（使用 role=listbox）', async () => {
    const { FileSearchDropdown } = await import('./task/FileSearchDropdown');
    render(
      <FileSearchDropdown
        cwd="/project"
        query="App"
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        anchorRef={anchorRef as React.RefObject<HTMLTextAreaElement | null>}
      />
    );
    // 先显示"搜索中…"，然后渲染结果
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('src/App.tsx')).toBeInTheDocument();
  });

  it('点击文件项应调用 onSelect', async () => {
    const { FileSearchDropdown } = await import('./task/FileSearchDropdown');
    render(
      <FileSearchDropdown
        cwd="/project"
        query="App"
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        anchorRef={anchorRef as React.RefObject<HTMLTextAreaElement | null>}
      />
    );
    await screen.findByRole('listbox');
    // 点击第一项（mousedown）
    fireEvent.mouseDown(screen.getByText('src/App.tsx'));
    expect(mockOnSelect).toHaveBeenCalledWith('src/App.tsx');
  });

  it('按 Escape 键应调用 onClose', async () => {
    const { FileSearchDropdown } = await import('./task/FileSearchDropdown');
    render(
      <FileSearchDropdown
        cwd="/project"
        query="src"
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        anchorRef={anchorRef as React.RefObject<HTMLTextAreaElement | null>}
      />
    );
    await screen.findByRole('listbox');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('鼠标悬停和点击应正确选中文件', async () => {
    const { FileSearchDropdown } = await import('./task/FileSearchDropdown');
    render(
      <FileSearchDropdown
        cwd="/project"
        query="src"
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        anchorRef={anchorRef as React.RefObject<HTMLTextAreaElement | null>}
      />
    );
    await screen.findByRole('listbox');
    // 悬停到第三项
    fireEvent.mouseEnter(screen.getByText('src/index.css').closest('li')!);
    // mousedown 选中
    fireEvent.mouseDown(screen.getByText('src/index.css').closest('li')!);
    expect(mockOnSelect).toHaveBeenCalledWith('src/index.css');
  });

  it('listFilesInDir 失败时应不渲染列表', async () => {
    (window.electronAPI as Record<string, unknown>).listFilesInDir = vi.fn().mockResolvedValue({ success: false });
    const { FileSearchDropdown } = await import('./task/FileSearchDropdown');
    const { container } = render(
      <FileSearchDropdown
        cwd="/project"
        query="test"
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        anchorRef={anchorRef as React.RefObject<HTMLTextAreaElement | null>}
      />
    );
    // 失败时 files=[] → 不渲染
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
