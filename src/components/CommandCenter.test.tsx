/**
 * CommandCenter（指挥中心）视图测试
 * 覆盖：标题渲染、无会话空状态、今日统计、会话列表
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

const mockOnNavClick = vi.fn();
const mockOnStartSession = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // 默认空状态：无 tab，无历史
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
    messages: [],
    processingTabs: {},
    tabs: [],
    activeTabId: '',
    tabSnapshots: {},
    tokenUsage: null,
    activePlanSteps: [],
    conversationHistory: [],
    pinnedTabIds: [],
  });
});

// ──────────────────────────────────────────
// 情景 1：基础渲染
// ──────────────────────────────────────────
describe('CommandCenter - 基础渲染', () => {
  it('应显示"指挥中心"标题', async () => {
    const { CommandCenter } = await import('./views/CommandCenter');
    render(<CommandCenter onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    expect(screen.getByText('指挥中心')).toBeInTheDocument();
  });

  it('无会话时应显示"还没有活跃会话"', async () => {
    const { CommandCenter } = await import('./views/CommandCenter');
    render(<CommandCenter onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    expect(screen.getByText('还没有活跃会话')).toBeInTheDocument();
  });

  it('应显示"今日："统计区域', async () => {
    const { CommandCenter } = await import('./views/CommandCenter');
    render(<CommandCenter onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    expect(screen.getByText('今日：')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────
// 情景 2：有历史会话
// ──────────────────────────────────────────
describe('CommandCenter - 有历史会话', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversationHistory: [
        {
          sessionId: 'sess-001',
          workingDirectory: '/project',
          lastMessageAt: Date.now(),
          messageCount: 5,
          preview: '今日会话摘要',
        },
      ],
    });
  });

  it('今日统计栏始终可见，会话数大于 0', async () => {
    const { CommandCenter } = await import('./views/CommandCenter');
    render(<CommandCenter onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    // 今日统计栏始终显示；todaySessionCount 应为 1
    await waitFor(() => {
      expect(screen.getByText('今日：')).toBeInTheDocument();
      // 统计文字：`{count} 会话` — 找 strong 标签内容为 "1"
      const strongEls = document.querySelectorAll('strong');
      const counts = Array.from(strongEls).map((el) => el.textContent);
      expect(counts).toContain('1');
    });
  });
});

// ──────────────────────────────────────────
// 情景 3：有活跃 tab（处理中状态）
// ──────────────────────────────────────────
describe('CommandCenter - 有活跃 tab', () => {
  beforeEach(() => {
    useAppStore.setState({
      tabs: [
        { id: 'tab-active', label: '代码重构任务', workingDirectory: '/project' },
      ],
      activeTabId: 'tab-active',
      processingTabs: { 'tab-active': true },
    });
  });

  it('有 tab 时，不应显示"还没有活跃会话"', async () => {
    const { CommandCenter } = await import('./views/CommandCenter');
    render(<CommandCenter onNavClick={mockOnNavClick} onStartSession={mockOnStartSession} />);
    await waitFor(() => {
      expect(screen.queryByText('还没有活跃会话')).not.toBeInTheDocument();
    });
  });
});
