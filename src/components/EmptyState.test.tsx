/**
 * 组件空状态与错误处理集成测试
 * 覆盖：无后端时各组件应静默降级，正确展示空状态引导，不暴露原始错误信息
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// 全局 electronAPI mock
// ──────────────────────────────────────────
const mockElectronAPI = {
  agentList: vi.fn(),
  agentWrite: vi.fn(),
  agentDelete: vi.fn(),
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  listSkills: vi.fn(),
  pluginList: vi.fn(),
  checkClaudeMem: vi.fn(),
  onCliOutput: vi.fn().mockReturnValue(() => {}),
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  listAgents: vi.fn(),
  getAuthStatus: vi.fn(),
  loadCliConfig: vi.fn(),
  getCliConfigPath: vi.fn(),
  cliStart: vi.fn(),
  cliSend: vi.fn(),
  cliStop: vi.fn(),
  cliSendMessage: vi.fn(),
  cliStopMessage: vi.fn(),
  cliSendToStdin: vi.fn(),
  cliRespondPermission: vi.fn(),
  cliRespondQuestion: vi.fn(),
  gitStatus: vi.fn(),
  selectDirectory: vi.fn(),
  writeFile: vi.fn(),
};

beforeEach(() => {
  // 重置所有 mock 为拒绝态（模拟无后端）
  Object.values(mockElectronAPI).forEach((fn) => {
    if (typeof fn === 'function' && fn !== mockElectronAPI.onCliOutput) {
      (fn as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'));
    }
  });
  // onCliOutput 返回清理函数即可
  mockElectronAPI.onCliOutput.mockReturnValue(() => {});

  // 挂载到 window
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
});

// ──────────────────────────────────────────
// AgentPanel：fetch 失败不暴露原始错误
// ──────────────────────────────────────────
describe('AgentPanel - fetch 失败时静默降级', () => {
  it('agentList 失败后不应显示 TypeError 原始信息', async () => {
    // 延迟导入避免模块初始化时机问题
    const { AgentPanel } = await import('./AgentPanel');
    render(<AgentPanel />);

    await waitFor(() => {
      // 不应看到原始 TypeError 文字
      expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    });
  });

  it('agentList 失败后应显示"暂无自定义 Agent"空状态', async () => {
    const { AgentPanel } = await import('./AgentPanel');
    render(<AgentPanel />);

    await waitFor(() => {
      expect(screen.getByText(/暂无自定义 Agent/)).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// FileExplorer：currentPath 为空时显示引导
// ──────────────────────────────────────────
describe('FileExplorer - currentPath 为空时的空状态', () => {
  beforeEach(() => {
    // 确保 currentPath 和 entries 都是空的
    useAppStore.setState({ currentPath: '', entries: [] });
  });

  it('无工作目录时应显示引导文案', async () => {
    const { FileExplorer } = await import('./FileExplorer');
    render(<FileExplorer />);

    await waitFor(() => {
      expect(screen.getByText('请先在委派视图中设置工作目录')).toBeInTheDocument();
    });
  });

  it('无工作目录时应显示"设置后文件列表将自动加载"说明', async () => {
    const { FileExplorer } = await import('./FileExplorer');
    render(<FileExplorer />);

    await waitFor(() => {
      expect(screen.getByText(/设置后文件列表将自动加载/)).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// SkillsPanel：无 cwd 时显示引导按钮
// ──────────────────────────────────────────
describe('SkillsPanel - 无 cwd 时的空状态引导', () => {
  beforeEach(() => {
    // cwd 为空（无工作目录）
    useAppStore.setState({ cwd: '' });
  });

  it('无 cwd 时应显示"请先开启会话"提示', async () => {
    const { SkillsPanel } = await import('./SkillsPanel');
    render(<SkillsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/请先开启会话/)).toBeInTheDocument();
    });
  });

  it('无 cwd 时应显示"前往委派"导航按钮', async () => {
    const { SkillsPanel } = await import('./SkillsPanel');
    render(<SkillsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /前往委派/ })).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// PluginPanel：fetch 失败不永久卡在加载中
// ──────────────────────────────────────────
describe('PluginPanel - fetch 失败后退出 loading 状态', () => {
  it('pluginList 失败后加载状态应解除，不显示无限 loading', async () => {
    const m = await import('./PluginPanel');
    const PluginPanel = m.default;
    render(<PluginPanel />);

    await waitFor(() => {
      // 加载完成后不应有永久旋转指示器（通过检查文字内容间接验证）
      // 组件加载完成后应显示空列表或空状态文字，而不是"加载中"
      const loadingEl = screen.queryByText(/加载中/);
      expect(loadingEl).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
