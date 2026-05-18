/**
 * AppearanceTab.test.tsx
 * 测试外观设置：主题切换、强调色选择、字体大小选择
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppearanceTab } from './AppearanceTab';
import { useAppStore } from '../../stores/useAppStore';

// 每次测试前重置 store 到默认值
beforeEach(() => {
  useAppStore.setState({
    theme: 'dark',
    accentColor: 'purple',
    fontSize: 'normal',
  });
});

// ─── 主题切换 ─────────────────────────────────────────────────────────────────

describe('AppearanceTab - 主题切换', () => {
  it('默认深色主题时，"深色"按钮应激活', () => {
    render(<AppearanceTab />);
    expect(screen.getByText('深色').closest('button')).toHaveClass('active');
  });

  it('点击"浅色"按钮后 store theme 应变为 light', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByText('浅色').closest('button')!);
    expect(useAppStore.getState().theme).toBe('light');
  });

  it('浅色主题时"浅色"按钮应激活', () => {
    useAppStore.setState({ theme: 'light' });
    render(<AppearanceTab />);
    expect(screen.getByText('浅色').closest('button')).toHaveClass('active');
  });

  it('点击"深色"按钮后 store theme 应变为 dark', () => {
    useAppStore.setState({ theme: 'light' });
    render(<AppearanceTab />);
    fireEvent.click(screen.getByText('深色').closest('button')!);
    expect(useAppStore.getState().theme).toBe('dark');
  });
});

// ─── 强调色 ───────────────────────────────────────────────────────────────────

describe('AppearanceTab - 强调色', () => {
  it('默认显示当前强调色文字 "紫色"', () => {
    render(<AppearanceTab />);
    expect(screen.getByText('紫色')).toBeInTheDocument();
  });

  it('点击"蓝色"按钮后 store accentColor 应变为 blue', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByRole('button', { name: '蓝色' }));
    expect(useAppStore.getState().accentColor).toBe('blue');
  });

  it('点击"翠绿"按钮后 store accentColor 应变为 emerald', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByRole('button', { name: '翠绿' }));
    expect(useAppStore.getState().accentColor).toBe('emerald');
  });

  it('点击"橙色"按钮后 store accentColor 应变为 orange', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByRole('button', { name: '橙色' }));
    expect(useAppStore.getState().accentColor).toBe('orange');
  });

  it('点击"粉色"按钮后 store accentColor 应变为 pink', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByRole('button', { name: '粉色' }));
    expect(useAppStore.getState().accentColor).toBe('pink');
  });

  it('点击"青色"按钮后 store accentColor 应变为 cyan', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByRole('button', { name: '青色' }));
    expect(useAppStore.getState().accentColor).toBe('cyan');
  });

  it('当前强调色按钮应显示勾选图标', () => {
    useAppStore.setState({ accentColor: 'blue' });
    render(<AppearanceTab />);
    // 蓝色按钮应该 active，其他不应 active
    const blueBtn = screen.getByRole('button', { name: '蓝色' });
    expect(blueBtn).toHaveClass('active');
  });
});

// ─── 字体大小 ─────────────────────────────────────────────────────────────────

describe('AppearanceTab - 字体大小', () => {
  it('默认"标准"字体按钮应激活', () => {
    render(<AppearanceTab />);
    expect(screen.getByText('标准').closest('button')).toHaveClass('active');
  });

  it('点击"紧凑"按钮后 store fontSize 应变为 compact', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByText('紧凑').closest('button')!);
    expect(useAppStore.getState().fontSize).toBe('compact');
  });

  it('点击"宽松"按钮后 store fontSize 应变为 relaxed', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByText('宽松').closest('button')!);
    expect(useAppStore.getState().fontSize).toBe('relaxed');
  });

  it('compact 时该按钮应激活', () => {
    useAppStore.setState({ fontSize: 'compact' });
    render(<AppearanceTab />);
    expect(screen.getByText('紧凑').closest('button')).toHaveClass('active');
  });
});

// ─── 预览区渲染 ───────────────────────────────────────────────────────────────

describe('AppearanceTab - 预览区', () => {
  it('应渲染预览标题 "Claude Code GUI"', () => {
    render(<AppearanceTab />);
    expect(screen.getByText('Claude Code GUI')).toBeInTheDocument();
  });

  it('应渲染"强调色"标签', () => {
    render(<AppearanceTab />);
    expect(screen.getAllByText('强调色').length).toBeGreaterThan(0);
  });
});
