/**
 * TerminalPanel 测试
 * 覆盖：默认折叠状态、无连接预览文字、已连接预览文字、terminalLines 渲染
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';
import { TerminalPanel } from './TerminalPanel';

// TerminalPanel 不在挂载时调用 electronAPI，故无需 mock

beforeEach(() => {
  useAppStore.setState({
    terminalLines: [],
    rawJsonLog: [],
    session: { isConnected: false, workingDirectory: '' },
  });
});

// ──────────────────────────────────────────
// 默认折叠状态
// ──────────────────────────────────────────
describe('TerminalPanel - 默认折叠', () => {
  it('应渲染 terminal-panel 根元素', () => {
    const { container } = render(<TerminalPanel />);
    const panel = container.querySelector('.terminal-panel');
    expect(panel).not.toBeNull();
  });

  it('默认状态下应带 collapsed 样式类', () => {
    const { container } = render(<TerminalPanel />);
    const panel = container.querySelector('.terminal-panel');
    expect(panel?.className).toContain('collapsed');
  });
});

// ──────────────────────────────────────────
// 预览文字（未连接 vs 已连接）
// ──────────────────────────────────────────
describe('TerminalPanel - 状态预览文字', () => {
  it('未连接且无 terminalLines 时应显示"未连接到 Claude CLI"', () => {
    useAppStore.setState({
      terminalLines: [],
      session: { isConnected: false, workingDirectory: '' },
    });
    render(<TerminalPanel />);
    expect(screen.getByText('未连接到 Claude CLI')).toBeInTheDocument();
  });

  it('已连接且无 terminalLines 时应显示"会话已连接，可直接输入命令"', () => {
    useAppStore.setState({
      terminalLines: [],
      session: { isConnected: true, workingDirectory: '/project' },
    });
    render(<TerminalPanel />);
    expect(screen.getByText('会话已连接，可直接输入命令')).toBeInTheDocument();
  });

  it('有 terminalLines 时预览文字应取最后一行内容', () => {
    useAppStore.setState({
      terminalLines: [
        { id: 1, content: '第一行输出\n', timestamp: Date.now() - 1000 },
        { id: 2, content: '最后一行内容\n', timestamp: Date.now() },
      ],
      session: { isConnected: true, workingDirectory: '/project' },
    });
    render(<TerminalPanel />);
    expect(screen.getByText(/最后一行内容/)).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────
// 终端 header 控件
// ──────────────────────────────────────────
describe('TerminalPanel - header 控件', () => {
  it('应渲染"展开终端"切换按钮', () => {
    render(<TerminalPanel />);
    expect(screen.getByTitle('展开终端')).toBeInTheDocument();
  });
});
