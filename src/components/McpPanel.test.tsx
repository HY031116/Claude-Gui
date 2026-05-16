/**
 * McpPanel 测试
 * 覆盖：空服务器列表、有服务器时渲染、"添加服务器"按钮存在性
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ──────────────────────────────────────────
// electronAPI mock（McpPanel 挂载时调用 loadCliConfig）
// ──────────────────────────────────────────
const mockElectronAPI = {
  loadCliConfig: vi.fn().mockResolvedValue({ success: true, settings: {} }),
  saveCliConfig: vi.fn().mockResolvedValue({ success: true }),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.loadCliConfig.mockResolvedValue({ success: true, settings: {} });
  mockElectronAPI.saveCliConfig.mockResolvedValue({ success: true });
});

// ──────────────────────────────────────────
// 情景 1：无 MCP 服务器配置
// ──────────────────────────────────────────
describe('McpPanel - 无服务器配置', () => {
  it('应显示"暂无 MCP 服务器配置"空状态', async () => {
    const { McpPanel } = await import('./McpPanel');
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByText('暂无 MCP 服务器配置')).toBeInTheDocument();
    });
  });

  it('应渲染"添加服务器"按钮', async () => {
    const { McpPanel } = await import('./McpPanel');
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByText('添加服务器')).toBeInTheDocument();
    });
  });

  it('应渲染"MCP 服务器"标题', async () => {
    const { McpPanel } = await import('./McpPanel');
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByText('MCP 服务器')).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// 情景 2：有 MCP 服务器配置
// ──────────────────────────────────────────
describe('McpPanel - 有服务器配置', () => {
  beforeEach(() => {
    mockElectronAPI.loadCliConfig.mockResolvedValue({
      success: true,
      settings: {
        mcpServers: {
          'my-server': { type: 'stdio', command: 'npx', args: ['my-mcp'] },
          'sse-server': { type: 'sse', url: 'http://localhost:3000' },
        },
      },
    });
  });

  it('有服务器时应渲染服务器名称（my-server）', async () => {
    const { McpPanel } = await import('./McpPanel');
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByText('my-server')).toBeInTheDocument();
    });
  });

  it('有服务器时应渲染第二个服务器名称（sse-server）', async () => {
    const { McpPanel } = await import('./McpPanel');
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByText('sse-server')).toBeInTheDocument();
    });
  });

  it('有服务器时不应显示空状态提示', async () => {
    const { McpPanel } = await import('./McpPanel');
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.queryByText('暂无 MCP 服务器配置')).not.toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────
// 情景 3：loadCliConfig 失败时降级
// ──────────────────────────────────────────
describe('McpPanel - API 加载失败降级', () => {
  beforeEach(() => {
    mockElectronAPI.loadCliConfig.mockResolvedValue({ success: false, error: '配置文件不存在' });
  });

  it('API 失败时仍应显示空状态（不崩溃）', async () => {
    const { McpPanel } = await import('./McpPanel');
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByText('暂无 MCP 服务器配置')).toBeInTheDocument();
    });
  });
});
