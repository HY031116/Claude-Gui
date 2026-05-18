/**
 * WebModeBanner.test.tsx
 * 测试 Web 模式提示横幅
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// mock isElectron 来控制环境
vi.mock('../lib/transport', () => ({
  isElectron: vi.fn(() => false),
}));

import { WebModeBanner } from './WebModeBanner';
import { isElectron } from '../lib/transport';

const mockIsElectron = vi.mocked(isElectron);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockIsElectron.mockReturnValue(false);
});

// ─── Electron 环境 ───────────────────────────────────────────────────────────

describe('WebModeBanner - Electron 环境', () => {
  it('Electron 环境下不渲染横幅', () => {
    mockIsElectron.mockReturnValue(true);
    render(<WebModeBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ─── Web 环境 ─────────────────────────────────────────────────────────────────

describe('WebModeBanner - Web 环境', () => {
  it('Web 环境下显示横幅', () => {
    render(<WebModeBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('横幅包含 Web 模式说明文字', () => {
    render(<WebModeBanner />);
    expect(screen.getByText(/Web 模式/)).toBeInTheDocument();
  });

  it('点击关闭按钮后横幅消失', () => {
    render(<WebModeBanner />);
    fireEvent.click(screen.getByLabelText('关闭提示'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('关闭后将标记写入 sessionStorage', () => {
    render(<WebModeBanner />);
    fireEvent.click(screen.getByLabelText('关闭提示'));
    expect(sessionStorage.getItem('web-banner-dismissed')).toBe('1');
  });

  it('sessionStorage 已有 dismissed 标记时不显示', () => {
    sessionStorage.setItem('web-banner-dismissed', '1');
    render(<WebModeBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
