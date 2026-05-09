/**
 * Git 集成面板
 * 显示当前分支、变更文件（staged/unstaged）、提交信息输入、最近日志
 */
import { useState, useEffect, useCallback } from 'react';
import { GitBranch, RefreshCw, Plus, Minus, Check, ChevronDown, ChevronRight, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { GitStatus, GitLogEntry } from '../types/electron';

// 状态徽章颜色
const STATUS_COLOR: Record<string, string> = {
  M: 'var(--accent-warning, #f59e0b)',
  A: 'var(--accent-success, #22c55e)',
  D: 'var(--accent-danger, #ef4444)',
  R: 'var(--accent-info, #3b82f6)',
  '?': 'var(--text-muted)',
};

const STATUS_LABEL: Record<string, string> = {
  M: '修改',
  A: '新增',
  D: '删除',
  R: '重命名',
  '?': '未追踪',
};

function FileBadge({ status }: { status: string }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      color: STATUS_COLOR[status] ?? 'var(--text-muted)',
      border: `1px solid ${STATUS_COLOR[status] ?? 'var(--border-color)'}`,
      borderRadius: 3,
      padding: '0 4px',
      lineHeight: '16px',
      fontFamily: 'monospace',
      flexShrink: 0,
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

interface DiffViewerProps {
  diff: string;
}

function DiffViewer({ diff }: DiffViewerProps) {
  if (!diff) return <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>暂无变更</div>;
  const lines = diff.split('\n');
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, overflowX: 'auto' }}>
      {lines.map((line, i) => {
        let bg = 'transparent';
        let color = 'var(--text-secondary)';
        if (line.startsWith('+') && !line.startsWith('+++')) { bg = 'rgba(34,197,94,0.08)'; color = '#22c55e'; }
        else if (line.startsWith('-') && !line.startsWith('---')) { bg = 'rgba(239,68,68,0.08)'; color = '#ef4444'; }
        else if (line.startsWith('@@')) { color = '#3b82f6'; }
        else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) { color = 'var(--text-muted)'; }
        return (
          <div key={i} style={{ background: bg, color, padding: '0 8px', whiteSpace: 'pre', lineHeight: 1.6 }}>
            {line || '\u00a0'}
          </div>
        );
      })}
    </div>
  );
}

