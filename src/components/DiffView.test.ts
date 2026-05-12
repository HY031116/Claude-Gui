/**
 * computeLineDiff 单元测试
 * 覆盖：空文件、无变更、插入行、删除行、替换行、上下文截断
 */
import { describe, it, expect } from 'vitest';
import { computeLineDiff } from '../components/DiffView';

describe('computeLineDiff', () => {
  it('两边完全相同时所有行均为 ctx 类型（无 del/add）', () => {
    const result = computeLineDiff('hello\nworld', 'hello\nworld');
    expect(result.every((r) => r.type === 'ctx')).toBe(true);
    expect(result.some((r) => r.type === 'del' || r.type === 'add')).toBe(false);
  });

  it('空字符串 vs 空字符串：返回 1 个 ctx 行（空行上下文）', () => {
    const result = computeLineDiff('', '');
    expect(result.every((r) => r.type === 'ctx')).toBe(true);
    expect(result.some((r) => r.type === 'del' || r.type === 'add')).toBe(false);
  });

  it('新增一行：只有 add 类型', () => {
    const result = computeLineDiff('a\nb', 'a\nb\nc');
    const types = result.map((r) => r.type);
    expect(types).toContain('add');
    expect(types).not.toContain('del');
    const added = result.filter((r) => r.type === 'add');
    expect(added[0].text).toBe('c');
  });

  it('删除一行：只有 del 类型', () => {
    const result = computeLineDiff('a\nb\nc', 'a\nb');
    const deleted = result.filter((r) => r.type === 'del');
    expect(deleted).toHaveLength(1);
    expect(deleted[0].text).toBe('c');
  });

  it('替换一行：同时有 del 和 add', () => {
    const result = computeLineDiff('line1\nold\nline3', 'line1\nnew\nline3');
    const types = result.map((r) => r.type);
    expect(types).toContain('del');
    expect(types).toContain('add');
    const del = result.find((r) => r.type === 'del');
    const add = result.find((r) => r.type === 'add');
    expect(del?.text).toBe('old');
    expect(add?.text).toBe('new');
  });

  it('有足够上下文时包含 ctx 行（上下 2 行）', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n');
    const modified = lines.replace('line5', 'modified');
    const result = computeLineDiff(lines, modified);
    const ctx = result.filter((r) => r.type === 'ctx');
    // 上下文 2 行，前后各最多 2 行
    expect(ctx.length).toBeGreaterThan(0);
    expect(ctx.length).toBeLessThanOrEqual(4);
  });

  it('全部内容替换：无 ctx 行', () => {
    const result = computeLineDiff('aaa\nbbb', 'xxx\nyyy');
    const ctx = result.filter((r) => r.type === 'ctx');
    expect(ctx).toHaveLength(0);
  });

  it('多行插入：add 数量等于新增行数', () => {
    const result = computeLineDiff('a', 'a\nb\nc\nd');
    const added = result.filter((r) => r.type === 'add');
    expect(added).toHaveLength(3);
    expect(added.map((r) => r.text)).toEqual(['b', 'c', 'd']);
  });
});
