import { useState } from 'react';
import { Server, Plus, Trash2, Power, Check, X } from 'lucide-react';

interface IntegrationsTabProps {
  mcpServers: Record<string, any>;
  setMcpServers: (v: Record<string, any>) => void;
  enabledPlugins: Record<string, boolean>;
  setEnabledPlugins: (v: Record<string, boolean>) => void;
}

export function IntegrationsTab({
  mcpServers,
  setMcpServers,
  enabledPlugins,
  setEnabledPlugins,
}: IntegrationsTabProps) {
  const [showMcpAdd, setShowMcpAdd] = useState(false);
  const [newMcp, setNewMcp] = useState({ name: '', type: 'stdio', command: '', args: '', url: '' });

  return (
    <>
      {/* MCP 服务器管理 */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}
          onClick={() => setShowMcpAdd(false)}
        >
          <Server size={14} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 500, fontSize: 12, flex: 1 }}>MCP 服务器</span>
          <span style={{
            background: 'var(--accent-color)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 10,
            padding: '1px 7px',
            minWidth: 20,
            textAlign: 'center',
          }}>
            {Object.keys(mcpServers).length}
          </span>
        </div>

        {/* 已配置的 MCP 服务器列表 */}
        {Object.entries(mcpServers).map(([name, cfg]) => (
          <div key={name} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '8px 10px', background: 'var(--bg-tertiary)',
            borderRadius: 6, marginBottom: 6, fontSize: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{name}</div>
              <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                {cfg.type === 'sse' ? `SSE: ${cfg.url}` : `${cfg.command}${cfg.args?.length ? ' ' + cfg.args.join(' ') : ''}`}
              </div>
            </div>
            <button
              className="btn"
              style={{ padding: '3px 7px', fontSize: 11, flexShrink: 0 }}
              title={`删除 ${name}`}
              onClick={() => {
                const updated = { ...mcpServers };
                delete updated[name];
                setMcpServers(updated);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {/* 添加新 MCP 服务器 */}
        {showMcpAdd ? (
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 10, marginBottom: 6 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <input
                type="text"
                className="input"
                placeholder="服务器名称（如 filesystem）"
                value={newMcp.name}
                onChange={(e) => setNewMcp({ ...newMcp, name: e.target.value })}
                style={{ fontSize: 11 }}
              />
              <select
                className="input"
                value={newMcp.type}
                onChange={(e) => setNewMcp({ ...newMcp, type: e.target.value as 'stdio' | 'sse' })}
                style={{ fontSize: 11, cursor: 'pointer' }}
              >
                <option value="stdio">stdio（本地进程）</option>
                <option value="sse">SSE（远程 HTTP）</option>
              </select>
              {newMcp.type === 'stdio' ? (
                <>
                  <input
                    type="text"
                    className="input"
                    placeholder="命令（如 node、npx）"
                    value={newMcp.command}
                    onChange={(e) => setNewMcp({ ...newMcp, command: e.target.value })}
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="参数，空格分隔（如 /path/to/server.js）"
                    value={newMcp.args}
                    onChange={(e) => setNewMcp({ ...newMcp, args: e.target.value })}
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                </>
              ) : (
                <input
                  type="text"
                  className="input"
                  placeholder="URL（如 http://localhost:3001/sse）"
                  value={newMcp.url}
                  onChange={(e) => setNewMcp({ ...newMcp, url: e.target.value })}
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: 11 }}
                disabled={!newMcp.name.trim() || (newMcp.type === 'stdio' ? !newMcp.command.trim() : !newMcp.url.trim())}
                onClick={() => {
                  if (!newMcp.name.trim()) return;
                  const cfg: any = { type: newMcp.type };
                  if (newMcp.type === 'stdio') {
                    cfg.command = newMcp.command.trim();
                    cfg.args = newMcp.args.trim() ? newMcp.args.trim().split(/\s+/) : [];
                  } else {
                    cfg.url = newMcp.url.trim();
                  }
                  setMcpServers({ ...mcpServers, [newMcp.name.trim()]: cfg });
                  setNewMcp({ name: '', type: 'stdio', command: '', args: '', url: '' });
                  setShowMcpAdd(false);
                }}
              >
                <Check size={12} /> 确认添加
              </button>
              <button
                className="btn"
                style={{ flex: 1, fontSize: 11 }}
                onClick={() => {
                  setShowMcpAdd(false);
                  setNewMcp({ name: '', type: 'stdio', command: '', args: '', url: '' });
                }}
              >
                <X size={12} /> 取消
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn"
            style={{ width: '100%', fontSize: 11, justifyContent: 'center' }}
            onClick={() => setShowMcpAdd(true)}
          >
            <Plus size={12} /> 添加 MCP 服务器
          </button>
        )}
      </div>

      {/* Plugins 管理 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Power size={14} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontWeight: 500, fontSize: 12, flex: 1 }}>已安装插件</span>
        </div>
        {Object.keys(enabledPlugins).length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0', fontStyle: 'italic' }}>
            暂无已安装插件（由 Claude CLI 自动管理）
          </div>
        ) : (
          Object.entries(enabledPlugins).map(([name, enabled]) => (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', background: 'var(--bg-tertiary)',
              borderRadius: 6, marginBottom: 6, fontSize: 12,
            }}>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{name}</span>
              <button
                className={`btn ${enabled ? 'btn-primary' : ''}`}
                style={{ padding: '3px 10px', fontSize: 11 }}
                onClick={() => setEnabledPlugins({ ...enabledPlugins, [name]: !enabled })}
              >
                {enabled ? '已启用' : '已禁用'}
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
