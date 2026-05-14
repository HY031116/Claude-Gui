/**
 * TaskView — 任务中心主视图（v3.0 范式）
 *
 * 布局：
 *   左栏（flex: 1）= TaskTimeline（执行时序）+ ChatPanel（对话流 + 输入框）
 *   右栏（常驻，可折叠）= ReviewQueue（变更审查队列，始终可见）
 *
 * 设计原则：
 *   - ReviewQueue 不再隐藏在切换按钮后，始终作为右侧面板呈现
 *   - TaskTimeline 展示工具调用时序，位于对话流上方
 *   - 拖拽调整右栏宽度，右栏可手动折叠（但不消失，仅收窄）
 */
import { useState, useCallback, useRef } from 'react';
import { PanelRightOpen, PanelRightClose } from 'lucide-react';
import { ChatPanel } from '../ChatPanel';
import { ReviewQueue } from './ReviewQueue';
import { TaskTimeline } from './TaskTimeline';

/** 右栏宽度限制 */
const REVIEW_PANEL_MIN = 240;
const REVIEW_PANEL_DEFAULT = 380;
const REVIEW_PANEL_MAX = 600;

interface TaskViewProps {
  /** 当前活跃的标签 ID（用于 ChatPanel key，防止状态混淆） */
  activeTabId: string;
}

export function TaskView({ activeTabId }: TaskViewProps) {
  /** 右栏宽度（px），支持拖拽调整 */
  const [reviewWidth, setReviewWidth] = useState(REVIEW_PANEL_DEFAULT);
  /** 右栏是否折叠（折叠后只显示细条 + 展开按钮） */
  const [reviewCollapsed, setReviewCollapsed] = useState(false);

  // 拖拽调整宽度
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(REVIEW_PANEL_DEFAULT);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = reviewWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX; // 向左拖 = 变宽
      const next = Math.min(REVIEW_PANEL_MAX, Math.max(REVIEW_PANEL_MIN, dragStartWidth.current + delta));
      setReviewWidth(next);
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, [reviewWidth]);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── 左栏：执行时序 + 对话流 ─────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* 执行时序条（有工具调用时出现，可折叠） */}
        <TaskTimeline />
        {/* 对话流 + 输入区（始终存在，负责 CLI 解析） */}
        <ChatPanel key={activeTabId} />
      </div>

      {/* ── 拖拽分隔线 ─────────────────────────────────── */}
      {!reviewCollapsed && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
          style={{ cursor: 'col-resize' }}
        />
      )}

      {/* ── 右栏：变更审查队列（常驻，可折叠） ─────────── */}
      <div
        className="review-panel"
        style={{
          width: reviewCollapsed ? 36 : reviewWidth,
          transition: reviewCollapsed ? 'width 0.18s ease' : undefined,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
          overflow: 'hidden',
        }}
      >
        {/* 面板标题栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: reviewCollapsed ? '6px' : '6px 12px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
            background: 'var(--bg-secondary)',
            gap: 6,
            minHeight: 36,
            justifyContent: reviewCollapsed ? 'center' : undefined,
          }}
        >
          {!reviewCollapsed && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              变更审查
            </span>
          )}
          {/* 折叠 / 展开按钮 */}
          <button
            onClick={() => setReviewCollapsed((v) => !v)}
            title={reviewCollapsed ? '展开审查面板' : '收起审查面板'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            {reviewCollapsed
              ? <PanelRightOpen size={14} />
              : <PanelRightClose size={14} />}
          </button>
        </div>

        {/* ReviewQueue 内容（折叠时隐藏） */}
        {!reviewCollapsed && <ReviewQueue />}
      </div>
    </div>
  );
}
