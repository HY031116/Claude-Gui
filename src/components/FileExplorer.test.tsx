/**
 * FileExplorer.test.tsx
 * 测试文件浏览器组件基础渲染及目录/文件交互
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileExplorer } from './FileExplorer';
import { useAppStore } from '../stores/useAppStore';

// ── electronAPI mock ──────────────────────────────────────────────────────────
const mockListDirectory = vi.fn();
const mockReadFile = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockListDirectory.mockResolvedValue({ success: true, entries: [] });
  mockReadFile.mockResolvedValue({ success: false, content: null });

  (window as unknown as Record<string, unknown>).electronAPI = {
    listDirectory: mockListDirectory,
    readFile: mockReadFile,
  };

  // 重置 store
  useAppStore.setState({
    currentPath: '',
    entries: [],
    selectedFile: null,
    fileContent: '',
  } as never);
});

// ─── 基础渲染（无工作目录） ───────────────────────────────────────────────────

describe('FileExplorer - 基础渲染', () => {
  it('渲染路径输入框', () => {
    render(<FileExplorer />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('渲染刷新按钮', () => {
    render(<FileExplorer />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('空目录时显示提示文字', async () => {
    render(<FileExplorer />);
    await waitFor(() => {
      expect(screen.getByText(/请先在委派视图中设置工作目录/)).toBeInTheDocument();
    });
  });

  it('初始加载时调用 listDirectory（默认路径 ~）', async () => {
    render(<FileExplorer />);
    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalledWith('~');
    });
  });
});

// ─── 有 currentPath ───────────────────────────────────────────────────────────

describe('FileExplorer - 有当前路径', () => {
  beforeEach(() => {
    useAppStore.setState({ currentPath: '/project', entries: [] } as never);
  });

  it('路径输入框显示当前路径', () => {
    render(<FileExplorer />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('/project');
  });

  it('显示上级目录 .. 条目', () => {
    render(<FileExplorer />);
    expect(screen.getByText('..'));
  });

  it('按 Enter 触发 loadDirectory', async () => {
    render(<FileExplorer />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalled();
    });
  });

  it('点击刷新按钮触发 loadDirectory', async () => {
    render(<FileExplorer />);
    vi.clearAllMocks();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalled();
    });
  });
});

// ─── 目录条目渲染 ─────────────────────────────────────────────────────────────

describe('FileExplorer - 目录条目', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentPath: '/project',
      entries: [
        { name: 'src', path: '/project/src', type: 'directory', size: 0 },
        { name: 'README.md', path: '/project/README.md', type: 'file', size: 1024 },
        { name: 'package.json', path: '/project/package.json', type: 'file', size: 512 },
      ],
    } as never);
  });

  it('显示目录名称', () => {
    render(<FileExplorer />);
    expect(screen.getByText('src')).toBeInTheDocument();
  });

  it('显示文件名称', () => {
    render(<FileExplorer />);
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });

  it('点击目录调用 listDirectory', async () => {
    mockListDirectory.mockResolvedValue({ success: true, entries: [] });
    render(<FileExplorer />);
    fireEvent.click(screen.getByText('src'));
    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalledWith('/project/src');
    });
  });

  it('点击文件调用 readFile', async () => {
    mockReadFile.mockResolvedValue({ success: true, content: '# README' });
    render(<FileExplorer />);
    fireEvent.click(screen.getByText('README.md'));
    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('/project/README.md');
    });
  });

  it('点击 .. 返回上级目录', async () => {
    useAppStore.setState({ currentPath: '/project/src', entries: [] } as never);
    mockListDirectory.mockResolvedValue({ success: true, entries: [] });
    render(<FileExplorer />);
    fireEvent.click(screen.getByText('..'));
    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalled();
    });
  });
});

// ─── 文件大小格式化 ───────────────────────────────────────────────────────────

describe('FileExplorer - 文件大小', () => {
  it('显示文件大小（KB 单位）', () => {
    useAppStore.setState({
      currentPath: '/project',
      entries: [
        { name: 'large.ts', path: '/project/large.ts', type: 'file', size: 2048 },
      ],
    } as never);
    render(<FileExplorer />);
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('0 字节文件显示 -', () => {
    useAppStore.setState({
      currentPath: '/project',
      entries: [
        { name: 'empty.txt', path: '/project/empty.txt', type: 'file', size: 0 },
      ],
    } as never);
    render(<FileExplorer />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('超过 1MB 的文件显示 MB 单位', () => {
    useAppStore.setState({
      currentPath: '/project',
      entries: [
        { name: 'bundle.js', path: '/project/bundle.js', type: 'file', size: 1024 * 1024 * 2 },
      ],
    } as never);
    render(<FileExplorer />);
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });
});

// ─── 路径输入框 Enter 键 ─────────────────────────────────────────────────────

describe('FileExplorer - 路径输入 Enter 键', () => {
  it('在路径输入框按 Enter 触发 loadDirectory', async () => {
    mockListDirectory.mockResolvedValue({ success: true, entries: [] });
    useAppStore.setState({ currentPath: '/project', entries: [] } as never);
    render(<FileExplorer />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalledWith('/project');
    });
  });
});
