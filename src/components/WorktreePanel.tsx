import { useState, useEffect, useCallback } from 'react';
import { GitFork, Plus, Trash2, RefreshCw, Scissors, CheckCircle, AlertTriangle, FolderOpen, ExternalLink, GitCompare } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { WorktreeInfo } from '../types/electron';

// ─── 3.6.4 WorktreeCompareModal ───────────────────────────────────────────

function WorktreeCompareModal({
  worktrees,
  onClose,
}: {
  worktrees: WorktreeInfo[];
  onClose: () => void;
}) {
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(1, worktrees.length - 1));
  const [leftDiff, setLeftDiff] = useState('');
  const [rightDiff, setRightDiff] = useState('');
  const [leftFiles, setLeftFiles] = useState<string[]>([]);
  const [rightFiles, setRightFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compared, setCompared] = useState(false);

  const handleCompare = useCallback(async () => {
    const leftWt = worktrees[leftIdx];
    const rightWt = worktrees[rightIdx];
    if (!leftWt || !rightWt) return;
    if (!window.electronAPI?.gitWorktreeFullDiff) {
      setError('当前版本不支持 Worktree 全量 Diff 接口');
      return;
    }
    setLoading(true);
    setError('');
    setCompared(false);
    const [lRes, rRes] = await Promise.all([
      window.electronAPI.gitWorktreeFullDiff(leftWt.path),
      window.electronAPI.gitWorktreeFullDiff(rightWt.path),
    ]);
    setLoading(false);
    if (!lRes.success || !rRes.success) {
      setError(lRes.error ?? rRes.error ?? '获取 diff 失败');
      return;
    }
    setLeftDiff(lRes.diff || '(无改动)');
    setRightDiff(rRes.diff || '(无改动)');
    setLeftFiles(lRes.changedFiles);
    setRightFiles(rRes.changedFiles);
    setCompared(true);
  }, [worktrees, leftIdx, rightIdx]);

  const leftWt = worktrees[leftIdx];
  const rightWt = worktrees[rightIdx];

  // 公共文件（两侧都有改动）
  const commonFiles = compared ? leftFiles.filter((f) => rightFiles.includes(f)) : [];
  const onlyLeft = compared ? leftFiles.filter((f) => !rightFiles.includes(f)) : [];
  const onlyRight = compared ? rightFiles.filter((f) => !leftFiles.includes(f)) : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 40,
    }}>
      <div style={{
        background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 10,
        width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <GitCompare size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Worktree 并排对比</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>左侧：</span>
          <select
            className="input"
            style={{ fontSize: 12, padding: '3px 8px', minWidth: 160 }}
            value={leftIdx}
            onChange={(e) => setLeftIdx(Number(e.target.value))}
          >
            {worktrees.map((wt, i) => (
              <option key={wt.path} value={i}>{wt.branch || `(${wt.head.slice(0, 7)})`} — {wt.path}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>右侧：</span>
          <select
            className="input"
            style={{ fontSize: 12, padding: '3px 8px', minWidth: 160 }}
            value={rightIdx}
            onChange={(e) => setRightIdx(Number(e.target.value))}
          >
            {worktrees.map((wt, i) => (
              <option key={wt.path} value={i}>{wt.branch || `(${wt.head.slice(0, 7)})`} — {wt.path}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => void handleCompare()}
            disabled={loading || leftIdx === rightIdx}
            style={{ fontSize: 12 }}
          >
            {loading ? '加载中…' : '开始对比'}
          </button>
          {error && <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>}
        </div>

        {/* 文件摘要栏 */}
        {compared && (
          <div style={{ display: 'flex', gap: 16, padding: '8px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, flexWrap: 'wrap' }}>
            {commonFiles.length > 0 && <span>🔵 公共改动: {commonFiles.join(', ').slice(0, 120)}</span>}
            {onlyLeft.length > 0 && <span>🟡 仅左侧: {onlyLeft.join(', ').slice(0, 80)}</span>}
            {onlyRight.length > 0 && <span>🟢 仅右侧: {onlyRight.join(', ').slice(0, 80)}</span>}
            {leftFiles.length === 0 && rightFiles.length === 0 && <span>两个 worktree 均无未提交改动</span>}
          </div>
        )}

        {/* Main diff area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Left */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', minWidth: 0 }}>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)', fontSize: 12, fontWeight: 600, background: 'var(--bg-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitFork size={12} />
              {leftWt?.branch || leftWt?.head.slice(0, 7) || '左侧'}
              <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 11 }}>{leftFiles.length} 文件</span>
            </div>
            <pre style={{ margin: 0, flex: 1, overflow: 'auto', padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
              {compared ? leftDiff : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>请选择 worktree 并点击「开始对比」</span>}
            </pre>
          </div>
          {/* Right */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)', fontSize: 12, fontWeight: 600, background: 'var(--bg-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitFork size={12} />
              {rightWt?.branch || rightWt?.head.slice(0, 7) || '右侧'}
              <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 11 }}>{rightFiles.length} 文件</span>
            </div>
            <pre style={{ margin: 0, flex: 1, overflow: 'auto', padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
              {compared ? rightDiff : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>请选择 worktree 并点击「开始对比」</span>}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          <button className="btn" onClick={onClose} style={{ fontSize: 12 }}>关闭</button>
        </div>
      </div>
    </div>
  );
}

export function WorktreePanel() {
  const { session, setSession } = useAppStore();
  const cwd = session.workingDirectory;

  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // 新建 worktree 表单
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPath, setAddPath] = useState('');
  const [addBranch, setAddBranch] = useState('');
  const [addCreateBranch, setAddCreateBranch] = useState(false);
  const [addBaseBranch, setAddBaseBranch] = useState('HEAD');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<WorktreeInfo | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 3.6.4 Worktree 对比视图
  const [showCompare, setShowCompare] = useState(false);

  const load = useCallback(async () => {
    if (!cwd) return;
    setLoading(true);
    setError('');
    const res = await window.electronAPI.gitWorktreeList(cwd);
    setLoading(false);
    if (res.success && res.worktrees) {
      setWorktrees(res.worktrees);
    } else {
      setError(res.error || '获取失败');
    }
  }, [cwd]);

  useEffect(() => {
    load();
  }, [load]);

  // 切换工作区（更新 session.workingDirectory）
  const switchTo = (wt: WorktreeInfo) => {
    setSession({ workingDirectory: wt.path });
    setActionMsg(`已切换到 ${wt.path}`);
    setTimeout(() => setActionMsg(''), 3000);
  };

  // 浏览器选择目录
  const browsePath = async () => {
    const res = await window.electronAPI.selectDirectory(addPath || cwd || undefined);
    if (res.success && res.path) setAddPath(res.path);
  };

  const handleAdd = async () => {
    if (!cwd || !addPath.trim() || !addBranch.trim()) {
      setAddError('请填写路径和分支名');
      return;
    }
    setAddLoading(true);
    setAddError('');
    const res = await window.electronAPI.gitWorktreeAdd(
      cwd,
      addPath.trim(),
      addBranch.trim(),
      addCreateBranch,
      addCreateBranch ? addBaseBranch.trim() || 'HEAD' : undefined,
    );
    setAddLoading(false);
    if (res.success) {
      setShowAddForm(false);
      setAddPath('');
      setAddBranch('');
      setAddCreateBranch(false);
      setAddBaseBranch('HEAD');
      load();
    } else {
      setAddError(res.error || '创建失败');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !cwd) return;
    setDeleteLoading(true);
    const res = await window.electronAPI.gitWorktreeRemove(cwd, deleteTarget.path, forceDelete);
    setDeleteLoading(false);
    if (res.success) {
      setDeleteTarget(null);
      setForceDelete(false);
      load();
    } else {
      setError(res.error || '删除失败');
      setDeleteTarget(null);
    }
  };

  const handlePrune = async () => {
    if (!cwd) return;
    const res = await window.electronAPI.gitWorktreePrune(cwd);
    if (res.success) {
      setActionMsg('修剪完成' + (res.output ? `：${res.output}` : ''));
      setTimeout(() => setActionMsg(''), 4000);
      load();
    } else {
      setError(res.error || '修剪失败');
    }
  };

  const isCurrentCwd = (wt: WorktreeInfo) =>
    wt.path.replace(/\\/g, '/') === (cwd || '').replace(/\\/g, '/');

  if (!cwd) {
    return (
      <div className="worktree-panel">
        <div className="worktree-empty">请先在聊天面板设置工作目录</div>
      </div>
    );
  }

  return (
    <div className="worktree-panel">
      {/* 顶部栏 */}
      <div className="worktree-header" style={{ flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <GitFork size={14} color="var(--accent-color)" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Git Worktree</span>
          <span
            title={cwd}
            style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
          >
            {/* 仅显示路径最后一段（目录名），完整路径通过 title tooltip 展示 */}
            {cwd ? (cwd.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? cwd) : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn" title="修剪悬空 worktree" onClick={handlePrune} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px' }}>
            <Scissors size={11} /> 修剪
          </button>
          {/* 3.6.4 并排对比 */}
          <button
            className="btn"
            title="并排对比两个 Worktree 的变更"
            onClick={() => setShowCompare(true)}
            disabled={worktrees.length < 2}
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px' }}
          >
            <GitCompare size={11} /> 对比
          </button>
          <button className="btn btn-primary" onClick={() => { setShowAddForm(true); setAddError(''); }} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px' }}>
            <Plus size={11} /> 新建
          </button>
          <button className="btn" onClick={load} title="刷新" style={{ padding: '3px 6px' }}>
            <RefreshCw size={12} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* 操作反馈 */}
      {actionMsg && (
        <div className="worktree-msg success">
          <CheckCircle size={12} /> {actionMsg}
        </div>
      )}
      {error && (
        <div className="worktree-msg error">
          <AlertTriangle size={12} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11 }}>✕</button>
        </div>
      )}

      {/* 新建表单 */}
      {showAddForm && (
        <div className="worktree-form">
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>新建 Worktree</div>

          <label className="worktree-label">目标目录路径</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              className="worktree-input"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
              placeholder="/path/to/new-worktree"
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={browsePath} title="浏览..." style={{ padding: '3px 8px' }}>
              <FolderOpen size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 4px' }}>
            <input
              type="checkbox"
              id="create-branch"
              checked={addCreateBranch}
              onChange={(e) => setAddCreateBranch(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="create-branch" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              创建新分支（-b）
            </label>
          </div>

          <label className="worktree-label">{addCreateBranch ? '新分支名' : '已有分支名'}</label>
          <input
            className="worktree-input"
            value={addBranch}
            onChange={(e) => setAddBranch(e.target.value)}
            placeholder={addCreateBranch ? 'feature/my-new-branch' : 'main'}
          />

          {addCreateBranch && (
            <>
              <label className="worktree-label" style={{ marginTop: 6 }}>起点（commit-ish）</label>
              <input
                className="worktree-input"
                value={addBaseBranch}
                onChange={(e) => setAddBaseBranch(e.target.value)}
                placeholder="HEAD"
              />
            </>
          )}

          {addError && (
            <div className="worktree-msg error" style={{ marginTop: 8 }}>
              <AlertTriangle size={11} /> {addError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => { setShowAddForm(false); setAddError(''); }} style={{ fontSize: 12 }}>取消</button>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={addLoading || !addPath.trim() || !addBranch.trim()}
              style={{ fontSize: 12 }}
            >
              {addLoading ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      )}

      {/* Worktree 列表 */}
      {loading && worktrees.length === 0 ? (
        <div className="worktree-empty">加载中...</div>
      ) : worktrees.length === 0 ? (
        <div className="worktree-empty">未检测到 git 仓库或 worktree</div>
      ) : (
        <div className="worktree-list">
          {worktrees.map((wt) => {
            const isCurrent = isCurrentCwd(wt);
            return (
              <div
                key={wt.path}
                className={`worktree-item${isCurrent ? ' active' : ''}`}
              >
                <div className="worktree-item-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <GitFork size={13} color={isCurrent ? 'var(--accent-color)' : 'var(--text-muted)'} />
                    <span className="worktree-branch">
                      {wt.isDetached ? `(detached: ${wt.head.slice(0, 7)})` : wt.branch || '(无分支)'}
                    </span>
                    {wt.isMain && <span className="worktree-badge main">主</span>}
                    {isCurrent && <span className="worktree-badge active">当前</span>}
                    {wt.isLocked && <span className="worktree-badge locked">锁定</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!isCurrent && (
                      <button
                        className="btn"
                        onClick={() => switchTo(wt)}
                        title="切换到此工作区"
                        style={{ fontSize: 11, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3 }}
                      >
                        <ExternalLink size={10} /> 切换
                      </button>
                    )}
                    {!wt.isMain && (
                      <button
                        className="btn btn-danger-ghost"
                        onClick={() => { setDeleteTarget(wt); setForceDelete(false); }}
                        title="删除此 worktree"
                        style={{ padding: '2px 6px' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="worktree-path" title={wt.path}>{wt.path}</div>
                <div className="worktree-head">HEAD: {wt.head.slice(0, 8)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 24, maxWidth: 400, width: '90%', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={15} color="#d4a017" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>删除 Worktree</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              确定要删除工作区 <strong>{deleteTarget.branch || deleteTarget.head.slice(0, 7)}</strong> 吗？<br />
              <span style={{ wordBreak: 'break-all', color: 'var(--text-muted)' }}>{deleteTarget.path}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <input
                type="checkbox"
                id="force-del"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="force-del" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                强制删除（即使有未提交改动）
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeleteTarget(null)} style={{ fontSize: 12 }}>取消</button>
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleteLoading}
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Trash2 size={12} /> {deleteLoading ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.6.4 Worktree 并排对比 Modal */}
      {showCompare && (
        <WorktreeCompareModal
          worktrees={worktrees}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}
