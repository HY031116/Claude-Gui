/**
 * LaunchPanel 集成测试
 * 覆盖：标题渲染、工作目录、任务描述、按钮状态、内置模板、API 调用
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock
// ──────────────────────────────────────────
const mockElectronAPI = {
  loadSettings: vi.fn().mockResolvedValue({ success: true, settings: {} }),
  saveSettings: vi.fn().mockResolvedValue({ success: true }),
  listAgents: vi.fn().mockResolvedValue({ success: true, agents: [] }),
  listSkills: vi.fn().mockResolvedValue({ success: true, skills: [] }),
  selectDirectory: vi.fn().mockResolvedValue({ success: false }), // 默认取消
  listDirectory: vi.fn().mockResolvedValue({ success: true, entries: [] }),
  readFile: vi.fn().mockResolvedValue({ success: true, content: '' }),
  cliSendMessage: vi.fn().mockResolvedValue({ success: true }),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.loadSettings.mockResolvedValue({ success: true, settings: {} });
  mockElectronAPI.listAgents.mockResolvedValue({ success: true, agents: [] });
  mockElectronAPI.listSkills.mockResolvedValue({ success: true, skills: [] });
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
    tabs: [{ id: 'tab-1', label: '新任务', workingDirectory: '' }],
    activeTabId: 'tab-1',
  });
});

// ──────────────────────────────────────────
// 情景 1：基础渲染（Electron 模式）
// ──────────────────────────────────────────
describe('LaunchPanel - 基础渲染', () => {
  it('应显示"委派新任务"标题', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByText('委派新任务')).toBeInTheDocument();
  });

  it('应显示"工作目录"标签', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByText('工作目录')).toBeInTheDocument();
  });

  it('无工作目录时应显示"（未选择项目目录）"', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByText('（未选择项目目录）')).toBeInTheDocument();
  });

  it('应显示"更换目录"按钮（Electron 模式）', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByRole('button', { name: /更换目录/ })).toBeInTheDocument();
  });

  it('应显示"任务描述"标签', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByText('任务描述')).toBeInTheDocument();
  });

  it('任务描述 textarea 应有正确 placeholder', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    const textarea = screen.getByPlaceholderText(/描述你想要完成的任务/);
    expect(textarea).toBeInTheDocument();
  });

  it('应显示"快速模板"区域', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByText('快速模板')).toBeInTheDocument();
  });

  it('应显示内置模板"🔁 修 Bug"', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByText('🔁 修 Bug')).toBeInTheDocument();
  });

  it('应显示内置模板"📝 写测试"', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByText('📝 写测试')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────
// 情景 2：API 调用验证
// ──────────────────────────────────────────
describe('LaunchPanel - 挂载时 API 调用', () => {
  it('挂载时应调用 listAgents', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    await waitFor(() => {
      expect(mockElectronAPI.listAgents).toHaveBeenCalled();
    });
  });

  it('挂载时应调用 listSkills', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    await waitFor(() => {
      expect(mockElectronAPI.listSkills).toHaveBeenCalled();
    });
  });
});

// ──────────────────────────────────────────
// 情景 3：按钮状态控制
// ──────────────────────────────────────────
describe('LaunchPanel - 按钮状态', () => {
  it('无工作目录时"启动任务"按钮应为禁用', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    const btn = screen.getByRole('button', { name: /启动任务/ });
    expect(btn).toBeDisabled();
  });

  it('有工作目录但无任务描述时"启动任务"按钮应为禁用', async () => {
    useAppStore.setState({
      session: { isConnected: false, workingDirectory: '/project' },
    });
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    const btn = screen.getByRole('button', { name: /启动任务/ });
    expect(btn).toBeDisabled();
  });

  it('有工作目录且有任务描述时"启动任务"按钮应可用', async () => {
    useAppStore.setState({
      session: { isConnected: false, workingDirectory: '/project' },
    });
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    const textarea = screen.getByPlaceholderText(/描述你想要完成的任务/);
    fireEvent.change(textarea, { target: { value: '帮我写一个测试' } });
    const btn = screen.getByRole('button', { name: /启动任务/ });
    expect(btn).not.toBeDisabled();
  });
});

// ──────────────────────────────────────────
// 情景 4：有工作目录时渲染路径
// ──────────────────────────────────────────
describe('LaunchPanel - 已选择工作目录', () => {
  beforeEach(() => {
    useAppStore.setState({
      session: { isConnected: false, workingDirectory: '/home/user/project' },
    });
  });

  it('应在目录区域显示完整路径', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.getByText('/home/user/project')).toBeInTheDocument();
  });

  it('不应再显示"（未选择项目目录）"', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    expect(screen.queryByText('（未选择项目目录）')).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────
// 情景 5：模板填充交互
// ──────────────────────────────────────────
describe('LaunchPanel - 模板填充', () => {
  it('点击"🔁 修 Bug"模板应填充任务描述', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);

    const template = screen.getByText('🔁 修 Bug');
    fireEvent.click(template);

    const textarea = screen.getByPlaceholderText(/描述你想要完成的任务/);
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toContain('修复以下问题');
    });
  });
});

// ──────────────────────────────────────────
// 情景 6：API 失败降级
// ──────────────────────────────────────────
describe('LaunchPanel - API 失败降级', () => {
  beforeEach(() => {
    mockElectronAPI.loadSettings.mockRejectedValue(new Error('网络错误'));
    mockElectronAPI.listAgents.mockRejectedValue(new Error('网络错误'));
    mockElectronAPI.listSkills.mockRejectedValue(new Error('网络错误'));
  });

  it('所有 API 失败时仍应正常渲染（不崩溃）', async () => {
    const { LaunchPanel } = await import('./LaunchPanel');
    render(<LaunchPanel />);
    await waitFor(() => {
      expect(screen.getByText('委派新任务')).toBeInTheDocument();
    });
  });
});
