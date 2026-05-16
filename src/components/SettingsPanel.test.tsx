/**
 * SettingsPanel 测试
 * 覆盖：渲染标题、默认 tab、tab 切换、保存按钮、API 调用
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock（SettingsPanel 挂载时调用 4 个 API）
// ──────────────────────────────────────────
const mockElectronAPI = {
  getCliConfigPath: vi.fn().mockResolvedValue({ success: true, path: '/home/.claude/settings.json' }),
  loadCliConfig: vi.fn().mockResolvedValue({ success: true, settings: {} }),
  loadSettings: vi.fn().mockResolvedValue({ success: true, settings: {} }),
  getAuthStatus: vi.fn().mockResolvedValue({ success: true, status: null }),
  listAgents: vi.fn().mockResolvedValue({ success: true, agents: [] }),
  saveCliConfig: vi.fn().mockResolvedValue({ success: true }),
  saveSettings: vi.fn().mockResolvedValue({ success: true }),
  checkForUpdates: vi.fn().mockResolvedValue({ success: true }),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.getCliConfigPath.mockResolvedValue({ success: true, path: '/home/.claude/settings.json' });
  mockElectronAPI.loadCliConfig.mockResolvedValue({ success: true, settings: {} });
  mockElectronAPI.loadSettings.mockResolvedValue({ success: true, settings: {} });
  mockElectronAPI.getAuthStatus.mockResolvedValue({ success: true, status: null });
  mockElectronAPI.listAgents.mockResolvedValue({ success: true, agents: [] });
  useAppStore.setState({ session: { isConnected: false, workingDirectory: '' } });
});

// ──────────────────────────────────────────
// 情景 1：基础渲染
// ──────────────────────────────────────────
describe('SettingsPanel - 基础渲染', () => {
  it('应显示"Claude Code 设置"标题', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    // 等待加载完成后标题才会渲染
    await waitFor(() => {
      expect(screen.getByText('Claude Code 设置')).toBeInTheDocument();
    });
  });

  it('应渲染"保存设置"按钮', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(screen.getByText('保存设置')).toBeInTheDocument();
    });
  });

  it('挂载时应调用 loadSettings', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(mockElectronAPI.loadSettings).toHaveBeenCalled();
    });
  });

  it('挂载时应调用 loadCliConfig', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(mockElectronAPI.loadCliConfig).toHaveBeenCalled();
    });
  });

  it('挂载时应调用 getAuthStatus', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(mockElectronAPI.getAuthStatus).toHaveBeenCalled();
    });
  });
});

// ──────────────────────────────────────────
// 情景 2：Tab 渲染与切换
// ──────────────────────────────────────────
describe('SettingsPanel - Tab 渲染', () => {
  it('应渲染"模型" tab 标签', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '模型' })).toBeInTheDocument();
    });
  });

  it('应渲染"权限" tab 标签', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '权限' })).toBeInTheDocument();
    });
  });

  it('默认激活"模型"tab，应显示"模型选择"内容', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(screen.getByText('模型选择')).toBeInTheDocument();
    });
  });

  it('点击"权限"tab 应切换内容', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '权限' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '权限' }));

    // 权限 tab 的内容（PermissionsTab 组件）不再显示"模型选择"
    await waitFor(() => {
      expect(screen.queryByText('模型选择')).not.toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// 情景 3：API 失败降级
// ──────────────────────────────────────────
describe('SettingsPanel - API 失败降级', () => {
  beforeEach(() => {
    mockElectronAPI.loadSettings.mockResolvedValue({ success: false });
    mockElectronAPI.loadCliConfig.mockResolvedValue({ success: false });
    mockElectronAPI.getAuthStatus.mockResolvedValue({ success: false });
    mockElectronAPI.getCliConfigPath.mockResolvedValue({ success: false });
  });

  it('所有 API 失败时仍应渲染标题（不崩溃）', async () => {
    const { SettingsPanel } = await import('./SettingsPanel');
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(screen.getByText('Claude Code 设置')).toBeInTheDocument();
    });
  });
});
