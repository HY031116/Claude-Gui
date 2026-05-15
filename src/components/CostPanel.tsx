import { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { DollarSign, Trash2, ChevronDown, ChevronUp, Clock, FolderOpen } from 'lucide-react';
import type { TokenRecord } from '../types';

// ─── 工具函数 ──────────────────────────────────────────────────────────────

/** 格式化 USD 金额 */
function formatCost(usd?: number): string {
  if (usd == null) return '—';
  if (usd < 0.0001) return '<$0.0001';
  return `$${usd.toFixed(4)}`;
}

/** 格式化 token 数量 */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** 格式化日期时间 */
function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** 格式化日期（仅日期） */
function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

/** 获取过去 N 天的零点时间戳 */
function getDayStart(daysAgo: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}

/** 按天聚合成本 */
interface DayCost { label: string; costUsd: number; count: number; }

function aggregateByDay(records: TokenRecord[], days: number): DayCost[] {
  const result: DayCost[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = getDayStart(i);
    const end = getDayStart(i - 1);
    const dayRecords = records.filter((r) => r.timestamp >= start && r.timestamp < end);
    result.push({
      label: formatDate(start),
      costUsd: dayRecords.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
      count: dayRecords.length,
    });
  }
  return result;
}

// ─── 子组件：7 天成本柱状图（纯 CSS）────────────────────────────────────────

function CostChart({ data }: { data: DayCost[] }) {
  const maxCost = Math.max(...data.map((d) => d.costUsd), 0.0001);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, padding: '0 4px' }}>
      {data.map((d, i) => {
        const pct = Math.max((d.costUsd / maxCost) * 100, d.count > 0 ? 4 : 0);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 2 }} title={`${d.label}: ${formatCost(d.costUsd)} (${d.count} 次)`}>
            <div style={{ width: '100%', background: 'var(--accent)', borderRadius: '3px 3px 0 0', height: `${pct}%`, minHeight: d.count > 0 ? 3 : 0, opacity: 0.85 }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 子组件：单条记录详情 ───────────────────────────────────────────────────

function RecordRow({ record }: { record: TokenRecord }) {
  const [expanded, setExpanded] = useState(false);
  const totalTokens = record.inputTokens + record.outputTokens;

  return (
    <div style={{ borderBottom: '1px solid var(--border-color)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 90 }}>{formatDateTime(record.timestamp)}</span>
        <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.workingDirectory}>
          {record.workingDirectory ? record.workingDirectory.split(/[\\/]/).pop() : '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, width: 60, textAlign: 'right' }}>
          {formatTokens(totalTokens)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: record.costUsd ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, width: 64, textAlign: 'right' }}>
          {formatCost(record.costUsd)}
        </span>
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </div>
      {expanded && (
        <div style={{ padding: '4px 24px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
          <span>输入 tokens：<strong style={{ color: 'var(--text-primary)' }}>{record.inputTokens.toLocaleString()}</strong></span>
          <span>输出 tokens：<strong style={{ color: 'var(--text-primary)' }}>{record.outputTokens.toLocaleString()}</strong></span>
          <span>模型：<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{record.model ?? '—'}</span></span>
          <span>Session ID：<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{record.sessionId?.slice(0, 12) ?? '—'}</span></span>
          <span style={{ gridColumn: '1 / -1' }}>工作目录：<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{record.workingDirectory ?? '—'}</span></span>
        </div>
      )}
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

/** 按模型聚合 */
interface ModelStat { model: string; count: number; inputTokens: number; outputTokens: number; costUsd: number; }

function aggregateByModel(records: TokenRecord[]): ModelStat[] {
  const map = new Map<string, ModelStat>();
  for (const r of records) {
    const key = r.model || '未知模型';
    const prev = map.get(key) ?? { model: key, count: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    map.set(key, { ...prev, count: prev.count + 1, inputTokens: prev.inputTokens + r.inputTokens, outputTokens: prev.outputTokens + r.outputTokens, costUsd: prev.costUsd + (r.costUsd ?? 0) });
  }
  return [...map.values()].sort((a, b) => b.costUsd - a.costUsd);
}

/** 按工作目录聚合（Top N） */
interface ProjectStat { dir: string; displayName: string; count: number; costUsd: number; }

function aggregateByProject(records: TokenRecord[], topN = 5): ProjectStat[] {
  const map = new Map<string, ProjectStat>();
  for (const r of records) {
    const key = r.workingDirectory || '未知项目';
    const displayName = key === '未知项目' ? key : (key.replace(/[\\/]+$/, '').replace(/.*[\\/]/, '') || key);
    const prev = map.get(key) ?? { dir: key, displayName, count: 0, costUsd: 0 };
    map.set(key, { ...prev, count: prev.count + 1, costUsd: prev.costUsd + (r.costUsd ?? 0) });
  }
  return [...map.values()].sort((a, b) => b.costUsd - a.costUsd).slice(0, topN);
}

export function CostPanel() {
  const tokenHistory = useAppStore((s) => s.tokenHistory);
  const clearTokenHistory = useAppStore((s) => s.clearTokenHistory);
  const [showClear, setShowClear] = useState(false);
  const [pageSize] = useState(50);
  const [page, setPage] = useState(0);
  /** 趋势图时间范围（天） */
  const [chartDays, setChartDays] = useState<7 | 14 | 30>(7);

  // 汇总统计
  const todayStart = getDayStart(0);
  const totalCost = tokenHistory.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  const todayCost = tokenHistory.filter((r) => r.timestamp >= todayStart).reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  const totalInputTokens = tokenHistory.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = tokenHistory.reduce((sum, r) => sum + r.outputTokens, 0);

  // 趋势图数据（按选定天数聚合）
  const chartData = aggregateByDay(tokenHistory, chartDays);

  // 分页
  const totalPages = Math.ceil(tokenHistory.length / pageSize);
  const pageRecords = tokenHistory.slice(page * pageSize, (page + 1) * pageSize);

  /** 时间范围选择按钮 */
  const rangeBtn = (d: 7 | 14 | 30, label: string) => (
    <button
      key={d}
      onClick={() => setChartDays(d)}
      style={{
        padding: '2px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
        background: chartDays === d ? 'var(--accent)' : 'var(--bg-tertiary)',
        color: chartDays === d ? '#fff' : 'var(--text-secondary)',
        fontWeight: chartDays === d ? 600 : 400,
        transition: 'background 0.15s',
      }}
    >{label}</button>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶部工具栏 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'var(--bg-secondary)' }}>
        <DollarSign size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Token 成本追踪</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>共 {tokenHistory.length} 条记录</span>
        {showClear ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={() => setShowClear(false)} style={{ fontSize: 11 }}>取消</button>
            <button className="btn" onClick={() => { clearTokenHistory(); setShowClear(false); }} style={{ fontSize: 11, color: '#ef4444' }}>确认清空</button>
          </div>
        ) : (
          <button className="btn" onClick={() => setShowClear(true)} title="清空历史记录" style={{ fontSize: 11, opacity: 0.7 }}>
            <Trash2 size={12} /> 清空
          </button>
        )}
      </div>

      {/* 内容区（可滚动） */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tokenHistory.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            暂无记录。完成一次对话后，成本数据将自动保存。
          </div>
        ) : (
          <>
            {/* 汇总卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 16 }}>
              {[
                { label: '今日成本', value: formatCost(todayCost), sub: `${tokenHistory.filter(r => r.timestamp >= todayStart).length} 次对话` },
                { label: '累计总成本', value: formatCost(totalCost), sub: `${tokenHistory.length} 次对话` },
                { label: '累计输入 tokens', value: formatTokens(totalInputTokens), sub: '输入' },
                { label: '累计输出 tokens', value: formatTokens(totalOutputTokens), sub: '输出' },
              ].map(({ label, value, sub }) => (
                <div key={label} style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* 趋势柱状图（含时间范围切换） */}
            <div style={{ margin: '0 16px 16px', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <Clock size={12} style={{ color: 'var(--text-muted)', marginRight: 5 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, flex: 1 }}>成本趋势</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {rangeBtn(7, '7天')}{rangeBtn(14, '14天')}{rangeBtn(30, '30天')}
                </div>
              </div>
              <CostChart data={chartData} />
            </div>

            {/* 按模型统计 */}
            {(() => {
              const modelStats = aggregateByModel(tokenHistory);
              if (modelStats.length === 0) return null;
              const maxModelCost = Math.max(...modelStats.map((m) => m.costUsd), 0.0001);
              return (
                <div style={{ margin: '0 16px 16px', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, fontWeight: 500 }}>按模型统计</div>
                  {modelStats.map((m) => (
                    <div key={m.model} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{m.model}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{m.count} 次 · {formatTokens(m.inputTokens + m.outputTokens)} tokens · <strong style={{ color: 'var(--accent)' }}>{formatCost(m.costUsd)}</strong></span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--accent)', width: `${(m.costUsd / maxModelCost) * 100}%`, borderRadius: 3, opacity: 0.8 }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 按项目统计（Top 5） */}
            {(() => {
              const projectStats = aggregateByProject(tokenHistory, 5);
              if (projectStats.length === 0) return null;
              const maxProjCost = Math.max(...projectStats.map((p) => p.costUsd), 0.0001);
              return (
                <div style={{ margin: '0 16px 16px', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <FolderOpen size={12} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>按项目统计（Top 5）</span>
                  </div>
                  {projectStats.map((p) => (
                    <div key={p.dir} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }} title={p.dir}>{p.displayName}</span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{p.count} 次 · <strong style={{ color: 'var(--accent)' }}>{formatCost(p.costUsd)}</strong></span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-light) 100%)', width: `${(p.costUsd / maxProjCost) * 100}%`, borderRadius: 3, opacity: 0.75 }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 历史记录表头 */}
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              <span style={{ width: 90, flexShrink: 0 }}>时间</span>
              <span style={{ flex: 1 }}>项目</span>
              <span style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>Tokens</span>
              <span style={{ width: 64, textAlign: 'right', flexShrink: 0 }}>费用</span>
              <span style={{ width: 13, flexShrink: 0 }} />
            </div>

            {/* 记录列表 */}
            {pageRecords.map((r) => <RecordRow key={r.id} record={r} />)}

            {/* 分页 */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)} style={{ padding: '2px 10px' }}>上一页</button>
                <span style={{ lineHeight: '24px' }}>{page + 1} / {totalPages}</span>
                <button className="btn" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} style={{ padding: '2px 10px' }}>下一页</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
