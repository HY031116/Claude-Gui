/**
 * WorkspaceSelector — 多项目工作区切换器
 * 显示当前激活工作区，支持快速切换、新增、删除工作区
 */
import { useState, useRef, useEffect } from 'react';
import { FolderOpen, Plus, X, ChevronDown, LayoutGrid } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export function WorkspaceSelector() {
  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspacePath = useAppStore((s) => s.activeWorkspacePath);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const removeWorkspace = useAppStore((s) => s.removeWorkspace);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 当前工作区显示名
  const activeWs = workspaces.find((w) => w.path === activeWorkspacePath);
  const triggerLabel = activeWs ? activeWs.name : '全部会话';

  // 选择新目录并添加工作区
  const handleAdd = async () => {
    setOpen(false);
    const res = await window.electronAPI?.selectDirectory?.();
    if (res?.success && res.path) {
      addWorkspace(res.path);
    }
  };

  // 切换工作区
  const handleSelect = (path: string) => {
    setActiveWorkspace(path);
    setOpen(false);
  };

  // 删除工作区（阻止冒泡，不触发选中）
  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeWorkspace(id);
  };

  return (
    <div className="ws-selector" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        className={`ws-trigger${open ? ' ws-trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={activeWorkspacePath || '全部会话'}
      >
        {activeWs ? <FolderOpen size={13} /> : <LayoutGrid size={13} />}
        <span className="ws-trigger-label">{triggerLabel}</span>
        <ChevronDown size={12} className={`ws-chevron${open ? ' ws-chevron--up' : ''}`} />
      </button>

      {/* 下拉列表 */}
      {open && (
        <div className="ws-dropdown">
          {/* "全部" 选项 */}
          <button
            className={`ws-item${!activeWorkspacePath ? ' ws-item--active' : ''}`}
            onClick={() => handleSelect('')}
          >
            <LayoutGrid size={13} />
            <span className="ws-item-name">全部会话</span>
          </button>

          {workspaces.length > 0 && <div className="ws-divider" />}

          {/* 工作区列表 */}
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`ws-item ws-item--project${ws.path === activeWorkspacePath ? ' ws-item--active' : ''}`}
              onClick={() => handleSelect(ws.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(ws.path)}
            >
              <FolderOpen size={13} />
              <span className="ws-item-name" title={ws.path}>{ws.name}</span>
              <button
                className="ws-item-remove"
                title="移除工作区"
                onClick={(e) => handleRemove(e, ws.id)}
              >
                <X size={11} />
              </button>
            </div>
          ))}

          <div className="ws-divider" />

          {/* 添加工作区 */}
          <button className="ws-item ws-item--add" onClick={handleAdd}>
            <Plus size={13} />
            <span className="ws-item-name">添加工作区…</span>
          </button>
        </div>
      )}
    </div>
  );
}
