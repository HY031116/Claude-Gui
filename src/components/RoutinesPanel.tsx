/**
 * RoutinesPanel — 定时任务管理面板
 * v4.9.0 FEAT-411：在监控视图中管理 cron 驱动的自动化任务
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Play, Trash2, ToggleLeft, ToggleRight, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Routine } from '../types/electron';

// ─── cron 表达式预设 ──────────────────────────────────────────────────────────

const CRON_PRESETS: Array<{ label: string; value: string; desc: string }> = [
  { label: '每5分钟',    value: '*/5 * * * *',    desc: '每5分钟执行一次' },
  { label: '每小时',     value: '0 * * * *',      desc: '每小时整点执行' },
  { label: '每天早9点',  value: '0 9 * * *',      desc: '每天上午 9:00 执行' },
  { label: '每天晚6点',  value: '0 18 * * *',     desc: '每天下午 6:00 执行' },
  { label: '每周一早9点',value: '0 9 * * 1',      desc: '每周一上午 9:00 执行' },
  { label: '每月1日',    value: '0 9 1 * *',      desc: '每月1日上午 9:00 执行' },
  { label: '自定义',     value: '',               desc: '手动输入 cron 表达式' },
];

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function formatRelTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  if (hr < 24) return `${hr}小时前`;
  return `${day}天前`;
}

// ─── 创建/编辑表单 ─────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  prompt: string;
  cwd: string;
  cronExpr: string;
  cronPreset: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  prompt: '',
  cwd: '',
  cronExpr: '0 9 * * *',
  cronPreset: '0 9 * * *',
  enabled: true,
};

interface RoutineFormProps {
  initial?: Routine;
  onSave: (data: Omit<Routine, 'id' | 'createdAt' | 'history'>) => Promise<void>;
  onCancel: () => void;
}

