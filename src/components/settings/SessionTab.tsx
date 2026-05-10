import type { AppSettings } from '../../types';

interface SessionTabProps {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
}

export function SessionTab({ settings, setSettings }: SessionTabProps) {
  return (
    <>
      {/* 思维 (Thinking) 设置 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          思维 (Thinking) 设置
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.alwaysThinkingEnabled ?? false}
              onChange={(e) => setSettings({ ...settings, alwaysThinkingEnabled: e.target.checked })}
            />
            <span>所有会话默认开启扩展思维 (alwaysThinkingEnabled)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.showThinkingSummaries ?? false}
              onChange={(e) => setSettings({ ...settings, showThinkingSummaries: e.target.checked })}
            />
            <span>在界面中显示思维摘要 (showThinkingSummaries)</span>
          </label>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          这些选项写入 ~/.claude/settings.json，影响所有会话
        </div>
      </div>

      {/* 自动记忆 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.autoMemoryEnabled ?? true}
            onChange={(e) => setSettings({ ...settings, autoMemoryEnabled: e.target.checked })}
          />
          <span style={{ fontWeight: 500 }}>自动记忆 (autoMemoryEnabled)</span>
        </label>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginLeft: 20 }}>
          开启时 Claude 会读取 CLAUDE.md 记忆文件；关闭时跳过记忆目录
        </div>
      </div>

      {/* 最大 Agentic 轮次 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          最大 Agentic 轮次 (--max-turns)
        </label>
        <input
          type="number"
          className="input"
          value={settings.maxTurns ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setSettings({ ...settings, maxTurns: isNaN(v) || v <= 0 ? undefined : v });
          }}
          placeholder="留空 = 不限制（默认）"
          min={1}
          max={999}
          style={{ fontSize: 12, width: 140 }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          对应 CLI --max-turns 参数，限制每次任务最多执行多少轮工具调用
        </div>
      </div>

      {/* 环境变量 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          环境变量 (env)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(settings.envVars ?? {}).map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                className="input"
                value={k}
                onChange={(e) => {
                  const entries = Object.entries(settings.envVars ?? {});
                  entries[i] = [e.target.value, entries[i][1]];
                  setSettings({ ...settings, envVars: Object.fromEntries(entries) });
                }}
                placeholder="KEY"
                style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>=</span>
              <input
                type="text"
                className="input"
                value={v}
                onChange={(e) => {
                  const entries = Object.entries(settings.envVars ?? {});
                  entries[i] = [entries[i][0], e.target.value];
                  setSettings({ ...settings, envVars: Object.fromEntries(entries) });
                }}
                placeholder="VALUE"
                style={{ fontSize: 11, fontFamily: 'monospace', flex: 2 }}
              />
              <button
                onClick={() => {
                  const entries = Object.entries(settings.envVars ?? {}).filter((_, j) => j !== i);
                  setSettings({ ...settings, envVars: Object.fromEntries(entries) });
                }}
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: '#ef4444', cursor: 'pointer', padding: '3px 7px', fontSize: 13, flexShrink: 0 }}
                title="移除"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const entries = Object.entries(settings.envVars ?? {});
              entries.push(['', '']);
              setSettings({ ...settings, envVars: Object.fromEntries(entries) });
            }}
            style={{
              background: 'none', border: '1px dashed var(--border-color)',
              borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
              padding: '4px 10px', fontSize: 12, textAlign: 'left',
            }}
          >
            + 添加变量
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          写入 settings.json env 字段，在每次 Claude 会话中注入环境变量
        </div>
      </div>
    </>
  );
}
