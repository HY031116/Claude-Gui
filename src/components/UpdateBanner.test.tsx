/**
 * UpdateBanner.test.tsx
 * 测试自动更新横幅通知组件
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UpdateBanner } from './UpdateBanner';

// ── mock ─────────────────────────────────────────────────────────────────────
let statusCallback: ((s: unknown) => void) | null = null;
const mockUnsub = vi.fn();
const mockDownloadUpdate = vi.fn().mockResolvedValue(undefined);
const mockInstallUpdate = vi.fn();

function triggerStatus(s: unknown) {
  act(() => {
    statusCallback?.(s);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  statusCallback = null;
  mockUnsub.mockReturnValue(undefined);

  (window as unknown as Record<string, unknown>).electronAPI = {
    onUpdateStatus: (cb: (s: unknown) => void) => {
      statusCallback = cb;
      return mockUnsub;
    },
    downloadUpdate: mockDownloadUpdate,
    installUpdate: mockInstallUpdate,
  };
});

// ─── 空/初始状态 ──────────────────────────────────────────────────────────────

describe('UpdateBanner - 无状态', () => {
  it('初始不渲染任何横幅', () => {
    render(<UpdateBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── available 状态 ───────────────────────────────────────────────────────────

describe('UpdateBanner - 发现新版本 (available)', () => {
  it('显示版本号和下载按钮', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'available', version: '5.1.0' });
    expect(screen.getByText(/发现新版本/)).toBeInTheDocument();
    expect(screen.getByText('下载')).toBeInTheDocument();
  });

  it('点击下载按钮调用 downloadUpdate', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'available', version: '5.1.0' });
    fireEvent.click(screen.getByText('下载'));
    expect(mockDownloadUpdate).toHaveBeenCalled();
  });

  it('点击关闭按钮隐藏横幅', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'available', version: '5.1.0' });
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── downloading 状态 ─────────────────────────────────────────────────────────

describe('UpdateBanner - 下载中 (downloading)', () => {
  it('显示下载进度百分比', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'downloading', percent: 45 });
    expect(screen.getByText(/下载更新中/)).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });
});

// ─── downloaded 状态 ──────────────────────────────────────────────────────────

describe('UpdateBanner - 下载完成 (downloaded)', () => {
  it('显示版本和重启按钮', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'downloaded', version: '5.1.0' });
    expect(screen.getByText(/已下载/)).toBeInTheDocument();
    expect(screen.getByText('立即重启安装')).toBeInTheDocument();
  });

  it('点击重启按钮调用 installUpdate', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'downloaded', version: '5.1.0' });
    fireEvent.click(screen.getByText('立即重启安装'));
    expect(mockInstallUpdate).toHaveBeenCalled();
  });
});

// ─── error 状态 ───────────────────────────────────────────────────────────────

describe('UpdateBanner - 更新错误 (error)', () => {
  it('显示错误信息', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'error', message: '网络连接失败' });
    expect(screen.getByText(/更新检查失败/)).toBeInTheDocument();
  });
});

// ─── checking / not-available 状态不显示横幅 ──────────────────────────────────

describe('UpdateBanner - 不显示横幅的状态', () => {
  it('checking 状态不显示横幅', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'checking' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('not-available 状态不显示横幅', () => {
    render(<UpdateBanner />);
    triggerStatus({ type: 'not-available' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
