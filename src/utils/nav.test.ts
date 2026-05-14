/**
 * computeNavTransition 单元测试
 * 现行导航模型：command / dispatch / agents / review / artifacts / capabilities / monitor / settings
 */
import { describe, expect, it } from 'vitest';
import { computeNavTransition } from '../utils/nav';

describe('computeNavTransition — command', () => {
  it('任意状态点击 command 都回到指挥中心', () => {
    expect(computeNavTransition('dispatch', 'files', 'command')).toEqual({ section: 'command' });
    expect(computeNavTransition('monitor', 'files', 'command')).toEqual({ section: 'command' });
    expect(computeNavTransition('command', '', 'command')).toEqual({ section: 'command' });
  });
});

describe('computeNavTransition — dispatch', () => {
  it('切到 dispatch 时继承合法辅助面板', () => {
    expect(computeNavTransition('command', 'files', 'dispatch')).toEqual({ section: 'dispatch', subPanel: 'files' });
    expect(computeNavTransition('monitor', 'git', 'dispatch')).toEqual({ section: 'dispatch', subPanel: 'git' });
    expect(computeNavTransition('review', 'changes', 'dispatch')).toEqual({ section: 'dispatch', subPanel: 'changes' });
    expect(computeNavTransition('artifacts', 'context', 'dispatch')).toEqual({ section: 'dispatch', subPanel: 'context' });
    expect(computeNavTransition('agents', 'checkpoints', 'dispatch')).toEqual({ section: 'dispatch', subPanel: 'checkpoints' });
  });

  it('切到 dispatch 时遇到非法辅助面板回退到 files', () => {
    expect(computeNavTransition('command', 'tasks', 'dispatch')).toEqual({ section: 'dispatch', subPanel: 'files' });
  });

  it('已在 dispatch 时再次点击会折叠回 command', () => {
    expect(computeNavTransition('dispatch', 'git', 'dispatch')).toEqual({ section: 'command' });
  });
});

describe('computeNavTransition — 其他 section', () => {
  it('点击其他导航直接切换，不携带辅助面板', () => {
    expect(computeNavTransition('command', 'files', 'agents')).toEqual({ section: 'agents' });
    expect(computeNavTransition('dispatch', 'changes', 'review')).toEqual({ section: 'review' });
    expect(computeNavTransition('dispatch', 'changes', 'artifacts')).toEqual({ section: 'artifacts' });
    expect(computeNavTransition('dispatch', 'changes', 'capabilities')).toEqual({ section: 'capabilities' });
    expect(computeNavTransition('dispatch', 'changes', 'monitor')).toEqual({ section: 'monitor' });
    expect(computeNavTransition('dispatch', 'changes', 'settings')).toEqual({ section: 'settings' });
  });

  it('非 command section 再次点击同一入口会折叠回 command', () => {
    expect(computeNavTransition('agents', '', 'agents')).toEqual({ section: 'command' });
    expect(computeNavTransition('review', '', 'review')).toEqual({ section: 'command' });
    expect(computeNavTransition('artifacts', '', 'artifacts')).toEqual({ section: 'command' });
    expect(computeNavTransition('capabilities', '', 'capabilities')).toEqual({ section: 'command' });
    expect(computeNavTransition('monitor', '', 'monitor')).toEqual({ section: 'command' });
    expect(computeNavTransition('settings', '', 'settings')).toEqual({ section: 'command' });
  });
});

