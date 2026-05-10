import { useState, useEffect, useCallback } from 'react';
import { GitFork, Plus, Trash2, RefreshCw, Scissors, CheckCircle, AlertTriangle, FolderOpen, ExternalLink } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { WorktreeInfo } from '../types/electron';

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
      <div className="worktree-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <GitFork size={14} color="var(--accent-color)" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Git Worktree</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {cwd}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn" title="修剪悬空 worktree" onClick={handlePrune} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px' }}>
            <Scissors size={11} /> 修剪
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
    </div>
  );
}
