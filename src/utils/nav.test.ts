/**
 * computeNavTransition 单元测试
 * 覆盖：chat 切换、files/changes 直达与折叠、tools/config 展开与折叠、子标签继承与重置
 */
import { describe, it, expect } from 'vitest';
import { computeNavTransition } from '../utils/nav';

describe('computeNavTransition — chat 按钮', () => {
  it('任意状态点击 chat → section 变为 chat', () => {
    expect(computeNavTransition('tools', 'mcp', 'chat').section).toBe('chat');
    expect(computeNavTransition('config', 'settings', 'chat').section).toBe('chat');
    expect(computeNavTransition('project', 'files', 'chat').section).toBe('chat');
  });
});

describe('computeNavTransition — files 按钮', () => {
  it('未激活时点击 files → section=project, subPanel=files', () => {
    const t = computeNavTransition('chat', 'files', 'files');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('files');
  });

  it('已激活（project + files）时再次点击 → 折叠回 chat', () => {
    const t = computeNavTransition('project', 'files', 'files');
    expect(t.section).toBe('chat');
  });

  it('project section 但 sub 不是 files 时点击 files → 直达 files', () => {
    const t = computeNavTransition('project', 'git', 'files');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('files');
  });
});

describe('computeNavTransition — changes 按钮', () => {
  it('未激活时点击 changes → section=project, subPanel=changes', () => {
    const t = computeNavTransition('chat', 'mcp', 'changes');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('changes');
  });

  it('已激活（project + changes）时再次点击 → 折叠回 chat', () => {
    const t = computeNavTransition('project', 'changes', 'changes');
    expect(t.section).toBe('chat');
  });

  it('project + files 时点击 changes → 切换到 changes', () => {
    const t = computeNavTransition('project', 'files', 'changes');
    expect(t.section).toBe('project');
    expect(t.subPanel).toBe('changes');
  });
});

describe('computeNavTransition — tools 按钮', () => {
  it('非 tools 状态点击 tools → 展开，section=tools', () => {
    const t = computeNavTransition('chat', 'settings', 'tools');
    expect(t.section).toBe('tools');
  });

  it('展开 tools 时当前 sub 合法 → subPanel 不覆盖（返回 undefined）', () => {
    const t = computeNavTransition('chat', 'agents', 'tools');
    expect(t.section).toBe('tools');
    expect(t.subPanel).toBeUndefined(); // agents 是 tools 合法子标签，不覆盖
  });

  it('展开 tools 时当前 sub 不合法 → 重置为默认值 mcp', () => {
    const t = computeNavTransition('chat', 'settings', 'tools');
    expect(t.subPanel).toBe('mcp');
  });

  it('已在 tools → 再次点击 → 折叠回 chat', () => {
    const t = computeNavTransition('tools', 'mcp', 'tools');
    expect(t.section).toBe('chat');
  });
});

describe('computeNavTransition — config 按钮', () => {
  it('非 config 状态点击 config → 展开，section=config', () => {
    const t = computeNavTransition('chat', 'mcp', 'config');
    expect(t.section).toBe('config');
  });

  it('展开 config 时当前 sub 合法 → subPanel 不覆盖', () => {
    const t = computeNavTransition('chat', 'rules', 'config');
    expect(t.section).toBe('config');
    expect(t.subPanel).toBeUndefined(); // rules 是 config 合法子标签
  });

  it('展开 config 时当前 sub 不合法 → 重置为默认值 settings', () => {
    const t = computeNavTransition('chat', 'mcp', 'config');
    expect(t.subPanel).toBe('settings');
  });

  it('已在 config → 再次点击 → 折叠回 chat', () => {
    const t = computeNavTransition('config', 'settings', 'config');
    expect(t.section).toBe('chat');
  });
});
