/**
 * computeNavTransition 单元测试（Phase B 更新）
 * NavClick: 'chat' | 'project' | 'tools' | 'history'（config 已移除）
 * NavSection: 'chat' | 'project' | 'tools' | 'history'
 */
import { describe, it, expect } from 'vitest';
import { computeNavTransition } from '../utils/nav';

describe('computeNavTransition — chat 按钮', () => {
  it('任意状态点击 chat → section 变为 chat', () => {
    expect(computeNavTransition('tools', 'tasks', 'chat').section).toBe('chat');
    expect(computeNavTransition('project', 'files', 'chat').section).toBe('chat');
    expect(computeNavTransition('history', 'sessions', 'chat').section).toBe('chat');
    expect(computeNavTransition('chat', '', 'chat').section).toBe('chat');
  });
});

describe('computeNavTransition — project 按钮', () => {
  it('非 project 状态点击 → 进入 project，继承合法 subPanel', () => {
    const t = computeNavTransition('chat', 'files', 'project');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('files'); // 'files' 是合法子标签，继承
  });

  it('非 project 状态点击，当前 sub 不合法 → 重置为 files', () => {
    const t = computeNavTransition('chat', 'tasks', 'project');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('files');
  });

  it('已在 project → 再次点击 → 折叠回 chat', () => {
    const t = computeNavTransition('project', 'git', 'project');
    expect(t.section).toBe('chat');
  });
});

describe('computeNavTransition — tools 按钮（含原 config 子面板）', () => {
  it('非 tools 状态点击 → 进入 tools，继承合法 subPanel', () => {
    const t = computeNavTransition('chat', 'settings', 'tools');
    expect(t.section).toBe('tools');
    expect(t.subPanel).toBe('settings'); // 'settings' 已合并入 tools，合法继承
  });

  it('非 tools 状态点击，继承原 config 子面板 rules', () => {
    const t = computeNavTransition('chat', 'rules', 'tools');
    expect(t.section).toBe('tools');
    expect(t.subPanel).toBe('rules');
  });

  it('非 tools 状态点击，当前 sub 不合法 → 重置为默认值 tasks', () => {
    const t = computeNavTransition('chat', 'unknown', 'tools');
    expect(t.section).toBe('tools');
    expect(t.subPanel).toBe('tasks');
  });

  it('已在 tools → 再次点击 → 折叠回 chat', () => {
    const t = computeNavTransition('tools', 'tasks', 'tools');
    expect(t.section).toBe('chat');
  });

  it('工具子面板 cost 可被继承', () => {
    const t = computeNavTransition('history', 'cost', 'tools');
    expect(t.section).toBe('tools');
    // cost 是 tools 合法子标签，应继承
    expect(t.subPanel).toBe('cost');
  });
});

describe('computeNavTransition — history 按钮', () => {
  it('非 history 状态点击 → 进入 history，继承合法 subPanel', () => {
    const t = computeNavTransition('chat', 'sessions', 'history');
    expect(t.section).toBe('history');
    expect(t.subPanel).toBe('sessions');
  });

  it('非 history 状态点击，当前 sub 不合法 → 重置为默认值 sessions', () => {
    const t = computeNavTransition('tools', 'tasks', 'history');
    expect(t.section).toBe('history');
    expect(t.subPanel).toBe('sessions');
  });

  it('已在 history → 再次点击 → 折叠回 chat', () => {
    const t = computeNavTransition('history', 'sessions', 'history');
    expect(t.section).toBe('chat');
  });
});


describe('computeNavTransition — files 按钮', () => {
  it('未激活时点击 files → section=project, subPanel=files', () => {
    const t = computeNavTransition('chat', 'files', 'project');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('files'); // 'files' 合法，继承
  });

  it('已激活（project）时再次点击 → 折叠回 chat', () => {
    const t = computeNavTransition('project', 'files', 'project');
    expect(t.section).toBe('chat');
  });

  it('project section 但 sub 不是 files 时点击 project → 保持合法子面板', () => {
    const t = computeNavTransition('chat', 'git', 'project');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('git'); // git 合法，继承
  });
});

describe('computeNavTransition — changes 按钮（通过 project 导航）', () => {
  it('未激活时点击 project，当前 sub=changes → 进入 project+changes', () => {
    const t = computeNavTransition('chat', 'changes', 'project');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('changes');
  });

  it('已在 project，子面板 changes → 再次点击 project → 折叠回 chat', () => {
    const t = computeNavTransition('project', 'changes', 'project');
    expect(t.section).toBe('chat');
  });
});

