/**
 * ArtifactsView — 产物视图
 * 展示：AI 产物 + Git 操作 + 文件浏览 + 历史会话 + 成本统计
 * 顶部概览栏汇总当前会话关键指标
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { GitBranch, FolderOpen, Clock, DollarSign, Cpu, FileText, RefreshCw, CheckSquare, History } from 'lucide-react';
import { GitPanel } from '../GitPanel';
import { FileExplorer } from '../FileExplorer';
import { HistoryPanel } from '../HistoryPanel';
import { CostPanel } from '../CostPanel';
import { useAppStore } from '../../stores/useAppStore';
import type { ToolCall } from '../../types';

/** 格式化日期时间为 M/D HH:MM */
function fmtTs(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type ArtifactsTab = 'ai' | 'git' | 'files' | 'history' | 'cost' | 'changes';

// ─── 工具名集合 ────────────────────────────────────────────────────────────────

const FILE_WRITE_TOOLS = new Set(['Write', 'write_file']);
const FILE_EDIT_TOOLS = new Set([
  'Edit', 'edit_file', 'str_replace_editor', 'str_replace_based_edit_tool', 'MultiEdit', 'multiedit',
]);
const FILE_MODIFY_TOOLS = new Set([...FILE_WRITE_TOOLS, ...FILE_EDIT_TOOLS]);

/** 从 tool call 参数里提取文件路径 */
function extractFilePath(tc: ToolCall): string | null {
  const a = tc.arguments;
  return (a.path ?? a.file_path ?? a.filePath ?? null) as string | null;
}

/** 取路径中文件名部分 */
function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

/** 格式化 USD */
function fmtCost(v?: number | null): string {
  if (v == null) return '—';
  if (v < 0.0001) return '<$0.0001';
  return `$${v.toFixed(4)}`;
}

// ─── AI 产物面板 ───────────────────────────────────────────────────────────────

interface AiFileRecord {
  path: string;
  editCount: number;
  writeCount: number;
  hasReverted: boolean;
  hasAccepted: boolean;
}

function AiArtifactsPanel({ onGoGit }: { onGoGit: () => void }) {
  const messages = useAppStore((s) => s.messages);
  const session = useAppStore((s) => s.session);
  const cwd = session.workingDirectory;

  const [stagingPath, setStagingPath] = useState<string | null>(null);
  const [stageResults, setStageResults] = useState<Record<string, boolean>>({});
  const [batchStaging, setBatchStaging] = useState(false);
  const [batchResult, setBatchResult] = useState<{ ok: number; fail: number } | null>(null);

  // 聚合当前会话中所有被 AI 修改的文件
  const aiFiles = useMemo<AiFileRecord[]>(() => {
    const map = new Map<string, AiFileRecord>();
    for (const msg of messages) {
      for (const tc of msg.toolCalls ?? []) {
        if (!FILE_MODIFY_TOOLS.has(tc.name) || tc.status !== 'success') continue;
        const path = extractFilePath(tc);
        if (!path) continue;
        const existing = map.get(path) ?? {
          path,
          editCount: 0,
          writeCount: 0,
          hasReverted: false,
          hasAccepted: false,
        };
        if (FILE_WRITE_TOOLS.has(tc.name)) existing.writeCount++;
        else existing.editCount++;
        if (tc.diffReviewStatus === 'accepted') existing.hasAccepted = true;
        if (tc.diffReviewStatus === 'reverted') existing.hasReverted = true;
        map.set(path, existing);
      }
    }
    return [...map.values()];
  }, [messages]);

  const stageFile = useCallback(async (filePath: string) => {
    if (!cwd || stagingPath) return;
    setStagingPath(filePath);
    try {
      const r = await window.electronAPI.gitAdd(cwd, [filePath]);
      setStageResults((prev) => ({ ...prev, [filePath]: r.success }));
    } catch {
      setStageResults((prev) => ({ ...prev, [filePath]: false }));
    } finally {
      setStagingPath(null);
    }
  }, [cwd, stagingPath]);

  /** 批量暂存：只暂存未回滚且尚未成功暂存的文件 */
  const stageAll = useCallback(async () => {
    if (!cwd || batchStaging) return;
    const targets = aiFiles.filter(
      (f) => !f.hasReverted && stageResults[f.path] !== true,
    );
    if (!targets.length) return;
    setBatchStaging(true);
    setBatchResult(null);
    let ok = 0; let fail = 0;
    try {
      const paths = targets.map((f) => f.path);
      const r = await window.electronAPI.gitAdd(cwd, paths);
      if (r.success) {
        ok = paths.length;
        setStageResults((prev) => {
          const next = { ...prev };
          paths.forEach((p) => { next[p] = true; });
          return next;
        });
      } else {
        // 逐个尝试
        for (const f of targets) {
          try {
            const fr = await window.electronAPI.gitAdd(cwd, [f.path]);
            setStageResults((prev) => ({ ...prev, [f.path]: fr.success }));
            if (fr.success) ok++; else fail++;
          } catch {
            setStageResults((prev) => ({ ...prev, [f.path]: false }));
            fail++;
          }
        }
      }
    } catch {
      fail = targets.length;
    } finally {
      setBatchStaging(false);
      setBatchResult({ ok, fail });
    }
  }, [cwd, batchStaging, aiFiles, stageResults]);

  if (!session.isConnected && aiFiles.length === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
        <Cpu size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
        <div>当前无活跃会话</div>
        <div style={{ fontSize: 11, marginTop: 4, marginBottom: 12 }}>启动 Claude 会话后，这里将汇总所有 AI 修改的文件</div>
        <button
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '5px 14px' }}
          onClick={() => useAppStore.getState().setActiveNavSection('dispatch')}
        >
          前往委派，启动会话
        </button>
      </div>
    );
  }

  if (aiFiles.length === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
        <FileText size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
        <div style={{ marginBottom: 12 }}>本次会话暂无文件修改记录</div>
        <button
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '5px 14px' }}
          onClick={() => useAppStore.getState().setActiveNavSection('dispatch')}
        >
          前往委派，新建任务
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 汇总行 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0,
        flexWrap: 'wrap', rowGap: 6,
      }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{aiFiles.length} 个文件</span>
        <span>·</span>
        <span>{aiFiles.reduce((s, f) => s + f.writeCount, 0)} 次写入</span>
        <span>·</span>
        <span>{aiFiles.reduce((s, f) => s + f.editCount, 0)} 次编辑</span>
        {batchResult && (
          <span style={{
            fontSize: 11,
            color: batchResult.fail > 0 ? '#ef4444' : '#22c55e',
          }}>
            {batchResult.fail > 0
              ? `✓ ${batchResult.ok} 成功  ✗ ${batchResult.fail} 失败`
              : `✓ 全部 ${batchResult.ok} 个已暂存`}
          </span>
        )}
        {/* 全部暂存按钮 */}
        {cwd && aiFiles.some((f) => !f.hasReverted && stageResults[f.path] !== true) && (
          <button
            onClick={stageAll}
            disabled={batchStaging || !!stagingPath}
            style={{
              marginLeft: 'auto', fontSize: 11,
              background: 'var(--accent, #6366f1)',
              border: 'none', borderRadius: 4,
              padding: '3px 10px', cursor: batchStaging ? 'default' : 'pointer',
              color: '#fff', display: 'flex', alignItems: 'center', gap: 4,
              opacity: batchStaging ? 0.7 : 1,
            }}
          >
            {batchStaging
              ? <><RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> 暂存中…</>
              : <><CheckSquare size={10} /> 全部暂存</>}
          </button>
        )}
        {/* 全部暂存后显示前往 Git 按钮 */}
        {(!cwd || !aiFiles.some((f) => !f.hasReverted && stageResults[f.path] !== true)) && (
          <button
            onClick={onGoGit}
            style={{
              marginLeft: 'auto', fontSize: 11,
              background: 'none', border: '1px solid var(--border-color)',
              borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
              color: 'var(--accent, #6366f1)', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <GitBranch size={10} />
            前往 Git 提交
          </button>
        )}
      </div>

      {/* 文件列表 */}
      <div style={{ overflow: 'auto', flex: 1, padding: '4px 0' }}>
        {aiFiles.map((file) => {
          const staged = stageResults[file.path] === true;
          const stageFailed = stageResults[file.path] === false;
          const isStaging = stagingPath === file.path;
          return (
            <div
              key={file.path}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: staged ? 'rgba(34,197,94,0.04)' : 'transparent',
              }}
            >
              {/* 文件图标 + 路径 */}
              <FileText size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: file.hasReverted ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: file.hasReverted ? 'line-through' : 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                  title={file.path}
                >
                  {basename(file.path)}
                </div>
                <div style={{
                  fontSize: 10, color: 'var(--text-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                  title={file.path}
                >
                  {file.path}
                </div>
              </div>

              {/* 操作计数徽章 */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {file.writeCount > 0 && (
                  <span style={{
                    fontSize: 10, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                    border: '1px solid rgba(34,197,94,0.3)',
                  }}>
                    写入×{file.writeCount}
                  </span>
                )}
                {file.editCount > 0 && (
                  <span style={{
                    fontSize: 10, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(99,102,241,0.15)', color: 'var(--accent, #6366f1)',
                    border: '1px solid rgba(99,102,241,0.3)',
                  }}>
                    编辑×{file.editCount}
                  </span>
                )}
                {file.hasReverted && (
                  <span style={{
                    fontSize: 10, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(156,163,175,0.2)', color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                  }}>
                    已回滚
                  </span>
                )}
                {file.hasAccepted && (
                  <span style={{
                    fontSize: 10, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                    border: '1px solid rgba(34,197,94,0.3)',
                  }}>
                    已确认
                  </span>
                )}
              </div>

              {/* 暂存按钮 */}
              {cwd && !file.hasReverted && (
                <button
                  onClick={() => stageFile(file.path)}
                  disabled={isStaging || staged}
                  title={staged ? '已暂存到 Git' : stageFailed ? '暂存失败，请在 Git 面板操作' : '暂存到 Git'}
                  style={{
                    background: staged ? 'rgba(34,197,94,0.15)' : 'none',
                    border: `1px solid ${staged ? 'rgba(34,197,94,0.4)' : 'var(--border-color)'}`,
                    borderRadius: 4, padding: '2px 7px', cursor: staged ? 'default' : 'pointer',
                    fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                    color: staged ? '#22c55e' : stageFailed ? '#ef4444' : 'var(--text-secondary)',
                    opacity: isStaging ? 0.5 : 1,
                  }}
                >
                  {isStaging ? (
                    <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : staged ? (
                    <CheckSquare size={10} />
                  ) : (
                    <GitBranch size={10} />
                  )}
                  {staged ? '已暂存' : stageFailed ? '失败' : '暂存'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 概览指标条 ────────────────────────────────────────────────────────────────

function OverviewBar({ aiFileCount, onGoGit }: { aiFileCount: number; onGoGit: () => void }) {
  const session = useAppStore((s) => s.session);
  const tokenHistory = useAppStore((s) => s.tokenHistory);
  const conversationHistoryLen = useAppStore((s) => s.conversationHistory.length);
  const cwd = session.workingDirectory;

  const [gitInfo, setGitInfo] = useState<{ branch: string; staged: number; unstaged: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const todayCost = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return tokenHistory
      .filter((r) => r.timestamp >= start.getTime())
      .reduce((s, r) => s + (r.costUsd ?? 0), 0);
  }, [tokenHistory]);

  const refresh = useCallback(async () => {
    if (!cwd) return;
    setLoading(true);
    try {
      const r = await window.electronAPI.gitIsRepo(cwd);
      if (!r.isRepo) { setGitInfo(null); return; }
      const s = await window.electronAPI.gitStatus(cwd);
      if (s.success && s.status) {
        setGitInfo({
          branch: s.status.branch,
          staged: s.status.staged.length,
          unstaged: s.status.unstaged.length + s.status.untracked.length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ flexShrink: 0 }}>
      {/* 页面标题行 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>产出汇总</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· 累计 Claude 操作文件与历史记录</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderBottom: '1px solid var(--border-color)',
      }}>
      {/* AI 产物 */}
      <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>AI 产物</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: aiFileCount > 0 ? 'var(--accent, #6366f1)' : 'var(--text-primary)' }}>
          {aiFileCount}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>文件修改</div>
      </div>

      {/* Git 暂存 */}
      <div
        style={{ padding: '10px 14px', borderRight: '1px solid var(--border-color)', cursor: gitInfo ? 'pointer' : 'default' }}
        onClick={gitInfo ? onGoGit : undefined}
        title={gitInfo ? '点击查看 Git 面板' : undefined}
      >
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Git 状态</span>
          <button
            onClick={(e) => { e.stopPropagation(); refresh(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}
          >
            <RefreshCw size={9} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
        {gitInfo ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <GitBranch size={10} />
              {gitInfo.branch}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              暂存 {gitInfo.staged} · 未暂存 {gitInfo.unstaged}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {cwd ? '非 Git 仓库' : '未选目录'}
          </div>
        )}
      </div>

      {/* 今日成本 */}
      <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>今日成本</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          {fmtCost(todayCost)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>累计 {fmtCost(tokenHistory.reduce((s, r) => s + (r.costUsd ?? 0), 0))}</div>
      </div>

      {/* 历史会话 */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>历史会话</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          {conversationHistoryLen}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>总记录数</div>
      </div>
      </div>
    </div>
  );
}

// ─── 主视图 ────────────────────────────────────────────────────────────────────

export function ArtifactsView() {
  const [activeTab, setActiveTab] = useState<ArtifactsTab>('ai');
  const messages = useAppStore((s) => s.messages);

  const aiFileCount = useMemo(() => {
    const paths = new Set<string>();
    for (const msg of messages) {
      for (const tc of msg.toolCalls ?? []) {
        if (!FILE_MODIFY_TOOLS.has(tc.name) || tc.status !== 'success') continue;
        const path = extractFilePath(tc);
        if (path) paths.add(path);
      }
    }
    return paths.size;
  }, [messages]);

  const goGit = useCallback(() => setActiveTab('git'), []);

  const tabs: { id: ArtifactsTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'ai', label: 'AI 产物', icon: Cpu, badge: aiFileCount || undefined },
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'files', label: '文件', icon: FolderOpen },
    { id: 'history', label: '历史', icon: Clock },
    { id: 'changes', label: '变更历史', icon: History },
    { id: 'cost', label: '成本', icon: DollarSign },
  ];

  return (
    <div className="full-view">
      {/* 概览栏 */}
      <OverviewBar aiFileCount={aiFileCount} onGoGit={goGit} />

      {/* Tab 导航 */}
      <div className="view-tab-bar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`view-tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ position: 'relative' }}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  background: 'var(--accent, #6366f1)', color: '#fff',
                  borderRadius: 8, fontSize: 9, fontWeight: 700,
                  padding: '0 4px', lineHeight: '14px', minWidth: 14,
                  textAlign: 'center',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="full-view-content">
        {activeTab === 'ai' && <AiArtifactsPanel onGoGit={goGit} />}
        {activeTab === 'git' && <GitPanel />}
        {activeTab === 'files' && <FileExplorer />}
        {activeTab === 'history' && <HistoryPanel />}
        {activeTab === 'changes' && <ChangeHistoryPanel />}
        {activeTab === 'cost' && <CostPanel />}
      </div>
    </div>
  );
}

// ─── 变更历史面板（FEAT-513）────────────────────────────────────────────────────

/** 一个「任务批次」= 同一条 assistant 消息内的所有文件修改记录 */
interface ChangeGroup {
  msgIdx: number;
  timestamp: number;
  files: { path: string; op: string; bytes: number }[];
}

function ChangeHistoryPanel() {
  const messages = useAppStore((s) => s.messages);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const groups = useMemo<ChangeGroup[]>(() => {
    const result: ChangeGroup[] = [];
    messages.forEach((msg, msgIdx) => {
      const files: ChangeGroup['files'] = [];
      (msg.toolCalls ?? []).forEach((tc) => {
        if (!FILE_MODIFY_TOOLS.has(tc.name) || tc.status !== 'success') return;
        const path = extractFilePath(tc);
        if (!path) return;
        const content = (tc.arguments?.content as string | undefined) ?? '';
        files.push({
          path,
          op: FILE_WRITE_TOOLS.has(tc.name) ? '写入' : '编辑',
          bytes: content.length,
        });
      });
      if (files.length > 0) {
        result.push({
          msgIdx,
          timestamp: msg.timestamp,
          files,
        });
      }
    });
    return result.reverse();
  }, [messages]);

  const toggle = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 10,
        color: 'var(--text-muted)', fontSize: 13,
      }}>
        <History size={28} />
        <div>暂无文件变更记录</div>
        <div style={{ fontSize: 11 }}>Claude 修改文件后，变更历史将按任务批次聚合显示</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 标题栏 */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border-color)',
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <History size={14} color="var(--accent-color)" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>变更历史（{groups.length} 批次）</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          共 {groups.reduce((s, g) => s + g.files.length, 0)} 个文件操作
        </span>
      </div>

      {/* 列表 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.map((g, i) => {
          const isOpen = expanded.has(g.msgIdx);
          // 按文件去重，只保留最后一次操作
          const uniqueFiles = Array.from(
            new Map(g.files.map(f => [f.path, f])).values()
          );
          return (
            <div key={g.msgIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {/* 任务卡片标题行 */}
              <div
                onClick={() => toggle(g.msgIdx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 14px', cursor: 'pointer',
                  background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                }}
              >
                {/* 序号圆点 */}
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'var(--text-muted)',
                }}>
                  {groups.length - i}
                </div>
                {/* 时间 */}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                  {fmtTs(g.timestamp)}
                </span>
                {/* 文件数摘要 */}
                <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                  {uniqueFiles.length} 个文件变更
                </span>
                {/* 操作类型标签 */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {Array.from(new Set(g.files.map(f => f.op))).map(op => (
                    <span key={op} style={{
                      fontSize: 10, background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 4, padding: '1px 5px', color: 'var(--text-secondary)',
                    }}>{op}</span>
                  ))}
                </div>
                {/* 展开/收起 */}
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>

              {/* 展开：文件列表 */}
              {isOpen && (
                <div style={{ paddingLeft: 20, paddingBottom: 6, background: 'var(--bg-secondary)' }}>
                  {uniqueFiles.map((f) => (
                    <div key={f.path} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 14px 4px 0', fontSize: 11,
                    }}>
                      <FileText size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: 'var(--text-secondary)',
                      }} title={f.path}>
                        {basename(f.path)}
                      </span>
                      <span style={{
                        fontSize: 10,
                        background: f.op === '写入' ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)',
                        color: f.op === '写入' ? '#22c55e' : '#818cf8',
                        borderRadius: 3, padding: '1px 5px', flexShrink: 0,
                      }}>
                        {f.op}
                      </span>
                      {f.bytes > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {(f.bytes / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
