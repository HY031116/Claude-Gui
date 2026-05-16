/**
 * MoreComponents.test.tsx
 * 覆盖 WebModeBanner / AskQuestionsModal / useResizableSidebar / InterventionCenter
 * 冲刺 35% 覆盖率目标
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';

// ─── WebModeBanner 测试 ───────────────────────────────────────────────────────
describe('WebModeBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('Electron 环境下不渲染（返回 null）', async () => {
    // 有 electronAPI = Electron 环境，isElectron() 返回 true
    (window as unknown as Record<string, unknown>).electronAPI = {};
    const { WebModeBanner } = await import('./WebModeBanner');
    const { container } = render(<WebModeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Web 环境下应渲染横幅', async () => {
    // 无 electronAPI = Web 环境
    delete (window as unknown as Record<string, unknown>).electronAPI;
    const { WebModeBanner } = await import('./WebModeBanner');
    render(<WebModeBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Web 模式/)).toBeInTheDocument();
  });

  it('点击关闭按钮应隐藏横幅并写入 sessionStorage', async () => {
    delete (window as unknown as Record<string, unknown>).electronAPI;
    const { WebModeBanner } = await import('./WebModeBanner');
    render(<WebModeBanner />);
    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('web-banner-dismissed')).toBe('1');
  });

  it('sessionStorage 已标记时不显示横幅', async () => {
    sessionStorage.setItem('web-banner-dismissed', '1');
    delete (window as unknown as Record<string, unknown>).electronAPI;
    const { WebModeBanner } = await import('./WebModeBanner');
    const { container } = render(<WebModeBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});

// ─── AskQuestionsModal 测试 ───────────────────────────────────────────────────
describe('AskQuestionsModal', () => {
  const baseRequest = {
    id: 'req-001',
    toolName: 'AskUserQuestion' as const,
    questions: [
      {
        header: 'confirm',
        question: '是否继续执行？',
        options: [
          { label: '是', recommended: true },
          { label: '否' },
        ],
        allowFreeformInput: true,
      },
    ],
  };

  const mockOnSubmit = vi.fn();
  const mockOnSkip = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnSkip.mockClear();
  });

  it('应渲染问题标题和选项', async () => {
    const { AskQuestionsModal } = await import('./layout/AskQuestionsModal');
    render(
      <AskQuestionsModal
        request={baseRequest}
        pendingCount={1}
        submitting={false}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );
    expect(screen.getByText('需要你的选择')).toBeInTheDocument();
    expect(screen.getByText('是否继续执行？')).toBeInTheDocument();
    expect(screen.getByText('是')).toBeInTheDocument();
    expect(screen.getByText('否')).toBeInTheDocument();
  });

  it('标注"推荐"的选项应显示推荐标签', async () => {
    const { AskQuestionsModal } = await import('./layout/AskQuestionsModal');
    render(
      <AskQuestionsModal
        request={baseRequest}
        pendingCount={1}
        submitting={false}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );
    expect(screen.getByText('推荐')).toBeInTheDocument();
  });

  it('点击"跳过"按钮应调用 onSkip', async () => {
    const { AskQuestionsModal } = await import('./layout/AskQuestionsModal');
    render(
      <AskQuestionsModal
        request={baseRequest}
        pendingCount={1}
        submitting={false}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );
    // 页脚中的"跳过"按钮
    const skipBtn = screen.getAllByRole('button', { name: '跳过' })[0] ?? screen.getByText('跳过').closest('button')!;
    fireEvent.click(skipBtn!);
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('选择选项后点击"提交回答"应调用 onSubmit', async () => {
    const { AskQuestionsModal } = await import('./layout/AskQuestionsModal');
    render(
      <AskQuestionsModal
        request={baseRequest}
        pendingCount={1}
        submitting={false}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );
    // 选择"是"
    fireEvent.click(screen.getByText('是'));
    // 提交
    fireEvent.click(screen.getByText('提交回答'));
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ confirm: expect.objectContaining({ selected: ['是'] }) })
    );
  });

  it('多选模式下可以选中多个选项', async () => {
    const { AskQuestionsModal } = await import('./layout/AskQuestionsModal');
    const multiRequest = {
      ...baseRequest,
      questions: [
        {
          header: 'tools',
          question: '选择工具',
          multiSelect: true,
          options: [{ label: 'Bash' }, { label: 'Read' }, { label: 'Edit' }],
          allowFreeformInput: false,
        },
      ],
    };
    render(
      <AskQuestionsModal
        request={multiRequest}
        pendingCount={1}
        submitting={false}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );
    // 可多选标签
    expect(screen.getByText('可多选')).toBeInTheDocument();
    // 选择两个选项
    fireEvent.click(screen.getByText('Bash'));
    fireEvent.click(screen.getByText('Read'));
    fireEvent.click(screen.getByText('提交回答'));
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tools: expect.objectContaining({ selected: ['Bash', 'Read'] }) })
    );
  });

  it('pendingCount > 1 时应显示队列提示', async () => {
    const { AskQuestionsModal } = await import('./layout/AskQuestionsModal');
    render(
      <AskQuestionsModal
        request={baseRequest}
        pendingCount={3}
        submitting={false}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );
    expect(screen.getByText(/队列中还有 2 个问题请求/)).toBeInTheDocument();
  });

  it('submitting 状态下按钮应被禁用', async () => {
    const { AskQuestionsModal } = await import('./layout/AskQuestionsModal');
    render(
      <AskQuestionsModal
        request={baseRequest}
        pendingCount={1}
        submitting={true}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    );
    const submitBtn = screen.getByText('提交回答');
    expect(submitBtn).toBeDisabled();
  });
});

// ─── useResizableSidebar 测试 ─────────────────────────────────────────────────
describe('useResizableSidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('默认宽度应为 280', async () => {
    const { useResizableSidebar } = await import('../hooks/useResizableSidebar');
    const { result } = renderHook(() => useResizableSidebar());
    expect(result.current.sidebarWidth).toBe(280);
  });

  it('localStorage 中有存储值时应使用存储值', async () => {
    localStorage.setItem('claude-gui-sidebar-width', '360');
    const { useResizableSidebar } = await import('../hooks/useResizableSidebar');
    const { result } = renderHook(() => useResizableSidebar());
    expect(result.current.sidebarWidth).toBe(360);
  });

  it('存储值超过最大值时应钳制到 480', async () => {
    localStorage.setItem('claude-gui-sidebar-width', '600');
    const { useResizableSidebar } = await import('../hooks/useResizableSidebar');
    const { result } = renderHook(() => useResizableSidebar());
    expect(result.current.sidebarWidth).toBe(480);
  });

  it('存储值低于最小值时应钳制到 240', async () => {
    localStorage.setItem('claude-gui-sidebar-width', '100');
    const { useResizableSidebar } = await import('../hooks/useResizableSidebar');
    const { result } = renderHook(() => useResizableSidebar());
    expect(result.current.sidebarWidth).toBe(240);
  });

  it('mousedown 后 mousemove 应更新宽度并写入 localStorage', async () => {
    const { useResizableSidebar } = await import('../hooks/useResizableSidebar');
    const { result } = renderHook(() => useResizableSidebar());

    // 触发 handleResizeMouseDown
    act(() => {
      result.current.handleResizeMouseDown({
        clientX: 300,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    // 模拟 mousemove (+50px)
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 350 }));
    });

    expect(result.current.sidebarWidth).toBe(330); // 280 + 50
    expect(localStorage.getItem('claude-gui-sidebar-width')).toBe('330');
  });

  it('mouseup 后继续 mousemove 不应改变宽度', async () => {
    const { useResizableSidebar } = await import('../hooks/useResizableSidebar');
    const { result } = renderHook(() => useResizableSidebar());

    act(() => {
      result.current.handleResizeMouseDown({
        clientX: 300,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    const widthAfterStop = result.current.sidebarWidth;
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }));
    });

    // 宽度不变
    expect(result.current.sidebarWidth).toBe(widthAfterStop);
  });
});

// ─── InterventionCenter 测试 ──────────────────────────────────────────────────
describe('InterventionCenter', () => {
  const baseProps = {
    isOpen: true,
    pendingQuestions: [],
    pendingPermissions: [],
    pendingDecisions: [],
    pendingFiles: [],
    activeQuestionId: null,
    permissionRespondingId: null,
    onClose: vi.fn(),
    onFocusQuestion: vi.fn(),
    onFocusTab: vi.fn(),
    onDecisionReply: vi.fn(),
    onFileSkip: vi.fn(),
    onApprovePermission: vi.fn(),
    onDenyPermission: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=false 时不渲染（返回 null）', async () => {
    const { InterventionCenter } = await import('./layout/InterventionCenter');
    const { container } = render(<InterventionCenter {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('isOpen=true 时应渲染介入中心标题', async () => {
    const { InterventionCenter } = await import('./layout/InterventionCenter');
    render(<InterventionCenter {...baseProps} />);
    expect(screen.getByText('介入中心')).toBeInTheDocument();
  });

  it('无待处理项时应显示"共 0 项待处理"', async () => {
    const { InterventionCenter } = await import('./layout/InterventionCenter');
    render(<InterventionCenter {...baseProps} />);
    expect(screen.getByText('共 0 项待处理')).toBeInTheDocument();
  });

  it('无提问时应显示"当前没有待处理提问"', async () => {
    const { InterventionCenter } = await import('./layout/InterventionCenter');
    render(<InterventionCenter {...baseProps} />);
    expect(screen.getByText('当前没有待处理提问。')).toBeInTheDocument();
  });

  it('点击关闭按钮应调用 onClose', async () => {
    const { InterventionCenter } = await import('./layout/InterventionCenter');
    render(<InterventionCenter {...baseProps} />);
    fireEvent.click(screen.getByLabelText('关闭介入中心'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应调用 onClose', async () => {
    const { InterventionCenter } = await import('./layout/InterventionCenter');
    render(<InterventionCenter {...baseProps} />);
    const overlay = document.querySelector('.intervention-center-overlay')!;
    fireEvent.click(overlay);
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('有提问时应渲染提问卡片', async () => {
    const { InterventionCenter } = await import('./layout/InterventionCenter');
    const props = {
      ...baseProps,
      pendingQuestions: [
        {
          request: {
            id: 'q1',
            toolName: 'AskUserQuestion' as const,
            questions: [{ header: 'test', question: '这是一个测试问题', allowFreeformInput: true }],
          },
          tabLabel: '主会话',
          tabId: 'tab-1',
        },
      ],
    };
    render(<InterventionCenter {...props} />);
    expect(screen.getByText('这是一个测试问题')).toBeInTheDocument();
    expect(screen.getByText('主会话')).toBeInTheDocument();
    expect(screen.getByText('立即处理')).toBeInTheDocument();
  });

  it('点击"立即处理"应调用 onFocusQuestion', async () => {
    const { InterventionCenter } = await import('./layout/InterventionCenter');
    const onFocusQuestion = vi.fn();
    const props = {
      ...baseProps,
      onFocusQuestion,
      pendingQuestions: [
        {
          request: {
            id: 'q1',
            toolName: 'AskUserQuestion' as const,
            questions: [{ header: 'test', question: '问题', allowFreeformInput: true }],
          },
          tabLabel: '主会话',
          tabId: 'tab-1',
        },
      ],
    };
    render(<InterventionCenter {...props} />);
    fireEvent.click(screen.getByText('立即处理'));
    expect(onFocusQuestion).toHaveBeenCalledWith('q1', 'tab-1');
  });
});
