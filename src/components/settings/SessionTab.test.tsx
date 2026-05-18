/**
 * SessionTab.test.tsx
 * 测试会话设置 Tab 各控件的渲染与交互
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionTab } from './SessionTab';
import type { AppSettings } from '../../types';

// ─── 基础 settings 工厂 ────────────────────────────────────────────────────────
function makeSettings(partial: Partial<AppSettings> = {}): AppSettings {
  return {
    autoConnectOnLaunch: true,
    alwaysThinkingEnabled: false,
    showThinkingSummaries: false,
    autoMemoryEnabled: true,
    maxTurns: undefined,
    envVars: {},
    ...partial,
  } as AppSettings;
}

// ─── 渲染基础 ─────────────────────────────────────────────────────────────────

describe('SessionTab - 基础渲染', () => {
  it('应渲染"自动连接"复选框', () => {
    render(<SessionTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /自动连接/ })).toBeInTheDocument();
  });

  it('应渲染"扩展思维"复选框', () => {
    render(<SessionTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /alwaysThinkingEnabled/ })).toBeInTheDocument();
  });

  it('应渲染"显示思维摘要"复选框', () => {
    render(<SessionTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /showThinkingSummaries/ })).toBeInTheDocument();
  });

  it('应渲染"自动记忆"复选框', () => {
    render(<SessionTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /autoMemoryEnabled/ })).toBeInTheDocument();
  });

  it('应渲染 maxTurns 数字输入框', () => {
    render(<SessionTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByPlaceholderText(/留空/)).toBeInTheDocument();
  });

  it('应渲染"添加变量"按钮', () => {
    render(<SessionTab settings={makeSettings()} setSettings={vi.fn()} />);
    expect(screen.getByRole('button', { name: /添加变量/ })).toBeInTheDocument();
  });
});

// ─── autoConnectOnLaunch 复选框 ───────────────────────────────────────────────

describe('SessionTab - autoConnectOnLaunch', () => {
  it('checked=true 时复选框应处于勾选状态', () => {
    render(<SessionTab settings={makeSettings({ autoConnectOnLaunch: true })} setSettings={vi.fn()} />);
    const cb = screen.getByRole('checkbox', { name: /自动连接/ });
    expect(cb).toBeChecked();
  });

  it('checked=false 时复选框应处于未勾选状态', () => {
    render(<SessionTab settings={makeSettings({ autoConnectOnLaunch: false })} setSettings={vi.fn()} />);
    const cb = screen.getByRole('checkbox', { name: /自动连接/ });
    expect(cb).not.toBeChecked();
  });

  it('点击时应调用 setSettings 并翻转 autoConnectOnLaunch', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ autoConnectOnLaunch: true })} setSettings={setSettings} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /自动连接/ }));
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0]).toMatchObject({ autoConnectOnLaunch: false });
  });
});

// ─── 思维设置复选框 ───────────────────────────────────────────────────────────

describe('SessionTab - 思维设置', () => {
  it('alwaysThinkingEnabled=true 时复选框勾选', () => {
    render(<SessionTab settings={makeSettings({ alwaysThinkingEnabled: true })} setSettings={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /alwaysThinkingEnabled/ })).toBeChecked();
  });

  it('点击 alwaysThinkingEnabled 复选框触发 setSettings', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ alwaysThinkingEnabled: false })} setSettings={setSettings} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /alwaysThinkingEnabled/ }));
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0]).toMatchObject({ alwaysThinkingEnabled: true });
  });

  it('showThinkingSummaries=true 时复选框勾选', () => {
    render(<SessionTab settings={makeSettings({ showThinkingSummaries: true })} setSettings={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /showThinkingSummaries/ })).toBeChecked();
  });

  it('点击 showThinkingSummaries 复选框触发 setSettings', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ showThinkingSummaries: false })} setSettings={setSettings} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /showThinkingSummaries/ }));
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0]).toMatchObject({ showThinkingSummaries: true });
  });
});

// ─── 自动记忆 ─────────────────────────────────────────────────────────────────

describe('SessionTab - 自动记忆', () => {
  it('autoMemoryEnabled 未设置时默认 true', () => {
    const s = makeSettings();
    delete (s as Record<string, unknown>).autoMemoryEnabled;
    render(<SessionTab settings={s} setSettings={vi.fn()} />);
    // checked={settings.autoMemoryEnabled ?? true} → true
    expect(screen.getByRole('checkbox', { name: /autoMemoryEnabled/ })).toBeChecked();
  });

  it('点击 autoMemoryEnabled 复选框触发 setSettings', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ autoMemoryEnabled: true })} setSettings={setSettings} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /autoMemoryEnabled/ }));
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0]).toMatchObject({ autoMemoryEnabled: false });
  });
});

// ─── maxTurns 数字输入 ────────────────────────────────────────────────────────

describe('SessionTab - maxTurns', () => {
  it('有值时显示对应数字', () => {
    render(<SessionTab settings={makeSettings({ maxTurns: 10 })} setSettings={vi.fn()} />);
    expect(screen.getByPlaceholderText(/留空/)).toHaveValue(10);
  });

  it('输入有效数字时调用 setSettings', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings()} setSettings={setSettings} />);
    fireEvent.change(screen.getByPlaceholderText(/留空/), { target: { value: '5' } });
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0]).toMatchObject({ maxTurns: 5 });
  });

  it('输入 0 时 maxTurns 应为 undefined', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ maxTurns: 5 })} setSettings={setSettings} />);
    fireEvent.change(screen.getByPlaceholderText(/留空/), { target: { value: '0' } });
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0]).toMatchObject({ maxTurns: undefined });
  });

  it('输入非数字时 maxTurns 应为 undefined', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ maxTurns: 5 })} setSettings={setSettings} />);
    fireEvent.change(screen.getByPlaceholderText(/留空/), { target: { value: 'abc' } });
    expect(setSettings).toHaveBeenCalledOnce();
    expect(setSettings.mock.calls[0][0]).toMatchObject({ maxTurns: undefined });
  });
});

// ─── 环境变量管理 ─────────────────────────────────────────────────────────────

describe('SessionTab - 环境变量', () => {
  it('无环境变量时不显示 KEY/VALUE 输入框', () => {
    render(<SessionTab settings={makeSettings({ envVars: {} })} setSettings={vi.fn()} />);
    expect(screen.queryByPlaceholderText('KEY')).not.toBeInTheDocument();
  });

  it('有环境变量时应显示 KEY/VALUE 输入框', () => {
    render(<SessionTab settings={makeSettings({ envVars: { FOO: 'bar' } })} setSettings={vi.fn()} />);
    expect(screen.getByDisplayValue('FOO')).toBeInTheDocument();
    expect(screen.getByDisplayValue('bar')).toBeInTheDocument();
  });

  it('"添加变量"按钮点击后调用 setSettings 并追加空行', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ envVars: {} })} setSettings={setSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /添加变量/ }));
    expect(setSettings).toHaveBeenCalledOnce();
    const newEnv = setSettings.mock.calls[0][0].envVars;
    expect(Object.keys(newEnv)).toContain('');
  });

  it('点击"×"按钮应移除对应变量', () => {
    const setSettings = vi.fn();
    render(
      <SessionTab
        settings={makeSettings({ envVars: { FOO: 'bar', BAZ: 'qux' } })}
        setSettings={setSettings}
      />
    );
    // 点击第一个 × 按钮（移除 FOO）
    const removeButtons = screen.getAllByTitle('移除');
    fireEvent.click(removeButtons[0]);
    expect(setSettings).toHaveBeenCalledOnce();
    const newEnv = setSettings.mock.calls[0][0].envVars;
    expect(Object.keys(newEnv)).not.toContain('FOO');
    expect(Object.keys(newEnv)).toContain('BAZ');
  });

  it('修改 KEY 输入框应更新对应 key', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ envVars: { FOO: 'bar' } })} setSettings={setSettings} />);
    fireEvent.change(screen.getByDisplayValue('FOO'), { target: { value: 'NEW_KEY' } });
    expect(setSettings).toHaveBeenCalledOnce();
    const newEnv = setSettings.mock.calls[0][0].envVars;
    expect(Object.keys(newEnv)).toContain('NEW_KEY');
  });

  it('修改 VALUE 输入框应更新对应 value', () => {
    const setSettings = vi.fn();
    render(<SessionTab settings={makeSettings({ envVars: { FOO: 'bar' } })} setSettings={setSettings} />);
    fireEvent.change(screen.getByDisplayValue('bar'), { target: { value: 'newValue' } });
    expect(setSettings).toHaveBeenCalledOnce();
    const newEnv = setSettings.mock.calls[0][0].envVars;
    expect(newEnv['FOO']).toBe('newValue');
  });
});
