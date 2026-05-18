/**
 * HooksPanel.test.tsx
 * 测试 Hooks 配置面板基础渲染及交互
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HooksPanel } from './HooksPanel';
import { useAppStore } from '../stores/useAppStore';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockLoadCliConfig = vi.fn();
const mockSaveCliConfig = vi.fn();

beforeEach(() => {
  mockLoadCliConfig.mockResolvedValue({ success: true, settings: { hooks: {}, disableAllHooks: false } });
  mockSaveCliConfig.mockResolvedValue({ success: true });

  (window as unknown as Record<string, unknown>).electronAPI = {
    loadCliConfig: mockLoadCliConfig,
    saveCliConfig: mockSaveCliConfig,
    hookTestRun: vi.fn().mockResolvedValue({ success: true, output: '' }),
  };

  useAppStore.setState({
    session: { isConnected: false, workingDirectory: 'D:\\proj' },
  });
});

// ─── 基础渲染 ─────────────────────────────────────────────────────────────────

describe('HooksPanel - 基础渲染', () => {
  it('渲染 Hooks 标题', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('Hooks')).toBeInTheDocument();
    });
  });

  it('初始显示 0 个 hooks', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText(/0 个/)).toBeInTheDocument();
    });
  });

  it('显示"全部启用"切换按钮', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText(/全部启用/)).toBeInTheDocument();
    });
  });

  it('显示"保存"按钮', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
  });

  it('显示"预设"按钮', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('预设')).toBeInTheDocument();
    });
  });

  it('显示"JSON"按钮', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText(/JSON/)).toBeInTheDocument();
    });
  });
});

// ─── 事件列表 ─────────────────────────────────────────────────────────────────

describe('HooksPanel - 事件选择', () => {
  it('渲染工具调用事件分组', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('工具调用')).toBeInTheDocument();
    });
  });

  it('渲染 PreToolUse 事件（出现在左侧列表和右侧标题）', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      const els = screen.getAllByText('PreToolUse');
      expect(els.length).toBeGreaterThan(0);
    });
  });

  it('点击 PostToolUse 切换选中事件', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('PostToolUse')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('PostToolUse'));
    await waitFor(() => {
      // 右侧标题切换为 PostToolUse（多处出现）
      const els = screen.getAllByText('PostToolUse');
      expect(els.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('SessionStart 事件存在于列表', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('SessionStart')).toBeInTheDocument();
    });
  });
});

// ─── 禁用 / 启用切换 ─────────────────────────────────────────────────────────

describe('HooksPanel - 禁用切换', () => {
  it('点击禁用按钮切换状态', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText(/全部启用/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/全部启用/));
    await waitFor(() => {
      expect(screen.getByText(/已全部禁用/)).toBeInTheDocument();
    });
  });

  it('已禁用状态可再次点击恢复', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText(/全部启用/)).toBeInTheDocument();
    });
    const toggleBtn = screen.getByText(/全部启用/);
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      fireEvent.click(screen.getByText(/已全部禁用/));
    });
    await waitFor(() => {
      expect(screen.getByText(/全部启用/)).toBeInTheDocument();
    });
  });
});

// ─── 预设面板 ─────────────────────────────────────────────────────────────────

describe('HooksPanel - 预设面板', () => {
  it('点击"预设"按钮显示预设模板列表', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('预设')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('预设'));
    await waitFor(() => {
      expect(screen.getByText(/选择预设模板/)).toBeInTheDocument();
    });
  });

  it('预设列表包含"文件保存后自动 lint"', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText('预设')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('预设'));
    await waitFor(() => {
      expect(screen.getByText(/文件保存后自动 lint/)).toBeInTheDocument();
    });
  });
});

// ─── JSON 视图 ────────────────────────────────────────────────────────────────

describe('HooksPanel - JSON 视图', () => {
  it('点击 JSON 按钮显示 JSON 配置内容', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      expect(screen.getByText(/JSON/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/JSON/));
    await waitFor(() => {
      // JSON 视图渲染一个 pre 元素，内容包含 "hooks"
      expect(screen.getByText(/当前 hooks 配置/)).toBeInTheDocument();
    });
  });
});

// ─── 有 Hooks 配置时 ──────────────────────────────────────────────────────────

describe('HooksPanel - 有已有配置', () => {
  beforeEach(() => {
    mockLoadCliConfig.mockResolvedValue({
      success: true,
      settings: {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo hello', async: false }],
            },
          ],
        },
        disableAllHooks: false,
      },
    });
  });

  it('加载后工具栏显示 hooks 计数（含 1 个）', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      // 计数显示在工具栏 span 中，用 getAllByText 容忍多匹配
      const els = screen.getAllByText(/1 个/);
      expect(els.length).toBeGreaterThan(0);
    });
  });

  it('PreToolUse 事件存在（可见）', async () => {
    render(<HooksPanel />);
    await waitFor(() => {
      const els = screen.getAllByText('PreToolUse');
      expect(els.length).toBeGreaterThan(0);
    });
  });
});
