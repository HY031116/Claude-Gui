import { Cpu, Zap } from 'lucide-react';
import type { AppSettings } from '../../types';
import { MODEL_OPTIONS, EFFORT_LEVELS, CONFIG_PRESETS } from './constants';

interface ModelTabProps {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  availableAgents: Array<{ name: string; model: string; type: 'builtin' | 'custom' }>;
  applyPreset: (presetId: string) => void;
}

export function ModelTab({ settings, setSettings, availableAgents, applyPreset }: ModelTabProps) {
  return (
    <>
      {/* Quick Presets */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Zap size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          快速配置
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {CONFIG_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className="btn"
              style={{ fontSize: 11, padding: '6px 8px', justifyContent: 'center' }}
              onClick={() => applyPreset(preset.id)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Cpu size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          模型选择
        </label>
        <select
          className="input"
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          自定义模型
          <input
            type="text"
            className="input"
            value={settings.model === 'custom' || !MODEL_OPTIONS.some(m => m.value === settings.model) ? settings.model : ''}
            onChange={(e) => setSettings({ ...settings, model: e.target.value || 'sonnet' })}
            placeholder="输入模型名称..."
            style={{ fontSize: 11, padding: '4px 8px', marginTop: 4, width: '100%', fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* Effort Level */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Zap size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          努力程度 (Effort)
        </label>
        <select
          className="input"
          value={settings.effortLevel || 'medium'}
          onChange={(e) => setSettings({ ...settings, effortLevel: e.target.value as AppSettings['effortLevel'] })}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          {EFFORT_LEVELS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 响应语言 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          响应语言 (language)
        </label>
        <input
          type="text"
          className="input"
          value={settings.language ?? ''}
          onChange={(e) => setSettings({ ...settings, language: e.target.value || undefined })}
          placeholder="留空 = 默认，或填写 japanese / chinese / spanish / french"
          style={{ fontSize: 12 }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          对应 settings.json 中的 language 字段，Claude 将优先以该语言回复
        </div>
      </div>

      {/* Agent 选择 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
          <Cpu size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Agent
        </label>
        <select
          className="input"
          value={settings.agent || 'default'}
          onChange={(e) => setSettings({ ...settings, agent: e.target.value })}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          <option value="default">默认 (不指定)</option>
          {availableAgents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} · {a.model} {a.type === 'custom' ? '(自定义)' : ''}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          对应 CLI 参数 --agent，用于指定子代理策略
        </div>
      </div>
    </>
  );
}
