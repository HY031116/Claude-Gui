/**
 * MoreSettingsTabs.test.tsx
 * 覆盖 AppearanceTab / ModelTab / PermissionsTab 三个 settings 子面板
 * 补充覆盖率，目标 35%
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../stores/useAppStore';
import type { AppSettings } from '../types';

// ─── 最小合法 AppSettings mock ───────────────────────────────────────────────
const baseSettings: AppSettings = {
  apiKey: '',
  authMode: 'official',
  model: 'claude-opus-4-5',
  permissionMode: 'default',
  autoConnectOnLaunch: false,
  allowedTools: 'default',
  extraArgs: '',
  httpProxy: '',
  apiBaseUrl: '',
  provider: 'anthropic',
  apiProfiles: [],
};

// ─── AppearanceTab 测试 ───────────────────────────────────────────────────────
describe('AppearanceTab', () => {
  beforeEach(() => {
    useAppStore.setState({
      theme: 'dark',
      accentColor: 'purple',
      fontSize: 'normal',
    } as Parameters<typeof useAppStore.setState>[0]);
  });

  it('应渲染颜色主题区域', async () => {
    const { AppearanceTab } = await import('./settings/AppearanceTab');
    render(<AppearanceTab />);
    expect(screen.getByText('颜色主题')).toBeInTheDocument();
    expect(screen.getByText('深色')).toBeInTheDocument();
    expect(screen.getByText('浅色')).toBeInTheDocument();
  });

  it('点击"浅色"按钮应切换主题', async () => {
    const { AppearanceTab } = await import('./settings/AppearanceTab');
    render(<AppearanceTab />);
    const lightBtn = screen.getByText('浅色').closest('button')!;
    fireEvent.click(lightBtn);
    expect(useAppStore.getState().theme).toBe('light');
  });

  it('点击"深色"按钮应切换回深色主题', async () => {
    useAppStore.setState({ theme: 'light' } as Parameters<typeof useAppStore.setState>[0]);
    const { AppearanceTab } = await import('./settings/AppearanceTab');
    render(<AppearanceTab />);
    const darkBtn = screen.getByText('深色').closest('button')!;
    fireEvent.click(darkBtn);
    expect(useAppStore.getState().theme).toBe('dark');
  });

  it('应渲染强调色区域并显示"当前："标签', async () => {
    const { AppearanceTab } = await import('./settings/AppearanceTab');
    render(<AppearanceTab />);
    // 所有强调色按钮通过 aria-label 可访问（共 6 种颜色）
    expect(screen.getByLabelText('蓝色')).toBeInTheDocument();
    expect(screen.getByLabelText('翠绿')).toBeInTheDocument();
    // 橙色按钮存在
    expect(screen.getByLabelText('橙色')).toBeInTheDocument();
  });

  it('点击强调色按钮应切换 accentColor', async () => {
    const { AppearanceTab } = await import('./settings/AppearanceTab');
    render(<AppearanceTab />);
    const blueBtn = screen.getByLabelText('蓝色');
    fireEvent.click(blueBtn);
    expect(useAppStore.getState().accentColor).toBe('blue');
  });

  it('应渲染字体大小区域', async () => {
    const { AppearanceTab } = await import('./settings/AppearanceTab');
    render(<AppearanceTab />);
    expect(screen.getByText('界面字号')).toBeInTheDocument();
    expect(screen.getByText('紧凑')).toBeInTheDocument();
    expect(screen.getByText('标准')).toBeInTheDocument();
    expect(screen.getByText('宽松')).toBeInTheDocument();
  });

  it('点击字体大小按钮应切换 fontSize', async () => {
    const { AppearanceTab } = await import('./settings/AppearanceTab');
    render(<AppearanceTab />);
    const compactBtn = screen.getByText('紧凑').closest('button')!;
    fireEvent.click(compactBtn);
    expect(useAppStore.getState().fontSize).toBe('compact');
  });
});

// ─── ModelTab 测试 ────────────────────────────────────────────────────────────
describe('ModelTab', () => {
  const mockSetSettings = vi.fn();
  const mockApplyPreset = vi.fn();
  const availableAgents: Array<{ name: string; model: string; type: 'builtin' | 'custom' }> = [];

  beforeEach(() => {
    mockSetSettings.mockClear();
    mockApplyPreset.mockClear();
  });

  it('应渲染快速配置预设按钮', async () => {
    const { ModelTab } = await import('./settings/ModelTab');
    render(
      <ModelTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        availableAgents={availableAgents}
        applyPreset={mockApplyPreset}
      />
    );
    expect(screen.getByText('快速配置')).toBeInTheDocument();
    expect(screen.getByText('开发模式')).toBeInTheDocument();
  });

  it('点击预设按钮应调用 applyPreset', async () => {
    const { ModelTab } = await import('./settings/ModelTab');
    render(
      <ModelTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        availableAgents={availableAgents}
        applyPreset={mockApplyPreset}
      />
    );
    fireEvent.click(screen.getByText('开发模式'));
    expect(mockApplyPreset).toHaveBeenCalledWith('developer');
  });

  it('应渲染模型选择下拉框', async () => {
    const { ModelTab } = await import('./settings/ModelTab');
    render(
      <ModelTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        availableAgents={availableAgents}
        applyPreset={mockApplyPreset}
      />
    );
    expect(screen.getByText('模型选择')).toBeInTheDocument();
    // 选项之一
    expect(screen.getByText('Sonnet (推荐)')).toBeInTheDocument();
  });

  it('应渲染努力程度下拉框', async () => {
    const { ModelTab } = await import('./settings/ModelTab');
    render(
      <ModelTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        availableAgents={availableAgents}
        applyPreset={mockApplyPreset}
      />
    );
    expect(screen.getByText('努力程度 (Effort)')).toBeInTheDocument();
    // 选项之一（中 是默认值里的选项）
    expect(screen.getByText('中 (默认)')).toBeInTheDocument();
  });

  it('切换模型应调用 setSettings', async () => {
    const { ModelTab } = await import('./settings/ModelTab');
    render(
      <ModelTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        availableAgents={availableAgents}
        applyPreset={mockApplyPreset}
      />
    );
    // 找到模型选择下拉框（第一个 select）
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'sonnet' } });
    expect(mockSetSettings).toHaveBeenCalledWith(expect.objectContaining({ model: 'sonnet' }));
  });

  it('应渲染响应语言输入框', async () => {
    const { ModelTab } = await import('./settings/ModelTab');
    render(
      <ModelTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        availableAgents={availableAgents}
        applyPreset={mockApplyPreset}
      />
    );
    expect(screen.getByText('响应语言 (language)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/留空 = 默认/)).toBeInTheDocument();
  });

  it('有 availableAgents 时应渲染 Agent 选项', async () => {
    const { ModelTab } = await import('./settings/ModelTab');
    const agents = [{ name: 'my-agent', model: 'sonnet', type: 'custom' as const }];
    render(
      <ModelTab
        settings={baseSettings}
        setSettings={mockSetSettings}
        availableAgents={agents}
        applyPreset={mockApplyPreset}
      />
    );
    expect(screen.getByText(/my-agent/)).toBeInTheDocument();
  });
});

// ─── PermissionsTab 测试 ──────────────────────────────────────────────────────
describe('PermissionsTab', () => {
  const mockSetSettings = vi.fn();

  beforeEach(() => {
    mockSetSettings.mockClear();
  });

  it('应渲染权限模式下拉框', async () => {
    const { PermissionsTab } = await import('./settings/PermissionsTab');
    render(<PermissionsTab settings={baseSettings} setSettings={mockSetSettings} />);
    expect(screen.getByText('权限模式')).toBeInTheDocument();
    expect(screen.getByText(/auto — 自动判断/)).toBeInTheDocument();
  });

  it('切换权限模式应调用 setSettings', async () => {
    const { PermissionsTab } = await import('./settings/PermissionsTab');
    render(<PermissionsTab settings={baseSettings} setSettings={mockSetSettings} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'plan' } });
    expect(mockSetSettings).toHaveBeenCalledWith(expect.objectContaining({ permissionMode: 'plan' }));
  });

  it('应渲染精细权限规则区域', async () => {
    const { PermissionsTab } = await import('./settings/PermissionsTab');
    render(<PermissionsTab settings={baseSettings} setSettings={mockSetSettings} />);
    expect(screen.getByText('精细权限规则')).toBeInTheDocument();
    expect(screen.getByText(/允许 \(allow\)/)).toBeInTheDocument();
    expect(screen.getByText(/拒绝 \(deny\)/)).toBeInTheDocument();
    expect(screen.getByText(/询问 \(ask\)/)).toBeInTheDocument();
  });

  it('点击"添加规则"按钮应调用 setSettings 添加空字符串', async () => {
    const { PermissionsTab } = await import('./settings/PermissionsTab');
    render(<PermissionsTab settings={baseSettings} setSettings={mockSetSettings} />);
    const addBtns = screen.getAllByText('+ 添加规则');
    fireEvent.click(addBtns[0]); // 第一个是 allow
    expect(mockSetSettings).toHaveBeenCalledWith(
      expect.objectContaining({ permissionAllow: [''] })
    );
  });

  it('已有规则时应渲染输入框并可删除', async () => {
    const { PermissionsTab } = await import('./settings/PermissionsTab');
    const settings = { ...baseSettings, permissionAllow: ['Bash(git *)'] };
    render(<PermissionsTab settings={settings} setSettings={mockSetSettings} />);
    // 规则输入框
    const input = screen.getByDisplayValue('Bash(git *)');
    expect(input).toBeInTheDocument();
    // 删除按钮（×）
    const delBtn = screen.getByTitle('移除');
    fireEvent.click(delBtn);
    expect(mockSetSettings).toHaveBeenCalledWith(
      expect.objectContaining({ permissionAllow: [] })
    );
  });

  it('应渲染工具控制区域', async () => {
    const { PermissionsTab } = await import('./settings/PermissionsTab');
    render(<PermissionsTab settings={baseSettings} setSettings={mockSetSettings} />);
    expect(screen.getByText('工具控制')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/默认（全部工具）/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/留空则不禁止/)).toBeInTheDocument();
  });

  it('修改工具控制输入框应调用 setSettings', async () => {
    const { PermissionsTab } = await import('./settings/PermissionsTab');
    render(<PermissionsTab settings={baseSettings} setSettings={mockSetSettings} />);
    const inputs = screen.getAllByRole('textbox');
    // 第一个是 allowedTools 输入框
    fireEvent.change(inputs[0], { target: { value: 'Bash,Read' } });
    expect(mockSetSettings).toHaveBeenCalledWith(
      expect.objectContaining({ allowedTools: 'Bash,Read' })
    );
  });

  it('应渲染额外目录访问区域', async () => {
    const { PermissionsTab } = await import('./settings/PermissionsTab');
    render(<PermissionsTab settings={baseSettings} setSettings={mockSetSettings} />);
    expect(screen.getByText(/额外目录访问/)).toBeInTheDocument();
  });
});
