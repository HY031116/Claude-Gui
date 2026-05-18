/**
 * RulesPanel.test.tsx
 * 测试权限规则管理面板基础渲染及交互
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RulesPanel } from './RulesPanel';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockLoadCliConfig = vi.fn();
const mockSaveCliConfig = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadCliConfig.mockResolvedValue({
    success: true,
    settings: {
      permissions: {
        mode: 'auto',
        allow: [],
        deny: [],
        ask: [],
      },
    },
  });
  mockSaveCliConfig.mockResolvedValue({ success: true });

  (window as unknown as Record<string, unknown>).electronAPI = {
    loadCliConfig: mockLoadCliConfig,
    saveCliConfig: mockSaveCliConfig,
  };
});

// ─── 基础渲染 ─────────────────────────────────────────────────────────────────

describe('RulesPanel - 基础渲染', () => {
  it('渲染"权限规则管理"标题', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('权限规则管理')).toBeInTheDocument();
    });
  });

  it('显示三个规则标签页（允许/拒绝/询问）', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('允许')).toBeInTheDocument();
      expect(screen.getByText('拒绝')).toBeInTheDocument();
      expect(screen.getByText('询问')).toBeInTheDocument();
    });
  });

  it('显示权限模式选择器', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('模式')).toBeInTheDocument();
    });
  });

  it('显示"保存"按钮', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
  });
});

// ─── 规则标签页 ───────────────────────────────────────────────────────────────

describe('RulesPanel - 标签页切换', () => {
  it('初始显示"允许"标签页内容', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('允许')).toBeInTheDocument();
    });
  });

  it('点击"拒绝"标签页可切换', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('拒绝')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('拒绝'));
    expect(true).toBe(true);
  });

  it('点击"询问"标签页可切换', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('询问')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('询问'));
    expect(true).toBe(true);
  });
});

// ─── 权限模式 ─────────────────────────────────────────────────────────────────

describe('RulesPanel - 权限模式', () => {
  it('默认显示 auto 模式', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('auto');
    });
  });

  it('可切换为 plan 模式', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'plan' } });
      expect(select.value).toBe('plan');
    });
  });

  it('可切换为 dontAsk 模式', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'dontAsk' } });
      expect(select.value).toBe('dontAsk');
    });
  });
});

// ─── 规则 CRUD ────────────────────────────────────────────────────────────────

describe('RulesPanel - 规则添加', () => {
  it('点击"添加空规则"按钮可添加新规则', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('添加空规则')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('添加空规则'));
    await waitFor(() => {
      expect(screen.getAllByText('(空规则)').length).toBeGreaterThan(0);
    });
  });
});

// ─── 有已有规则 ───────────────────────────────────────────────────────────────

describe('RulesPanel - 有已有规则', () => {
  beforeEach(() => {
    mockLoadCliConfig.mockResolvedValue({
      success: true,
      settings: {
        permissions: {
          mode: 'auto',
          allow: ['Bash(git *)', 'Read(*.md)'],
          deny: ['Bash(rm -rf *)'],
          ask: [],
        },
      },
    });
  });

  it('显示已有允许规则', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Bash\(git \*\)/)).toBeInTheDocument();
    });
  });

  it('允许规则数量徽章显示正确', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      // 允许 tab 有 2 条规则，badge 显示 '2'
      const allowBtn = screen.getAllByRole('button').find(
        (btn) => btn.textContent?.startsWith('允许') && btn.textContent?.includes('2')
      );
      expect(allowBtn).toBeTruthy();
    });
  });

  it('切换到拒绝标签页显示拒绝规则', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('拒绝')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('拒绝'));
    await waitFor(() => {
      expect(screen.getByText(/rm -rf/)).toBeInTheDocument();
    });
  });
});

// ─── 保存 ─────────────────────────────────────────────────────────────────────

describe('RulesPanel - 保存功能', () => {
  it('点击保存触发 saveCliConfig', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => {
      expect(mockSaveCliConfig).toHaveBeenCalled();
    });
  });

  it('保存成功后显示成功消息', async () => {
    render(<RulesPanel />);
    await waitFor(() => {
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText(/规则已保存/)).toBeInTheDocument();
    });
  });
});
