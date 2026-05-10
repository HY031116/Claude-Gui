import { Shield } from 'lucide-react';
import type { AppSettings } from '../../types';

interface PermissionsTabProps {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
}

export function PermissionsTab({ settings, setSettings }: PermissionsTabProps) {
  return (
    <>
      {/* 权限模式 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Shield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          权限模式
        </label>
        <select
          className="input"
          value={settings.permissionMode || 'auto'}
          onChange={(e) => setSettings({ ...settings, permissionMode: e.target.value })}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          <option value="auto">auto — 自动判断（推荐）</option>
          <option value="plan">plan — 只读计划，不执行修改</option>
          <option value="acceptEdits">acceptEdits — 自动接受文件编辑</option>
          <option value="dontAsk">dontAsk — 不询问，完全自主</option>
          <option value="bypassPermissions">⚠ bypassPermissions — 绕过所有权限</option>
        </select>
      </div>

      {/* 精细权限规则 (allow / deny / ask) */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Shield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          精细权限规则
        </label>
        {(
          [
            { key: 'permissionAllow' as const, label: '允许 (allow)', placeholder: '例：Bash(git *) · Read' },
            { key: 'permissionDeny'  as const, label: '拒绝 (deny)',  placeholder: '例：Read(.env) · Bash(rm:*)' },
            { key: 'permissionAsk'  as const, label: '询问 (ask)',   placeholder: '例：WebFetch' },
          ] as const
        ).map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}：</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(settings[key] ?? []).map((rule, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input"
                    value={rule}
                    onChange={(e) => {
                      const next = [...(settings[key] ?? [])];
                      next[i] = e.target.value;
                      setSettings({ ...settings, [key]: next });
                    }}
                    placeholder={placeholder}
                    style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const next = (settings[key] ?? []).filter((_, j) => j !== i);
                      setSettings({ ...settings, [key]: next });
                    }}
                    style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: '#ef4444', cursor: 'pointer', padding: '3px 7px', fontSize: 13, flexShrink: 0 }}
                    title="移除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => setSettings({ ...settings, [key]: [...(settings[key] ?? []), ''] })}
                style={{
                  background: 'none', border: '1px dashed var(--border-color)',
                  borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
                  padding: '4px 10px', fontSize: 12, textAlign: 'left',
                }}
              >
                + 添加规则
              </button>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          写入 settings.json permissions.allow/deny/ask，支持 Tool(pattern) 格式
        </div>
      </div>

      {/* 工具控制 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          工具控制
        </label>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>允许的工具 (--tools)：</div>
          <input
            type="text"
            className="input"
            value={settings.allowedTools === 'default' ? '' : (settings.allowedTools ?? '')}
            onChange={(e) => setSettings({ ...settings, allowedTools: e.target.value || 'default' })}
            placeholder="默认（全部工具），或填写 Bash,Edit,Read"
            style={{ fontSize: 11, fontFamily: 'monospace' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>禁止的工具 (--disallowed-tools)：</div>
          <input
            type="text"
            className="input"
            value={settings.disallowedTools ?? ''}
            onChange={(e) => setSettings({ ...settings, disallowedTools: e.target.value })}
            placeholder="留空则不禁止，或填写 Bash(git:*) WebFetch"
            style={{ fontSize: 11, fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* 额外目录访问权限 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          额外目录访问 (--add-dir)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(settings.addDirs ?? []).map((dir, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                className="input"
                value={dir}
                onChange={(e) => {
                  const next = [...(settings.addDirs ?? [])];
                  next[i] = e.target.value;
                  setSettings({ ...settings, addDirs: next });
                }}
                placeholder="D:\project\my-lib"
                style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }}
              />
              <button
                onClick={() => {
                  const next = (settings.addDirs ?? []).filter((_, j) => j !== i);
                  setSettings({ ...settings, addDirs: next });
                }}
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: '#ef4444', cursor: 'pointer', padding: '3px 7px', fontSize: 13, flexShrink: 0 }}
                title="移除"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => setSettings({ ...settings, addDirs: [...(settings.addDirs ?? []), ''] })}
            style={{
              background: 'none', border: '1px dashed var(--border-color)',
              borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
              padding: '4px 10px', fontSize: 12, textAlign: 'left',
            }}
          >
            + 添加目录
          </button>
        </div>
      </div>
    </>
  );
}
