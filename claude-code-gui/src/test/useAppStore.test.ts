/**
 * useAppStore 单元测试
 * 覆盖消息操作、多标签管理、终端缓冲三块核心逻辑
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/useAppStore';
import type { Message, TerminalLine } from '@/types/index';

// ────────────────────────────────────────────────────────────
// 辅助工厂
// ────────────────────────────────────────────────────────────
function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    role: 'user',
    content: 'test',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeLine(id: string, content = 'line'): TerminalLine {
  return { id, type: 'stdout', content, timestamp: 0 };
}

// ────────────────────────────────────────────────────────────
// 消息操作
// ────────────────────────────────────────────────────────────
describe('消息操作', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] });
  });

  it('addMessage：追加一条消息', () => {
    const msg = makeMsg({ id: 'm1', content: 'hello' });
    useAppStore.getState().addMessage(msg);
    const { messages } = useAppStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('hello');
  });

  it('addMessage：多次调用保持顺序', () => {
    useAppStore.getState().addMessage(makeMsg({ id: 'a', content: 'first' }));
    useAppStore.getState().addMessage(makeMsg({ id: 'b', content: 'second' }));
    const { messages } = useAppStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('first');
    expect(messages[1].content).toBe('second');
  });

  it('updateMessage：局部更新，不影响其他字段', () => {
    useAppStore.getState().addMessage(makeMsg({ id: 'u1', role: 'user', content: 'before' }));
    useAppStore.getState().updateMessage('u1', { content: 'after' });
    const msg = useAppStore.getState().messages[0];
    expect(msg.content).toBe('after');
    expect(msg.role).toBe('user'); // 未更新字段保留
  });

  it('updateMessage：id 不存在时不修改任何消息', () => {
    useAppStore.getState().addMessage(makeMsg({ id: 'exist', content: 'ok' }));
    useAppStore.getState().updateMessage('nonexist', { content: 'bad' });
    expect(useAppStore.getState().messages[0].content).toBe('ok');
  });

  it('clearMessages：清空所有消息', () => {
    useAppStore.getState().addMessage(makeMsg());
    useAppStore.getState().addMessage(makeMsg());
    useAppStore.getState().clearMessages();
    expect(useAppStore.getState().messages).toHaveLength(0);
  });

  it('setMessages：批量替换消息列表', () => {
    useAppStore.getState().addMessage(makeMsg({ id: 'old' }));
    const newMsgs = [makeMsg({ id: 'new1' }), makeMsg({ id: 'new2' })];
    useAppStore.getState().setMessages(newMsgs);
    const { messages } = useAppStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe('new1');
  });
});

// ────────────────────────────────────────────────────────────
// 终端行缓冲
// ────────────────────────────────────────────────────────────
describe('终端行缓冲', () => {
  beforeEach(() => {
    useAppStore.setState({ terminalLines: [] });
  });

  it('addTerminalLine：追加单行', () => {
    useAppStore.getState().addTerminalLine(makeLine('t1'));
    expect(useAppStore.getState().terminalLines).toHaveLength(1);
  });

  it('addTerminalLines：批量追加', () => {
    useAppStore.getState().addTerminalLines([makeLine('a'), makeLine('b'), makeLine('c')]);
    expect(useAppStore.getState().terminalLines).toHaveLength(3);
  });

  it('addTerminalLines：超过 500 行时截断保留最新 500 条', () => {
    // 先写入 498 条
    const existing = Array.from({ length: 498 }, (_, i) => makeLine(`old-${i}`, `old ${i}`));
    useAppStore.setState({ terminalLines: existing });

    // 再追加 3 条（共 501，超出 1 条）
    useAppStore.getState().addTerminalLines([
      makeLine('new-1', 'new 1'),
      makeLine('new-2', 'new 2'),
      makeLine('new-3', 'new 3'),
    ]);

    const lines = useAppStore.getState().terminalLines;
    expect(lines).toHaveLength(500);
    // 最旧的 old-0 应被丢弃，新 3 条在末尾
    expect(lines[0].content).toBe('old 1');   // old-0 已丢弃
    expect(lines[497].content).toBe('new 1'); // 第一条新行
    expect(lines[499].content).toBe('new 3'); // 最后一条新行
  });

  it('addTerminalLine：单行超过 500 上限时允许暂时为 501（slice 在头部）', () => {
    // addTerminalLine 实现：[...slice(-500), line]
    // 若已有 500 条，新增后为 501（与 addTerminalLines 的 slice(-500) 不同）
    const existing = Array.from({ length: 500 }, (_, i) => makeLine(`old-${i}`));
    useAppStore.setState({ terminalLines: existing });
    useAppStore.getState().addTerminalLine(makeLine('overflow'));
    const lines = useAppStore.getState().terminalLines;
    // 实现保留最旧 500 + 新 1 = 501
    expect(lines).toHaveLength(501);
    expect(lines[500].id).toBe('overflow');
  });

  it('clearTerminal：清空所有终端行', () => {
    useAppStore.getState().addTerminalLines([makeLine('x'), makeLine('y')]);
    useAppStore.getState().clearTerminal();
    expect(useAppStore.getState().terminalLines).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────
// 多标签操作
// ────────────────────────────────────────────────────────────
describe('多标签操作', () => {
  beforeEach(() => {
    useAppStore.setState({
      tabs: [{ id: 'tab-1', label: '会话 1' }],
      activeTabId: 'tab-1',
      tabSnapshots: {},
      messages: [],
    });
  });

  it('renameTab：修改指定 tab 的标签', () => {
    useAppStore.setState({ tabs: [{ id: 'a', label: '旧名称' }] });
    useAppStore.getState().renameTab('a', '新名称');
    expect(useAppStore.getState().tabs[0].label).toBe('新名称');
  });

  it('renameTab：不影响其他 tab', () => {
    useAppStore.setState({
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    });
    useAppStore.getState().renameTab('a', 'A-renamed');
    const tabs = useAppStore.getState().tabs;
    expect(tabs.find(t => t.id === 'b')?.label).toBe('B');
  });

  it('reorderTab：正向移动（从前到后）', () => {
    useAppStore.setState({
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
    });
    useAppStore.getState().reorderTab(0, 2); // A 移到末尾
    const ids = useAppStore.getState().tabs.map(t => t.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('reorderTab：反向移动（从后到前）', () => {
    useAppStore.setState({
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
    });
    useAppStore.getState().reorderTab(2, 0); // C 移到最前
    const ids = useAppStore.getState().tabs.map(t => t.id);
    expect(ids).toEqual(['c', 'a', 'b']);
  });

  it('reorderTab：相同位置不改变顺序', () => {
    useAppStore.setState({
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    });
    useAppStore.getState().reorderTab(1, 1);
    const ids = useAppStore.getState().tabs.map(t => t.id);
    expect(ids).toEqual(['a', 'b']);
  });

  it('closeTab：不允许关闭最后一个 tab', () => {
    useAppStore.setState({
      tabs: [{ id: 'only', label: 'Only' }],
      activeTabId: 'only',
    });
    useAppStore.getState().closeTab('only');
    expect(useAppStore.getState().tabs).toHaveLength(1); // 不变
  });

  it('closeTab：关闭非活跃 tab，activeTabId 不变', () => {
    useAppStore.setState({
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      activeTabId: 'a',
    });
    useAppStore.getState().closeTab('b');
    expect(useAppStore.getState().tabs).toHaveLength(1);
    expect(useAppStore.getState().activeTabId).toBe('a');
  });

  it('closeTab：关闭活跃 tab 时切换到相邻 tab', () => {
    useAppStore.setState({
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
      activeTabId: 'b',
      tabSnapshots: { a: { messages: [], session: { isConnected: false, workingDirectory: '' }, tokenUsage: null, todoItems: [], activePlanSteps: [] } },
    });
    useAppStore.getState().closeTab('b');
    const state = useAppStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.map(t => t.id)).not.toContain('b');
    // 活跃 tab 应切换到 a（idx - 1）
    expect(state.activeTabId).toBe('a');
  });
});
