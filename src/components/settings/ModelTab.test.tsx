/**
 * ModelTab.test.tsx
 * 测试模型设置：快速预设、模型选择、努力程度、响应语言、Agent 选择
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelTab } from './ModelTab';
import type { AppSettings } from '../../types';

// ─── 工厂函数 ──────────────────────────────────────────────────────────────────
function makeSettings(partial: Partial<AppSettings> = {}): AppSettings {
  return {
    apiKey: '',
    authMode: 'official',
    model: 'sonnet',
    permissionMode: 'auto',
    autoConnectOnLaunch: true,
    allowedTools: 'default',
    extraArgs: '',
    httpProxy: '',
    apiBaseUrl: '',
    provider: 'anthropic',
    effortLevel: 'medium',
    language: '',
    agent: 'default',
    ...partial,
  } as AppSettings;
}

// ─── 渲染基础 ─────────────────────────────────────────────────────────────────

describe('ModelTab - 基础渲染', () => {
  it('应渲染"快速配置"区域', () => {
    render(<ModelTab settings={makeSettings()} setSettings={vi.fn()} availableAgents={[]} applyPreset={vi.fn()} />);
    expect(screen.getByText('快速配置')).toBeInTheDocument();
  });

  it('应显示三个配置预设按钮', () => {
    render(<ModelTab settings={makeSettings()} setSettings={vi.fn()} availableAgents={[]} applyPreset={vi.fn()} />);
    expect(screen.getByRole('button', { name: /开发模式/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /强力模式/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /快速模式/ })).toBeInTheDocument();
  });

  it('应渲染模型选择下拉框', () => {
    render(<ModelTab settings={makeSettings()} setSettings={vi.fn()} availableAgents={[]} applyPreset={vi.fn()} />);
    // 模型下拉框 + 努力度下拉框 + Agent 下拉框 = 3个 combobox
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(3);
  });

  it('应渲染响应语言输入框', () => {
    render(<ModelTab settings={makeSettings()} setSettings={vi.fn()} availableAgents={[]} applyPreset={vi.fn()} />);
    expect(screen.getByPlaceholderText(/留空 = 默认语言/)).toBeInTheDocument();
  });
});

// ─── 快速预设 ─────────────────────────────────────────────────────────────────

describe('ModelTab - 快速预设', () => {
  it('点击"开发模式"应调用 applyPreset("developer")', () => {
    const applyPreset = vi.fn();
    render(<ModelTab settings={makeSettings()} setSettings={vi.fn()} availableAgents={[]} applyPreset={applyPreset} />);
    fireEvent.click(screen.getByRole('button', { name: /开发模式/ }));
    expect(applyPreset).toHaveBeenCalledWith('developer');
  });

  it('点击"强力模式"应调用 applyPreset("power")', () => {
    const applyPreset = vi.fn();
    render(<ModelTab settings={makeSettings()} setSettings={vi.fn()} availableAgents={[]} applyPreset={applyPreset} />);
    fireEvent.click(screen.getByRole('button', { name: /强力模式/ }));
    expect(applyPreset).toHaveBeenCalledWith('power');
  });

  it('点击"快速模式"应调用 applyPreset("fast")', () => {
    const applyPreset = vi.fn();
    render(<ModelTab settings={makeSettings()} setSettings={vi.fn()} availableAgents={[]} applyPreset={applyPreset} />);
    fireEvent.click(screen.getByRole('button', { name: /快速模式/ }));
    expect(applyPreset).toHaveBeenCalledWith('fast');
  });
});

// ─── 模型选择 ─────────────────────────────────────────────────────────────────

describe('ModelTab - 模型选择', () => {
  it('当前模型为 sonnet 时下拉框显示正确', () => {
    render(<ModelTab settings={makeSettings({ model: 'sonnet' })} setSettings={vi.fn()} availableAgents={[]} applyPreset={vi.fn()} />);
    // 第一个 combobox 是模型
    const selects = screen.getAllByRole('combobox');
    expect((selects[0] as HTMLSelectElement).value).toBe('sonnet');
  });

  it('切换到 opus 时调用 setSettings', () => {
    const setSettings = vi.fn();
    render(<ModelTab settings={makeSettings({ model: 'sonnet' })} setSettings={setSettings} availableAgents={[]} applyPreset={vi.fn()} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'opus' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ model: 'opus' });
  });

  it('切换到"自定义"时清空 model 为空字符串', () => {
    const setSettings = vi.fn();
    render(<ModelTab settings={makeSettings({ model: 'sonnet' })} setSettings={setSettings} availableAgents={[]} applyPreset={vi.fn()} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'custom' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ model: '' });
  });

  it('model 为非预设值时显示自定义输入框', () => {
    render(<ModelTab settings={makeSettings({ model: 'my-custom-model' })} setSettings={vi.fn()} availableAgents={[]} applyPreset={vi.fn()} />);
    expect(screen.getByPlaceholderText(/输入模型名称/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('my-custom-model')).toBeInTheDocument();
  });

  it('model 为 sonnet 时不显示自定义输入框', () => {
    render(<ModelTab settings={makeSettings({ model: 'sonnet' })} setSettings={vi.fn()} availableAgents={[]} applyPreset={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/输入模型名称/)).not.toBeInTheDocument();
  });
});

// ─── 努力程度 ─────────────────────────────────────────────────────────────────

describe('ModelTab - 努力程度', () => {
  it('切换到 high 时调用 setSettings', () => {
    const setSettings = vi.fn();
    render(<ModelTab settings={makeSettings({ effortLevel: 'medium' })} setSettings={setSettings} availableAgents={[]} applyPreset={vi.fn()} />);
    const selects = screen.getAllByRole('combobox');
    // 第二个 combobox 是努力程度
    fireEvent.change(selects[1], { target: { value: 'high' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ effortLevel: 'high' });
  });
});

// ─── 响应语言 ────────────────────────────────────────────────────────────────

describe('ModelTab - 响应语言', () => {
  it('有设置语言时显示语言值', () => {
    render(<ModelTab settings={makeSettings({ language: 'chinese' })} setSettings={vi.fn()} availableAgents={[]} applyPreset={vi.fn()} />);
    expect(screen.getByDisplayValue('chinese')).toBeInTheDocument();
  });

  it('修改语言输入框时调用 setSettings', () => {
    const setSettings = vi.fn();
    render(<ModelTab settings={makeSettings({ language: '' })} setSettings={setSettings} availableAgents={[]} applyPreset={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/留空 = 默认语言/), { target: { value: 'japanese' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ language: 'japanese' });
  });

  it('清空语言输入框时 language 应为 undefined', () => {
    const setSettings = vi.fn();
    render(<ModelTab settings={makeSettings({ language: 'chinese' })} setSettings={setSettings} availableAgents={[]} applyPreset={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue('chinese'), { target: { value: '' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ language: undefined });
  });
});

// ─── Agent 选择 ───────────────────────────────────────────────────────────────

describe('ModelTab - Agent 选择', () => {
  it('有可用 agents 时显示 agent 选项', () => {
    const agents = [{ name: 'myAgent', model: 'claude-3-5-sonnet', type: 'custom' as const }];
    render(<ModelTab settings={makeSettings()} setSettings={vi.fn()} availableAgents={agents} applyPreset={vi.fn()} />);
    expect(screen.getByText(/myAgent/)).toBeInTheDocument();
  });

  it('切换 agent 时调用 setSettings', () => {
    const setSettings = vi.fn();
    const agents = [{ name: 'myAgent', model: 'sonnet', type: 'custom' as const }];
    render(<ModelTab settings={makeSettings({ agent: 'default' })} setSettings={setSettings} availableAgents={agents} applyPreset={vi.fn()} />);
    const selects = screen.getAllByRole('combobox');
    const agentSelect = selects[selects.length - 1]; // 最后一个是 Agent
    fireEvent.change(agentSelect, { target: { value: 'myAgent' } });
    expect(setSettings.mock.calls[0][0]).toMatchObject({ agent: 'myAgent' });
  });
});
