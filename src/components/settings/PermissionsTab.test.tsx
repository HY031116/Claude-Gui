/**
 * PermissionsTab.test.tsx
 * 测试权限设置：权限模式、精细规则、工具控制、额外目录
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionsTab } from './PermissionsTab';
import type { AppSettings } from '../../types';

// ─── 工厂函数 ──────────────────────────────────────────────────────────────────
function makeSettings(partial: Partial<AppSettings> = {}): AppSettings {
  return {
    apiKey: '',
    authMode: 'official',
    model: 'claude-opus-4-5',
    permissionMode: 'auto',
    autoConnectOnLaunch: true,
    allowedTools: 'default',
    disallowedTools: '',
    extraArgs: '',
    httpProxy: '',
    apiBaseUrl: '',
    provider: 'anthropic',
    permissionAllow: [],
    permissionDeny: [],
    permissionAsk: [],
    addDirs: [],
    ...partial,
  } as AppSettings;
}

// ─── 渲染基础 ─────────────────────────────────────────────────────────────────

describe('PermissionsTab - 基础渲染', () => {
  it('应渲染权限模式下拉框', () => {
    render(<PermissionsTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('默认权限模式为 auto', () => {
    render(<PermissionsTab settings={makeSettings({ permissionMode: 'auto' })} setSettings={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('auto');
  });

  it('允许工具输入框应存在', () => {
    render(<PermissionsTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByPlaceholderText(/默认（全部工具）/)).toBeInTheDocument();
  });

  it('禁止工具输入框应存在', () => {
    render(<PermissionsTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByPlaceholderText(/留空则不禁止/)).toBeInTheDocument();
  });

  it('应显示三个"添加规则"按钮（allow/deny/ask）', () => {
    render(<PermissionsTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /添加规则/ }).length).toBe(3);
  });
});

// ─── 权限模式下拉 ─────────────────────────────────────────────────────────────

describe('PermissionsTab - 权限模式切换', () => {
  it('切换到 plan 模式时应调用 setSettings', () => {
    const setSettings = vi.fn();
    render(<PermissionsTab settings={makeSettings()} setSettings={setSettings} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'plan' } });
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0]).toMatchObject({ permissionMode: 'plan' });
  });

  it('切换到 dontAsk 模式', () => {
    const setSettings = vi.fn();
    render(<PermissionsTab settings={makeSettings()} setSettings={setSettings} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dontAsk' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ permissionMode: 'dontAsk' });
  });
});

// ─── 精细权限规则 ─────────────────────────────────────────────────────────────

describe('PermissionsTab - 精细权限规则', () => {
  it('已有 allow 规则时应显示对应输入框', () => {
    render(<PermissionsTab settings={makeSettings({ permissionAllow: ['Bash(git *)'] })} setSettings={vi.fn()} />);
    expect(screen.getByDisplayValue('Bash(git *)')).toBeInTheDocument();
  });

  it('已有 deny 规则时应显示对应输入框', () => {
    render(<PermissionsTab settings={makeSettings({ permissionDeny: ['Read(.env)'] })} setSettings={vi.fn()} />);
    expect(screen.getByDisplayValue('Read(.env)')).toBeInTheDocument();
  });

  it('已有 ask 规则时应显示对应输入框', () => {
    render(<PermissionsTab settings={makeSettings({ permissionAsk: ['WebFetch'] })} setSettings={vi.fn()} />);
    expect(screen.getByDisplayValue('WebFetch')).toBeInTheDocument();
  });

  it('点击"添加规则"后追加空规则项', () => {
    const setSettings = vi.fn();
    render(<PermissionsTab settings={makeSettings()} setSettings={setSettings} />);
    // 点击第一个"添加规则"按钮（allow）
    fireEvent.click(screen.getAllByRole('button', { name: /添加规则/ })[0]);
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0].permissionAllow).toEqual(['']);
  });

  it('点击"×"移除对应规则', () => {
    const setSettings = vi.fn();
    render(<PermissionsTab settings={makeSettings({ permissionAllow: ['Bash(git *)', 'Read'] })} setSettings={setSettings} />);
    const removeButtons = screen.getAllByTitle('移除');
    fireEvent.click(removeButtons[0]); // 移除 allow 第一条
    expect(setSettings.mock.calls[0][0].permissionAllow).toEqual(['Read']);
  });

  it('修改规则输入框应更新对应条目', () => {
    const setSettings = vi.fn();
    render(<PermissionsTab settings={makeSettings({ permissionAllow: ['Bash(git *)'] })} setSettings={setSettings} />);
    fireEvent.change(screen.getByDisplayValue('Bash(git *)'), { target: { value: 'Read' } });
    expect(setSettings.mock.calls[0][0].permissionAllow).toEqual(['Read']);
  });
});

// ─── 工具控制 ─────────────────────────────────────────────────────────────────

describe('PermissionsTab - 工具控制', () => {
  it('allowedTools 非 default 时显示在输入框', () => {
    render(<PermissionsTab settings={makeSettings({ allowedTools: 'Bash,Edit,Read' })} setSettings={vi.fn()} />);
    expect(screen.getByDisplayValue('Bash,Edit,Read')).toBeInTheDocument();
  });

  it('allowedTools=default 时输入框为空', () => {
    render(<PermissionsTab settings={makeSettings({ allowedTools: 'default' })} setSettings={vi.fn()} />);
    expect(screen.getByPlaceholderText(/默认（全部工具）/)).toHaveValue('');
  });

  it('修改 allowedTools 为空时 setSettings 应设为 default', () => {
    const setSettings = vi.fn();
    render(<PermissionsTab settings={makeSettings({ allowedTools: 'Bash' })} setSettings={setSettings} />);
    fireEvent.change(screen.getByDisplayValue('Bash'), { target: { value: '' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ allowedTools: 'default' });
  });

  it('修改 disallowedTools 应更新', () => {
    const setSettings = vi.fn();
    render(<PermissionsTab settings={makeSettings({ disallowedTools: '' })} setSettings={setSettings} />);
    fireEvent.change(screen.getByPlaceholderText(/留空则不禁止/), { target: { value: 'Bash(rm:*)' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ disallowedTools: 'Bash(rm:*)' });
  });
});

// ─── 额外目录 ─────────────────────────────────────────────────────────────────

describe('PermissionsTab - 额外目录', () => {
  it('无额外目录时只显示"添加目录"按钮', () => {
    render(<PermissionsTab settings={makeSettings({ addDirs: [] })} setSettings={vi.fn()} />);
    expect(screen.getByRole('button', { name: /添加目录/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/project/)).not.toBeInTheDocument();
  });

  it('有额外目录时显示对应输入框', () => {
    render(<PermissionsTab settings={makeSettings({ addDirs: ['D:\\project\\lib'] })} setSettings={vi.fn()} />);
    expect(screen.getByDisplayValue('D:\\project\\lib')).toBeInTheDocument();
  });

  it('点击"添加目录"追加空项', () => {
    const setSettings = vi.fn();
    render(<PermissionsTab settings={makeSettings({ addDirs: [] })} setSettings={setSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /添加目录/ }));
    expect(setSettings.mock.calls[0][0].addDirs).toEqual(['']);
  });
});
