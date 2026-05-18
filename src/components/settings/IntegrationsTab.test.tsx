/**
 * IntegrationsTab.test.tsx
 * 测试集成设置：MCP 服务器管理 + 插件管理
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntegrationsTab } from './IntegrationsTab';

// ─── 基础渲染 ─────────────────────────────────────────────────────────────────

describe('IntegrationsTab - 基础渲染', () => {
  it('应渲染 MCP 服务器标题', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByText('MCP 服务器')).toBeInTheDocument();
  });

  it('应渲染"添加 MCP 服务器"按钮', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByRole('button', { name: /添加 MCP 服务器/ })).toBeInTheDocument();
  });

  it('无插件时应显示"暂无已安装插件"提示', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByText(/暂无已安装插件/)).toBeInTheDocument();
  });

  it('MCP 服务器计数徽章正确显示', () => {
    render(<IntegrationsTab mcpServers={{ svr1: {}, svr2: {} }} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ─── MCP 服务器列表 ───────────────────────────────────────────────────────────

describe('IntegrationsTab - MCP 服务器列表', () => {
  it('显示已配置的服务器名称', () => {
    const servers = { filesystem: { type: 'stdio', command: 'node', args: ['server.js'] } };
    render(<IntegrationsTab mcpServers={servers} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByText('filesystem')).toBeInTheDocument();
  });

  it('stdio 类型显示命令+参数', () => {
    const servers = { mysvr: { type: 'stdio', command: 'npx', args: ['mcp-server'] } };
    render(<IntegrationsTab mcpServers={servers} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByText(/npx mcp-server/)).toBeInTheDocument();
  });

  it('sse 类型显示 URL', () => {
    const servers = { remote: { type: 'sse', url: 'http://localhost:3001/sse' } };
    render(<IntegrationsTab mcpServers={servers} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByText(/SSE: http:\/\/localhost:3001\/sse/)).toBeInTheDocument();
  });

  it('点击删除按钮应调用 setMcpServers 并移除对应服务器', () => {
    const setMcpServers = vi.fn();
    const servers = { fs: { type: 'stdio', command: 'node', args: [] }, api: { type: 'sse', url: 'http://x' } };
    render(<IntegrationsTab mcpServers={servers} setMcpServers={setMcpServers} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    const deleteButtons = screen.getAllByTitle(/删除/);
    fireEvent.click(deleteButtons[0]); // 删除第一个 (fs)
    expect(setMcpServers).toHaveBeenCalledOnce();
    const updated = setMcpServers.mock.calls[0][0];
    expect(Object.keys(updated)).not.toContain('fs');
    expect(Object.keys(updated)).toContain('api');
  });
});

// ─── 添加 MCP 服务器（表单交互）─────────────────────────────────────────────

describe('IntegrationsTab - 添加 MCP 表单', () => {
  it('点击"添加 MCP 服务器"后展开表单', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /添加 MCP 服务器/ }));
    expect(screen.getByPlaceholderText(/服务器名称/)).toBeInTheDocument();
  });

  it('点击"取消"后收起表单', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /添加 MCP 服务器/ }));
    fireEvent.click(screen.getByRole('button', { name: /取消/ }));
    expect(screen.queryByPlaceholderText(/服务器名称/)).not.toBeInTheDocument();
  });

  it('stdio 模式：输入名称和命令后"确认添加"按钮可点击', () => {
    const setMcpServers = vi.fn();
    render(<IntegrationsTab mcpServers={{}} setMcpServers={setMcpServers} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /添加 MCP 服务器/ }));

    fireEvent.change(screen.getByPlaceholderText(/服务器名称/), { target: { value: 'myfs' } });
    fireEvent.change(screen.getByPlaceholderText(/命令/), { target: { value: 'node' } });

    const confirmBtn = screen.getByRole('button', { name: /确认添加/ });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(setMcpServers).toHaveBeenCalledOnce();
    const updated = setMcpServers.mock.calls[0][0];
    expect(updated['myfs']).toMatchObject({ type: 'stdio', command: 'node' });
  });

  it('stdio 模式：传入参数时正确解析为数组', () => {
    const setMcpServers = vi.fn();
    render(<IntegrationsTab mcpServers={{}} setMcpServers={setMcpServers} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /添加 MCP 服务器/ }));

    fireEvent.change(screen.getByPlaceholderText(/服务器名称/), { target: { value: 'svr' } });
    fireEvent.change(screen.getByPlaceholderText(/命令/), { target: { value: 'npx' } });
    fireEvent.change(screen.getByPlaceholderText(/参数/), { target: { value: '/path/server.js --port 3000' } });

    fireEvent.click(screen.getByRole('button', { name: /确认添加/ }));
    const updated = setMcpServers.mock.calls[0][0];
    expect(updated['svr'].args).toEqual(['/path/server.js', '--port', '3000']);
  });

  it('切换到 SSE 模式后显示 URL 输入框', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /添加 MCP 服务器/ }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sse' } });
    expect(screen.getByPlaceholderText(/URL/)).toBeInTheDocument();
  });

  it('SSE 模式：输入 URL 后提交', () => {
    const setMcpServers = vi.fn();
    render(<IntegrationsTab mcpServers={{}} setMcpServers={setMcpServers} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /添加 MCP 服务器/ }));
    fireEvent.change(screen.getByPlaceholderText(/服务器名称/), { target: { value: 'sse-svr' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sse' } });
    fireEvent.change(screen.getByPlaceholderText(/URL/), { target: { value: 'http://localhost:3001/sse' } });
    fireEvent.click(screen.getByRole('button', { name: /确认添加/ }));
    expect(setMcpServers.mock.calls[0][0]['sse-svr']).toMatchObject({ type: 'sse', url: 'http://localhost:3001/sse' });
  });

  it('未填写名称时"确认添加"按钮应禁用', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{}} setEnabledPlugins={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /添加 MCP 服务器/ }));
    const confirmBtn = screen.getByRole('button', { name: /确认添加/ });
    expect(confirmBtn).toBeDisabled();
  });
});

// ─── 插件管理 ────────────────────────────────────────────────────────────────

describe('IntegrationsTab - 插件管理', () => {
  it('已安装插件显示插件名称', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{ myPlugin: true }} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByText('myPlugin')).toBeInTheDocument();
  });

  it('启用的插件显示"已启用"', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{ pl: true }} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByRole('button', { name: /已启用/ })).toBeInTheDocument();
  });

  it('禁用的插件显示"已禁用"', () => {
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{ pl: false }} setEnabledPlugins={vi.fn()} />);
    expect(screen.getByRole('button', { name: /已禁用/ })).toBeInTheDocument();
  });

  it('点击"已启用"按钮应切换为 false', () => {
    const setEnabledPlugins = vi.fn();
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{ pl: true }} setEnabledPlugins={setEnabledPlugins} />);
    fireEvent.click(screen.getByRole('button', { name: /已启用/ }));
    expect(setEnabledPlugins.mock.calls[0][0]).toMatchObject({ pl: false });
  });

  it('点击"已禁用"按钮应切换为 true', () => {
    const setEnabledPlugins = vi.fn();
    render(<IntegrationsTab mcpServers={{}} setMcpServers={vi.fn()} enabledPlugins={{ pl: false }} setEnabledPlugins={setEnabledPlugins} />);
    fireEvent.click(screen.getByRole('button', { name: /已禁用/ }));
    expect(setEnabledPlugins.mock.calls[0][0]).toMatchObject({ pl: true });
  });
});
