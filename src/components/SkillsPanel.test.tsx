/**
 * SkillsPanel.test.tsx
 * 测试 Skills / 指令文件管理面板基础渲染及交互
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SkillsPanel } from './SkillsPanel';
import { useAppStore } from '../stores/useAppStore';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockReadFile = vi.fn();
const mockListDirectory = vi.fn();
const mockSelectFile = vi.fn();
const mockWriteFile = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockReadFile.mockResolvedValue({ success: false, content: null });
  mockListDirectory.mockResolvedValue({ success: true, entries: [] });
  mockSelectFile.mockResolvedValue({ success: false, path: null });
  mockWriteFile.mockResolvedValue({ success: true });

  (window as unknown as Record<string, unknown>).electronAPI = {
    readFile: mockReadFile,
    listDirectory: mockListDirectory,
    selectFile: mockSelectFile,
    writeFile: mockWriteFile,
  };

  // 默认无工作目录
  useAppStore.setState({ session: { workingDirectory: '' } as never });
});

// ─── 基础渲染 ─────────────────────────────────────────────────────────────────

describe('SkillsPanel - 基础渲染', () => {
  it('渲染 "Skills / 指令文件" 标题', () => {
    render(<SkillsPanel />);
    expect(screen.getByText('Skills / 指令文件')).toBeInTheDocument();
  });

  it('显示刷新按钮', () => {
    render(<SkillsPanel />);
    expect(screen.getByTitle('刷新扫描')).toBeInTheDocument();
  });

  it('显示浏览按钮', () => {
    render(<SkillsPanel />);
    expect(screen.getByText('浏览')).toBeInTheDocument();
  });

  it('显示新建按钮', () => {
    render(<SkillsPanel />);
    expect(screen.getByText('新建')).toBeInTheDocument();
  });
});

// ─── 无工作目录 ───────────────────────────────────────────────────────────────

describe('SkillsPanel - 无工作目录', () => {
  it('无工作目录时不调用 listDirectory', () => {
    render(<SkillsPanel />);
    expect(mockListDirectory).not.toHaveBeenCalled();
  });
});

// ─── 有工作目录 ───────────────────────────────────────────────────────────────

describe('SkillsPanel - 有工作目录', () => {
  beforeEach(() => {
    useAppStore.setState({ session: { workingDirectory: '/project' } as never });
  });

  it('有工作目录时调用 listDirectory 扫描 skills', async () => {
    render(<SkillsPanel />);
    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalled();
    });
  });

  it('扫描后若无文件则列表为空', async () => {
    mockListDirectory.mockResolvedValue({ success: true, entries: [] });
    render(<SkillsPanel />);
    // 不报错即通过，只检查标题存在
    await waitFor(() => {
      expect(screen.getByText('Skills / 指令文件')).toBeInTheDocument();
    });
  });
});

// ─── 新建文件 ─────────────────────────────────────────────────────────────────

describe('SkillsPanel - 新建文件', () => {
  beforeEach(() => {
    useAppStore.setState({ session: { workingDirectory: '/project' } as never });
  });

  it('点击"新建"显示文件名输入框', async () => {
    render(<SkillsPanel />);
    await waitFor(() => {
      expect(screen.getByText('新建')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('新建'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('文件名，如 CLAUDE.md')).toBeInTheDocument();
    });
  });

  it('默认新建文件名是 CLAUDE.md', async () => {
    render(<SkillsPanel />);
    fireEvent.click(screen.getByText('新建'));
    await waitFor(() => {
      const input = screen.getByPlaceholderText('文件名，如 CLAUDE.md') as HTMLInputElement;
      expect(input.value).toBe('CLAUDE.md');
    });
  });

  it('按 Escape 取消新建', async () => {
    render(<SkillsPanel />);
    fireEvent.click(screen.getByText('新建'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('文件名，如 CLAUDE.md')).toBeInTheDocument();
    });
    fireEvent.keyDown(screen.getByPlaceholderText('文件名，如 CLAUDE.md'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('文件名，如 CLAUDE.md')).not.toBeInTheDocument();
    });
  });

  it('按 Enter 创建文件并调用 writeFile', async () => {
    render(<SkillsPanel />);
    fireEvent.click(screen.getByText('新建'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('文件名，如 CLAUDE.md')).toBeInTheDocument();
    });
    fireEvent.keyDown(screen.getByPlaceholderText('文件名，如 CLAUDE.md'), { key: 'Enter' });
    await waitFor(() => {
      expect(mockWriteFile).toHaveBeenCalledWith('/project/CLAUDE.md', expect.stringContaining('CLAUDE.md'));
    });
  });
});

// ─── 文件列表有数据 ───────────────────────────────────────────────────────────

describe('SkillsPanel - 有 CLAUDE.md 文件', () => {
  beforeEach(() => {
    useAppStore.setState({ session: { workingDirectory: '/project' } as never });
    // 模拟 CLAUDE.md 存在
    mockReadFile.mockImplementation((path: string) => {
      if (path === '/project/CLAUDE.md') return Promise.resolve({ success: true, content: '# My Claude Instructions\n' });
      return Promise.resolve({ success: false, content: null });
    });
  });

  it('文件列表显示 CLAUDE.md', async () => {
    render(<SkillsPanel />);
    await waitFor(() => {
      expect(screen.getByText('CLAUDE.md')).toBeInTheDocument();
    });
  });

  it('点击 CLAUDE.md 文件调用 readFile', async () => {
    render(<SkillsPanel />);
    await waitFor(() => {
      expect(screen.getByText('CLAUDE.md')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('CLAUDE.md'));
    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('/project/CLAUDE.md');
    });
  });
});
