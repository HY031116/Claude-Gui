/**
 * AuxPanel — 右侧辅助面板（仅在 dispatch 模式下显示）
 * Agent 中心设计 v3.0：只有「委派」视图需要右侧上下文工具
 * 子标签：文件浏览 / Git / 变更 / 上下文 / 检查点
 * v4.6+：无工作目录时自动折叠，可手动切换
 */
import { useState, useEffect } from 'react';
import {
  FolderOpen,
  GitBranch,
  GitCommit,
  Camera,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { FileExplorer } from '../FileExplorer';
import { GitPanel } from '../GitPanel';
import { ChangeSummaryPanel } from '../ChangeSummaryPanel';
import { CheckpointPanel } from '../CheckpointPanel';
import { ContextPanel } from '../ContextPanel';
import type { NavSection } from '../../utils/nav';

const DISPATCH_AUX_TABS = [
  { id: 'files', label: '文件', icon: FolderOpen },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'changes', label: '变更', icon: GitCommit },
  { id: 'context', label: '上下文', icon: Info },
  { id: 'checkpoints', label: '快照', icon: Camera },
] as const;

interface AuxPanelProps {
  width: number;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}

export function AuxPanel({ width, onResizeMouseDown }: AuxPanelProps) {
  const activeNavSection = useAppStore((s) => s.activeNavSection) as NavSection;
  const activeAuxSubPanel = useAppStore((s) => s.activeAuxSubPanel);
  const setActiveAuxSubPanel = useAppStore((s) => s.setActiveAuxSubPanel);
  const workingDirectory = useAppStore((s) => s.session.workingDirectory);

  // 无工作目录时默认折叠；有目录后不自动展开（尊重用户操作）
  const [collapsed, setCollapsed] = useState(!workingDirectory);

  // 首次设置工作目录时自动展开
  useEffect(() => {
    if (workingDirectory) setCollapsed(false);
  }, [workingDirectory]);

  // 只在 dispatch 视图下渲染辅助面板
  if (activeNavSection !== 'dispatch') return null;

  // ── 折叠态：仅显示一条 32px 宽的展开条 ──
  if (collapsed) {
    return (
      <>
        <div className="resize-handle" style={{ cursor: 'default', pointerEvents: 'none' }} />
        <div className="aux-panel-collapsed" title="展开上下文面板">
          <button
            className="aux-panel-toggle-btn"
            onClick={() => setCollapsed(false)}
            title="展开上下文工具"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="resize-handle" onMouseDown={onResizeMouseDown} />
      <div
        style={{
          width,
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}
      >
        {/* 子标签栏 + 折叠按钮 */}
        <div className="aux-tab-bar">
          {DISPATCH_AUX_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeAuxSubPanel === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveAuxSubPanel(tab.id)}
                className={`aux-tab-btn${isActive ? ' active' : ''}`}
                title={tab.label}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <button
            className="aux-tab-btn aux-collapse-btn"
            onClick={() => setCollapsed(true)}
            title="折叠上下文面板"
            style={{ marginLeft: 'auto' }}
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeAuxSubPanel === 'files' && <FileExplorer />}
          {activeAuxSubPanel === 'git' && <GitPanel />}
          {activeAuxSubPanel === 'changes' && <ChangeSummaryPanel />}
          {activeAuxSubPanel === 'context' && <ContextPanel />}
          {activeAuxSubPanel === 'checkpoints' && <CheckpointPanel />}
        </div>
      </div>
    </>
  );
}