export function GitPanel() {
  const { session } = useAppStore();
  const cwd = session.workingDirectory;

  const [status, setStatus] = useState<GitStatus | null>(null);
  const [isRepo, setIsRepo] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Diff 预览
  const [diffTarget, setDiffTarget] = useState<{ path: string; staged: boolean } | null>(null);
  const [diff, setDiff] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);

  // 提交
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Push / Pull
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushPullResult, setPushPullResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 日志展开
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<GitLogEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!cwd) return;
    setLoading(true);
    setError('');
    try {
      const r = await window.electronAPI.gitIsRepo(cwd);
      setIsRepo(r.isRepo);
      if (!r.isRepo) { setStatus(null); setLoading(false); return; }
      const s = await window.electronAPI.gitStatus(cwd);
      if (s.success && s.status) setStatus(s.status);
      else setError(s.error ?? '获取 Git 状态失败');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => { refresh(); }, [refresh]);

  const openDiff = async (filePath: string, staged: boolean) => {
    setDiffTarget({ path: filePath, staged });
    setDiffLoading(true);
    try {
      const r = await window.electronAPI.gitDiff(cwd!, filePath, staged);
      setDiff(r.diff ?? '');
    } finally {
      setDiffLoading(false);
    }
  };

  const stageAll = async () => {
    if (!cwd || !status) return;
    const files = [...status.unstaged.map(f => f.path), ...status.untracked];
    if (!files.length) return;
    await window.electronAPI.gitAdd(cwd, files);
    refresh();
  };

  const stageFile = async (filePath: string) => {
    if (!cwd) return;
    await window.electronAPI.gitAdd(cwd, [filePath]);
    refresh();
  };

  const unstageFile = async (filePath: string) => {
    if (!cwd) return;
    await window.electronAPI.gitUnstage(cwd, [filePath]);
    refresh();
  };

  const doCommit = async () => {
    if (!cwd || !commitMsg.trim() || !status?.staged.length) return;
    setCommitting(true);
    setCommitResult(null);
    try {
      const r = await window.electronAPI.gitCommit(cwd, commitMsg.trim());
      if (r.success) {
        setCommitResult({ ok: true, msg: `已提交 ${r.hash}` });
        setCommitMsg('');
        refresh();
      } else {
        setCommitResult({ ok: false, msg: r.error ?? '提交失败' });
      }
    } finally {
      setCommitting(false);
    }
  };

  const doPush = async () => {
    if (!cwd) return;
    setPushing(true);
    setPushPullResult(null);
    try {
      // 如果没有远端追踪分支，尝试 --set-upstream
      const setUpstream = (status?.ahead ?? 0) > 0 && (status?.behind ?? 0) === 0;
      const r = await window.electronAPI.gitPush(cwd, 'origin', undefined, setUpstream);
      setPushPullResult({ ok: r.success, msg: r.success ? (r.output || '推送成功') : (r.error ?? '推送失败') });
      if (r.success) refresh();
    } finally {
      setPushing(false);
    }
  };

  const doPull = async () => {
    if (!cwd) return;
    setPulling(true);
    setPushPullResult(null);
    try {
      const r = await window.electronAPI.gitPull(cwd, 'origin');
      setPushPullResult({ ok: r.success, msg: r.success ? (r.output || '拉取成功') : (r.error ?? '拉取失败') });
      if (r.success) refresh();
    } finally {
      setPulling(false);
    }
  };

  const loadLog = async () => {
    if (!cwd) return;
    const r = await window.electronAPI.gitLog(cwd, 20);
    if (r.success && r.log) setLog(r.log);
    setShowLog(true);
  };

  // ── 渲染 ─────────────────────────────────────────────────────────────────────

  if (!cwd) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
        请先选择工作目录
      </div>
    );
  }

  if (isRepo === false) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
        当前目录不是 Git 仓库
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: 13 }}>
      {/* 顶部工具栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <GitBranch size={14} style={{ color: 'var(--accent-primary, #7c3aed)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, fontFamily: 'monospace' }}>
          {status?.branch ?? '—'}
        </span>
        {status && (status.ahead > 0 || status.behind > 0) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}>
            {status.ahead > 0 && <><ArrowUp size={10} />{status.ahead}</>}
            {status.behind > 0 && <><ArrowDown size={10} />{status.behind}</>}
          </span>
        )}
        <button
          onClick={refresh}
          title="刷新"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 4 }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {error && (
        <div style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* 内容区 — 左侧文件列表 + 右侧 diff */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左侧 */}
        <div style={{ width: 240, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* Staged */}
            <Section title={`已暂存 (${status?.staged.length ?? 0})`} color="var(--accent-success, #22c55e)">
              {status?.staged.map(f => (
                <FileRow
                  key={f.path} file={f}
                  active={diffTarget?.path === f.path && !!diffTarget.staged}
                  onClick={() => openDiff(f.path, true)}
                  action={<ActionBtn icon={<Minus size={11} />} title="取消暂存" onClick={() => unstageFile(f.path)} />}
                />
              ))}
            </Section>

            {/* Unstaged */}
            <Section title={`未暂存 (${(status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0)})`} color="var(--accent-warning, #f59e0b)">
              {status?.unstaged.map(f => (
                <FileRow
                  key={f.path} file={f}
                  active={diffTarget?.path === f.path && !diffTarget.staged}
                  onClick={() => openDiff(f.path, false)}
                  action={<ActionBtn icon={<Plus size={11} />} title="暂存" onClick={() => stageFile(f.path)} />}
                />
              ))}
              {status?.untracked.map(p => (
                <FileRow
                  key={p} file={{ path: p, status: '?' }}
                  active={false}
                  onClick={() => {}}
                  action={<ActionBtn icon={<Plus size={11} />} title="暂存" onClick={() => stageFile(p)} />}
                />
              ))}
              {!!((status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0)) && (
                <button
                  onClick={stageAll}
                  style={{
                    margin: '4px 8px 8px',
                    padding: '4px 8px',
                    fontSize: 12,
                    borderRadius: 4,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    width: 'calc(100% - 16px)',
                  }}
                >
                  全部暂存 (+{(status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0)})
                </button>
              )}
            </Section>
          </div>

          {/* 提交区 */}
          <div style={{ padding: 8, borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
            <textarea
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              placeholder="提交信息…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-input, var(--bg-tertiary))',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                padding: '6px 8px',
                fontSize: 12,
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') doCommit(); }}
            />
            <button
              onClick={doCommit}
              disabled={committing || !commitMsg.trim() || !(status?.staged.length)}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '6px',
                borderRadius: 4,
                border: 'none',
                background: (commitMsg.trim() && status?.staged.length) ? 'var(--accent-primary, #7c3aed)' : 'var(--bg-hover)',
                color: (commitMsg.trim() && status?.staged.length) ? '#fff' : 'var(--text-muted)',
                cursor: (commitMsg.trim() && status?.staged.length) ? 'pointer' : 'not-allowed',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Check size={12} /> 提交 {status?.staged.length ? `(${status.staged.length})` : ''}
            </button>
            {commitResult && (
              <div style={{ marginTop: 4, fontSize: 11, color: commitResult.ok ? '#22c55e' : '#ef4444' }}>
                {commitResult.msg}
              </div>
            )}
            {/* Push / Pull 区 */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button
                onClick={doPull}
                disabled={pulling || pushing}
                title="git pull origin"
                style={{
                  flex: 1, padding: '5px 4px',
                  borderRadius: 4, border: '1px solid var(--border-color)',
                  background: 'var(--bg-hover)', color: pulling ? 'var(--text-muted)' : 'var(--text-secondary)',
                  cursor: pulling || pushing ? 'not-allowed' : 'pointer',
                  fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <ArrowDown size={11} />
                {pulling ? '拉取中…' : `拉取${status?.behind ? ` (${status.behind})` : ''}`}
              </button>
              <button
                onClick={doPush}
                disabled={pushing || pulling}
                title="git push origin"
                style={{
                  flex: 1, padding: '5px 4px',
                  borderRadius: 4, border: '1px solid var(--border-color)',
                  background: 'var(--bg-hover)', color: pushing ? 'var(--text-muted)' : 'var(--text-secondary)',
                  cursor: pushing || pulling ? 'not-allowed' : 'pointer',
                  fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <ArrowUp size={11} />
                {pushing ? '推送中…' : `推送${status?.ahead ? ` (${status.ahead})` : ''}`}
              </button>
            </div>
            {pushPullResult && (
              <div style={{ marginTop: 4, fontSize: 11, color: pushPullResult.ok ? '#22c55e' : '#ef4444', wordBreak: 'break-all' }}>
                {pushPullResult.msg}
              </div>
            )}
          </div>
        </div>

        {/* 右侧 Diff 预览 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {diffTarget ? (
            <>
              <div style={{
                padding: '6px 12px', borderBottom: '1px solid var(--border-color)',
                fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <FileText size={11} />
                {diffTarget.path}
                <span style={{ fontSize: 10, background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>
                  {diffTarget.staged ? 'staged' : 'unstaged'}
                </span>
              </div>
              {diffLoading
                ? <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>加载中…</div>
                : <DiffViewer diff={diff} />
              }
            </>
          ) : (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
              点击左侧文件查看 diff
            </div>
          )}
        </div>
      </div>

      {/* 提交日志 */}
      <div style={{ borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
        <button
          onClick={showLog ? () => setShowLog(false) : loadLog}
          style={{
            width: '100%', padding: '6px 12px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 12, textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {showLog ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          最近提交
        </button>
        {showLog && (
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '0 0 8px' }}>
            {log.map(entry => (
              <div key={entry.hash} style={{
                padding: '4px 12px', display: 'flex', gap: 8, alignItems: 'baseline',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <code style={{ fontSize: 10, color: '#3b82f6', flexShrink: 0 }}>{entry.hash}</code>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.message}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{entry.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 子组件 ────────────────────────────────────────────────────────────────────

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        padding: '6px 12px 3px',
        fontSize: 11, fontWeight: 600,
        color, textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FileRow({
  file, active, onClick, action,
}: {
  file: { path: string; status: string };
  active: boolean;
  onClick: () => void;
  action: React.ReactNode;
}) {
  const name = file.path.split('/').pop() ?? file.path;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 8px 3px 12px',
        cursor: 'pointer',
        background: active ? 'var(--bg-active, rgba(124,58,237,0.12))' : 'transparent',
        borderLeft: active ? '2px solid var(--accent-primary, #7c3aed)' : '2px solid transparent',
      }}
    >
      <FileBadge status={file.status} />
      <span style={{
        flex: 1, fontSize: 12, fontFamily: 'monospace',
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }} title={file.path}>
        {name}
      </span>
      <div onClick={e => e.stopPropagation()}>
        {action}
      </div>
    </div>
  );
}

function ActionBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', padding: 3, borderRadius: 3,
        display: 'flex', alignItems: 'center',
      }}
    >
      {icon}
    </button>
  );
}
