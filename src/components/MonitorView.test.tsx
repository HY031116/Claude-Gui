/**
 * MonitorView 集成测试
 * 覆盖：统计指标渲染、Tab 切换、Store 数据响应
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

// ──────────────────────────────────────────
// electronAPI mock（ContextPanel/HistoryPanel 可能调用）
// ──────────────────────────────────────────
const mockElectronAPI = {
  readFile: vi.fn().mockResolvedValue({ success: false, content: null }),    // CLAUDE.md 读取（失败静默处理）
  loadCliHistory: vi.fn().mockResolvedValue({ success: true, sessions: [] }), // HistoryPanel 调用
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
  mockElectronAPI.readFile.mockResolvedValue({ success: false, content: null });
  mockElectronAPI.loadCliHistory.mockResolvedValue({ success: true, sessions: [] });
  // 重置为空状态
  useAppStore.setState({
    session: { isConnected: false, workingDirectory: '' },
    messages: [],
    tokenUsage: null,
    tokenHistory: [],
    conversationHistory: [],
    processingTabs: {},
    pendingMonitorTab: null,
    pendingHighlightSessionId: null,
  });
});

// ──────────────────────────────────────────
// 情景 1：统计仪表板渲染
// ──────────────────────────────────────────
describe('MonitorView - 统计仪表板', () => {
  it('应显示"上下文"指标卡片', async () => {
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    expect(screen.getAllByText('上下文').length).toBeGreaterThan(0);
  });

  it('应显示"今日成本"指标卡片', async () => {
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    expect(screen.getByText('今日成本')).toBeInTheDocument();
  });

  it('应显示"历史会话"指标卡片', async () => {
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    // 历史会话在指标卡和 tab 按鈕中各出现一次
    expect(screen.getAllByText('历史会话').length).toBeGreaterThan(0);
  });

  it('应显示"活跃 Agent"指标卡片', async () => {
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    expect(screen.getByText('活跃 Agent')).toBeInTheDocument();
  });

  it('无 tokenUsage 时上下文使用率应为 0.0%', async () => {
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('无处理中 tab 时应显示"全部空闲"', async () => {
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    expect(screen.getByText('全部空闲')).toBeInTheDocument();
  });

  it('有处理中 tab 时应显示"处理中…"', async () => {
    useAppStore.setState({ processingTabs: { 'tab-1': true } });
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    expect(screen.getByText('处理中…')).toBeInTheDocument();
  });

  it('历史会话数量应与 conversationHistory 匹配', async () => {
    useAppStore.setState({
      conversationHistory: [
        { sessionId: 's1', workingDirectory: '/p', lastMessageAt: Date.now(), messageCount: 2, preview: '' },
        { sessionId: 's2', workingDirectory: '/p', lastMessageAt: Date.now(), messageCount: 1, preview: '' },
      ],
    });
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    // conversationHistory.length === 2，找到至少一个 "2" 文字节点
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────
// 情景 2：Tab 渲染与切换
// ──────────────────────────────────────────
describe('MonitorView - Tab 切换', () => {
  it('应显示"上下文""成本""历史"三个 tab', async () => {
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    expect(screen.getByRole('button', { name: /上下文/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /成本/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /历史/ })).toBeInTheDocument();
  });

  it('点击"成本" tab 应切换', async () => {
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    const costTab = screen.getByRole('button', { name: /成本/ });
    fireEvent.click(costTab);
    // 成本 tab 激活后，CostPanel 会渲染
    await waitFor(() => {
      expect(costTab.className).toContain('active');
    });
  });
});

// ──────────────────────────────────────────
// 情景 3：Store 驱动数据更新
// ──────────────────────────────────────────
describe('MonitorView - Store 数据响应', () => {
  it('有 tokenUsage 时上下文使用率应 > 0', async () => {
    useAppStore.setState({
      tokenUsage: { inputTokens: 10000, outputTokens: 5000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    });
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    // 15000 / 200000 = 7.5%
    await waitFor(() => {
      expect(screen.getByText('7.5%')).toBeInTheDocument();
    });
  });

  it('活跃 agent 数应为 2', async () => {
    useAppStore.setState({
      processingTabs: { 'tab-a': true, 'tab-b': true, 'tab-c': false },
    });
    const { MonitorView } = await import('./views/MonitorView');
    render(<MonitorView />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