function RoutineForm({ initial, onSave, onCancel }: RoutineFormProps) {
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name,
          prompt: initial.prompt,
          cwd: initial.cwd,
          cronExpr: initial.cronExpr,
          cronPreset: CRON_PRESETS.some((p) => p.value === initial.cronExpr) ? initial.cronExpr : '',
          enabled: initial.enabled,
        }
      : { ...EMPTY_FORM },
  );
  const [cronError, setCronError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** 验证 cron 表达式 */
  const validateCron = useCallback(async (expr: string) => {
    if (!expr.trim()) { setCronError('请输入 cron 表达式'); return false; }
    try {
      const result = await window.electronAPI.routinesValidateCron?.(expr);
      if (!result?.valid) { setCronError('cron 表达式格式错误'); return false; }
      setCronError(null);
      return true;
    } catch {
      setCronError(null); // 非 Electron 环境跳过验证
      return true;
    }
  }, []);

  const handlePresetChange = (val: string) => {
    setForm((f) => ({ ...f, cronPreset: val, cronExpr: val || f.cronExpr }));
    if (val) { setCronError(null); }
  };

  const handleCronExprChange = (val: string) => {
    setForm((f) => ({ ...f, cronExpr: val, cronPreset: '' }));
    setCronError(null);
  };

  const handleSelectDir = useCallback(async () => {
    try {
      const result = await window.electronAPI.selectDirectory?.();
      if (result?.path) setForm((f) => ({ ...f, cwd: result.path! }));
    } catch { /* 非 Electron 环境忽略 */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.prompt.trim()) return;
    const valid = await validateCron(form.cronExpr);
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        prompt: form.prompt.trim(),
        cwd: form.cwd.trim(),
        cronExpr: form.cronExpr.trim(),
        enabled: form.enabled,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="routine-form" onSubmit={handleSubmit}>
      <div className="routine-form-field">
        <label>任务名称 <span style={{ color: 'var(--error, #ef4444)' }}>*</span></label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="例如：每日代码审查"
          required
        />
      </div>

      <div className="routine-form-field">
        <label>任务提示词 <span style={{ color: 'var(--error, #ef4444)' }}>*</span></label>
        <textarea
          className="input"
          style={{ minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }}
          value={form.prompt}
          onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
          placeholder="例如：检查项目中的 TODO 注释，整理成报告"
          required
        />
      </div>

      <div className="routine-form-field">
        <label>工作目录</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={form.cwd}
            onChange={(e) => setForm((f) => ({ ...f, cwd: e.target.value }))}
            placeholder="留空则使用当前项目目录"
          />
          <button type="button" className="btn-outline" style={{ whiteSpace: 'nowrap' }} onClick={handleSelectDir}>
            选择…
          </button>
        </div>
      </div>

      <div className="routine-form-field">
        <label>执行频率</label>
        <select
          className="input"
          value={form.cronPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          {CRON_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label} {p.value ? `(${p.value})` : ''}</option>
          ))}
        </select>
        {(!form.cronPreset || form.cronPreset === '') && (
          <input
            className="input"
            style={{ marginTop: 6, fontFamily: 'monospace' }}
            value={form.cronExpr}
            onChange={(e) => handleCronExprChange(e.target.value)}
            onBlur={() => validateCron(form.cronExpr)}
            placeholder="例如：0 9 * * 1 （每周一9点）"
          />
        )}
        {cronError && <span style={{ fontSize: 11, color: 'var(--error, #ef4444)' }}>{cronError}</span>}
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          cron 格式：分 时 日 月 周（0-59 0-23 1-31 1-12 0-7）
        </span>
      </div>

      <div className="routine-form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <label style={{ margin: 0 }}>创建后立即启用</label>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.enabled ? 'var(--accent)' : 'var(--text-tertiary)', display: 'flex' }}
        >
          {form.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" className="btn-outline" onClick={onCancel}>取消</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? '保存中…' : (initial ? '保存修改' : '创建任务')}
        </button>
      </div>
    </form>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export function RoutinesPanel() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  /** 加载任务列表 */
  const loadRoutines = useCallback(async () => {
    try {
      const list = await window.electronAPI.routinesList?.() ?? [];
      setRoutines(list);
    } catch {
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutines();
    // 订阅任务执行完成后的更新推送
    const unsub = window.electronAPI.onRoutinesUpdated?.((updated) => setRoutines(updated));
    return () => unsub?.();
  }, [loadRoutines]);

  const handleCreate = async (data: Omit<Routine, 'id' | 'createdAt' | 'history'>) => {
    const result = await window.electronAPI.routinesCreate?.(data);
    if (result?.success && result.routine) {
      setRoutines((prev) => [...prev, result.routine!]);
      setShowForm(false);
    }
  };

  const handleUpdate = async (id: string, data: Omit<Routine, 'id' | 'createdAt' | 'history'>) => {
    const result = await window.electronAPI.routinesUpdate?.(id, data);
    if (result?.success && result.routine) {
      setRoutines((prev) => prev.map((r) => (r.id === id ? result.routine! : r)));
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除此定时任务？')) return;
    await window.electronAPI.routinesDelete?.(id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggle = async (routine: Routine) => {
    const result = await window.electronAPI.routinesUpdate?.(routine.id, { enabled: !routine.enabled });
    if (result?.success && result.routine) {
      setRoutines((prev) => prev.map((r) => (r.id === routine.id ? result.routine! : r)));
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      await window.electronAPI.routinesRunNow?.(id);
    } finally {
      // 短暂延迟后恢复，等待历史更新推送
      setTimeout(() => setRunningId(null), 1500);
    }
  };

  if (loading) {
    return (
      <div className="routines-panel" style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
        加载中…
      </div>
    );
  }

  return (
    <div className="routines-panel">
      {/* 头部工具栏 */}
      <div className="routines-toolbar">
        <span style={{ fontSize: 13, fontWeight: 600 }}>定时任务</span>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          onClick={() => { setShowForm(true); setEditingId(null); }}
          disabled={showForm}
        >
          <Plus size={13} />
          新建任务
        </button>
      </div>

      {/* 创建表单 */}
      {showForm && (
        <div className="routine-form-card">
          <div className="routine-form-title">新建定时任务</div>
          <RoutineForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* 空状态 */}
      {routines.length === 0 && !showForm && (
        <div className="empty-state-card" style={{ margin: '16px 0' }}>
          <Clock size={28} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
          <p>还没有定时任务</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            创建后，任务将在设定时间自动调用 Claude 完成指定工作
          </p>
          <button
            className="btn-primary"
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowForm(true)}
          >
            <Plus size={13} />
            创建第一个任务
          </button>
        </div>
      )}

      {/* 任务列表 */}
      <div className="routines-list">
        {routines.map((routine) => (
          <div key={routine.id} className={`routine-item${routine.enabled ? ' routine-item--active' : ''}`}>
            {editingId === routine.id ? (
              <div className="routine-form-card">
                <div className="routine-form-title">编辑任务</div>
                <RoutineForm
                  initial={routine}
                  onSave={(data) => handleUpdate(routine.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <>
                {/* 任务行 */}
                <div className="routine-row">
                  {/* 开关 */}
                  <button
                    className="routine-toggle-btn"
                    onClick={() => handleToggle(routine)}
                    title={routine.enabled ? '点击禁用' : '点击启用'}
                  >
                    {routine.enabled
                      ? <ToggleRight size={20} style={{ color: 'var(--accent)' }} />
                      : <ToggleLeft size={20} style={{ color: 'var(--text-tertiary)' }} />}
                  </button>

                  {/* 名称 + 时间 */}
                  <div className="routine-info" onClick={() => setExpandedId((prev) => prev === routine.id ? null : routine.id)} style={{ cursor: 'pointer', flex: 1 }}>
                    <div className="routine-name">{routine.name}</div>
                    <div className="routine-meta">
                      <Clock size={11} />
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{routine.cronExpr}</span>
                      {routine.lastRunAt && (
                        <span>· 上次执行 {formatRelTime(routine.lastRunAt)}</span>
                      )}
                      {!routine.enabled && <span style={{ color: 'var(--text-tertiary)' }}>· 已暂停</span>}
                    </div>
                  </div>

                  {/* 操作 */}
                  <div className="routine-actions">
                    <button
                      className="cc-action-btn"
                      onClick={() => handleRunNow(routine.id)}
                      disabled={runningId === routine.id}
                      title="立即执行一次"
                    >
                      <Play size={12} />
                    </button>
                    <button
                      className="cc-action-btn"
                      onClick={() => setEditingId(routine.id)}
                      title="编辑"
                    >
                      <span style={{ fontSize: 11 }}>✏</span>
                    </button>
                    <button
                      className="cc-action-btn"
                      onClick={() => handleDelete(routine.id)}
                      title="删除"
                      style={{ color: 'var(--error, #ef4444)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                    <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                      {expandedId === routine.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  </div>
                </div>

                {/* 展开：提示词预览 + 执行历史 */}
                {expandedId === routine.id && (
                  <div className="routine-detail">
                    <div className="routine-prompt-preview">
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>提示词：</span>
                      <span style={{ fontSize: 12 }}>{routine.prompt.length > 120 ? routine.prompt.slice(0, 120) + '…' : routine.prompt}</span>
                    </div>
                    {routine.cwd && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        工作目录：{routine.cwd}
                      </div>
                    )}
                    {routine.history.length > 0 && (
                      <div className="routine-history">
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          最近执行记录
                        </div>
                        {routine.history.slice(0, 5).map((entry, i) => (
                          <div key={i} className="routine-history-entry">
                            {entry.success
                              ? <CheckCircle size={11} style={{ color: 'var(--success, #10b981)', flexShrink: 0 }} />
                              : <XCircle size={11} style={{ color: 'var(--error, #ef4444)', flexShrink: 0 }} />}
                            <span>{formatRelTime(entry.runAt)}</span>
                            {entry.error && <span style={{ color: 'var(--error, #ef4444)', fontSize: 11 }}>· {entry.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {routine.history.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>尚无执行记录</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
