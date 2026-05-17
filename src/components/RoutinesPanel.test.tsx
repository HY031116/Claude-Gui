/**
 * RoutinesPanel 单元测试
 * v4.9.0 FEAT-411：定时任务面板基础渲染和交互测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Routine } from '../types/electron';

// ── 模拟 electronAPI ──────────────────────────────────────────────────────

const mockRoutine: Routine = {
  id: 'routine-test-001',
  name: '每日代码检查',
  prompt: '检查项目中的 TODO 注释，整理成报告',
  cwd: '/workspace/project',
  cronExpr: '0 9 * * *',
  enabled: true,
  createdAt: Date.now() - 86400000,
  lastRunAt: Date.now() - 3600000,
  history: [
    { runAt: Date.now() - 3600000, success: true },
    { runAt: Date.now() - 7200000, success: false, error: '执行超时' },
  ],
};

const mockRoutinesDisabled: Routine = {
  id: 'routine-test-002',
  name: '周报生成',
  prompt: '生成本周工作报告',
  cwd: '/workspace',
  cronExpr: '0 18 * * 5',
  enabled: false,
  createdAt: Date.now() - 604800000,
  history: [],
};

const mockElectronAPI = {
  routinesList: vi.fn().mockResolvedValue([mockRoutine, mockRoutinesDisabled]),
  routinesCreate: vi.fn().mockResolvedValue({ success: true, routine: { ...mockRoutine, id: 'new-001', name: '新任务' } }),
  routinesUpdate: vi.fn().mockResolvedValue({ success: true, routine: { ...mockRoutine, enabled: false } }),
  routinesDelete: vi.fn().mockResolvedValue({ success: true }),
  routinesRunNow: vi.fn().mockResolvedValue({ success: true }),
  routinesValidateCron: vi.fn().mockResolvedValue({ valid: true }),
  onRoutinesUpdated: vi.fn().mockReturnValue(() => {}),
  selectDirectory: vi.fn().mockResolvedValue({ success: true, path: '/selected/dir' }),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
  configurable: true,
});

// ── 基础渲染测试 ──────────────────────────────────────────────────────────

describe('RoutinesPanel - 基础渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.routinesList.mockResolvedValue([mockRoutine, mockRoutinesDisabled]);
  });

  it('加载后应显示任务列表', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByText('每日代码检查')).toBeInTheDocument();
    });

    expect(screen.getByText('周报生成')).toBeInTheDocument();
  });

  it('应显示「新建任务」按钮', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新建任务/ })).toBeInTheDocument();
    });
  });

  it('应显示任务的 cron 表达式', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByText('0 9 * * *')).toBeInTheDocument();
    });
  });

  it('已禁用任务应有「已暂停」标签', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByText('· 已暂停')).toBeInTheDocument();
    });
  });
});

// ── 空状态测试 ────────────────────────────────────────────────────────────

describe('RoutinesPanel - 空状态', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.routinesList.mockResolvedValue([]);
  });

  it('无任务时应显示空状态说明', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByText('还没有定时任务')).toBeInTheDocument();
    });
  });

  it('空状态下应显示「创建第一个任务」按钮', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /创建第一个任务/ })).toBeInTheDocument();
    });
  });
});

// ── 交互测试 ──────────────────────────────────────────────────────────────

describe('RoutinesPanel - 交互', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.routinesList.mockResolvedValue([mockRoutine]);
  });

  it('点击「新建任务」应显示创建表单', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新建任务/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /新建任务/ }));

    await waitFor(() => {
      expect(screen.getByText('新建定时任务')).toBeInTheDocument();
    });
  });

  it('点击「取消」应关闭创建表单', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新建任务/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /新建任务/ }));
    await waitFor(() => {
      expect(screen.getByText('新建定时任务')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /取消/ }));
    await waitFor(() => {
      expect(screen.queryByText('新建定时任务')).not.toBeInTheDocument();
    });
  });

  it('点击任务行应展开详情（显示提示词预览）', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByText('每日代码检查')).toBeInTheDocument();
    });

    // 点击任务名称所在区域（routine-info 区域）
    fireEvent.click(screen.getByText('每日代码检查'));

    await waitFor(() => {
      expect(screen.getByText(/提示词：/)).toBeInTheDocument();
    });
  });

  it('调用 routinesList 一次', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(mockElectronAPI.routinesList).toHaveBeenCalledTimes(1);
    });
  });

  it('点击「立即执行」应调用 routinesRunNow', async () => {
    const { RoutinesPanel } = await import('./RoutinesPanel');
    render(<RoutinesPanel />);

    await waitFor(() => {
      expect(screen.getByTitle('立即执行一次')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('立即执行一次'));

    await waitFor(() => {
      expect(mockElectronAPI.routinesRunNow).toHaveBeenCalledWith(mockRoutine.id);
    });
  });
});
