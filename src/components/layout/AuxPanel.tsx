/**
 * AuxPanel — 右侧辅助面板（仅在 dispatch 模式下显示）
 * Agent 中心设计 v3.0：只有「委派」视图需要右侧上下文工具
 * 子标签：文件浏览 / Git / 变更 / 上下文 / 检查点
 */
import {
  FolderOpen,
  GitBranch,
  GitCommit,
  Camera,
  Info,
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

  // 只在 dispatch 视图下渲染辅助面板
  if (activeNavSection !== 'dispatch') return null;

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
          background: 'var(--bg-primary)',
        }}
      >
        {/* 子标签栏 */}
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
