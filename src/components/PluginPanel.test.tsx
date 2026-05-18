/**
 * PluginPanel.test.tsx
 * 测试插件管理面板基础渲染及交互
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PluginPanel from './PluginPanel';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockPluginList = vi.fn();
const mockPluginToggle = vi.fn();
const mockPluginInstall = vi.fn();
const mockPluginUninstall = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockPluginList.mockResolvedValue({ success: true, plugins: [] });
  mockPluginToggle.mockResolvedValue({ success: true });
  mockPluginInstall.mockResolvedValue({ success: true, output: '安装成功' });
  mockPluginUninstall.mockResolvedValue({ success: true });

  (window as unknown as Record<string, unknown>).electronAPI = {
    pluginList: mockPluginList,
    pluginToggle: mockPluginToggle,
    pluginInstall: mockPluginInstall,
    pluginUninstall: mockPluginUninstall,
  };
});

// ─── 基础渲染 ─────────────────────────────────────────────────────────────────

describe('PluginPanel - 基础渲染', () => {
  it('渲染三个标签页', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByText('已安装')).toBeInTheDocument();
      expect(screen.getByText('发现与安装')).toBeInTheDocument();
      expect(screen.getByText('常用插件')).toBeInTheDocument();
    });
  });

  it('初始显示"已安装"标签页', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByText(/尚未安装任何插件/)).toBeInTheDocument();
    });
  });

  it('显示刷新按钮', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByTitle('刷新列表')).toBeInTheDocument();
    });
  });
});

// ─── 标签页切换 ───────────────────────────────────────────────────────────────

describe('PluginPanel - 标签页切换', () => {
  it('切换到"发现与安装"标签页', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('发现与安装'));
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/claude-mem/)).toBeInTheDocument();
    });
  });

  it('切换到"常用插件"标签页', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('常用插件'));
    });
    await waitFor(() => {
      // 预设插件列表
      expect(screen.getByText('Claude-Mem')).toBeInTheDocument();
    });
  });
});

// ─── 有已安装插件时 ───────────────────────────────────────────────────────────

describe('PluginPanel - 有已安装插件', () => {
  beforeEach(() => {
    mockPluginList.mockResolvedValue({
      success: true,
      plugins: [
        { key: 'claude-mem', name: 'Claude-Mem', enabled: true, version: '1.0.0', description: '测试插件' },
        { key: 'ts-lsp', name: 'TypeScript LSP', enabled: false, version: '0.9.0', description: '语言服务' },
      ],
    });
  });

  it('显示已安装插件名称', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByText('Claude-Mem')).toBeInTheDocument();
    });
  });

  it('显示插件版本', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByText(/1\.0\.0/)).toBeInTheDocument();
    });
  });

  it('有已安装插件时不显示"尚未安装"提示', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByText('Claude-Mem')).toBeInTheDocument();
    });
    expect(screen.queryByText(/尚未安装任何插件/)).not.toBeInTheDocument();
  });

  it('点击刷新按钮重新调用 pluginList', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByTitle('刷新列表')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('刷新列表'));
    await waitFor(() => {
      // 初始加载1次 + 刷新1次
      expect(mockPluginList.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ─── 安装操作 ─────────────────────────────────────────────────────────────────

describe('PluginPanel - 发现与安装', () => {
  it('安装 spec 输入框存在', async () => {
    render(<PluginPanel />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('发现与安装'));
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/claude-mem/)).toBeInTheDocument();
    });
  });

  it('输入 spec 后点击安装', async () => {
    render(<PluginPanel />);
    fireEvent.click(screen.getByText('发现与安装'));
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/claude-mem/);
      fireEvent.change(input, { target: { value: 'test/plugin' } });
    });
    const installBtn = screen.getByRole('button', { name: '安装' });
    fireEvent.click(installBtn);
    await waitFor(() => {
      expect(mockPluginInstall).toHaveBeenCalledWith('test/plugin');
    });
  });
});
