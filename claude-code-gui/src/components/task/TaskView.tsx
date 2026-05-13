/**
 * TaskView — 任务中心主视图（v3.0 范式）
 * 左栏：ChatPanel（对话流、工具调用、输入框）
 * 右栏：ReviewQueue（常驻审查队列，有待审查变更时显示）
 *
 * 策略：不重写现有组件，而是为现有 ChatPanel 增加右侧常驻审查面板，
 * 最小侵入地实现"执行 + 审查"的双栏布局。
 */
import { useState, useCallback, useRef } from 'react';
import { PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ChatPanel } from '../ChatPanel';
import { ReviewQueue } from './ReviewQueue';

const REVIEW_PANEL_MIN = 280;
const REVIEW_PANEL_DEFAULT = 360;
const REVIEW_PANEL_MAX = 560;

interface TaskViewProps {
  /** 当前活跃的标签 ID（用于 ChatPanel key） */
  activeTabId: string;
}

export function TaskView({ activeTabId }: TaskViewProps) {
  const messages = useAppStore((s) => s.messages);

  // 是否有待审查变更（控制右栏默认可见性）
  const hasPending = useAppStore((s) =>
    s.messages.some((m) =>
      (m.toolCalls ?? []).some(
        (tc) =>
          ['Write', 'write_file', 'Edit', 'edit_file', 'str_replace_editor',
           'str_replace_based_edit_tool', 'MultiEdit', 'multiedit'].includes(tc.name) &&
          tc.status === 'success' &&
          !tc.diffReviewStatus,
      ),
    ),
  );

  // 右栏是否展开（用户可手动切换）
  const [reviewOpen, setReviewOpen] = useState(hasPending);
  const [reviewWidth, setReviewWidth] = useState(REVIEW_PANEL_DEFAULT);

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

  // 有新待审查变更时自动展开（仅在关闭状态下触发）
  const prevHasPending = useRef(hasPending);
  if (hasPending && !prevHasPending.current && !reviewOpen) {
    setReviewOpen(true);
  }
  prevHasPending.current = hasPending;

  // 消息为空时不显示右栏
  const showReviewPanel = reviewOpen && messages.length > 0;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
      {/* 左栏：对话流（ChatPanel 保持完整功能） */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ChatPanel key={activeTabId} />
      </div>

      {/* 右栏开关按钮（悬浮在左栏右上角） */}
      <button
        onClick={() => setReviewOpen((v) => !v)}
        title={showReviewPanel ? '关闭审查面板' : '打开审查面板'}
        style={{
          position: 'absolute',
          top: 8,
          right: showReviewPanel ? reviewWidth + 6 : 6,
          zIndex: 10,
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: hasPending && !showReviewPanel
            ? 'var(--accent-color)'
            : 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          cursor: 'pointer',
          color: hasPending && !showReviewPanel ? '#fff' : 'var(--text-muted)',
          transition: 'right 0.2s',
          // 有待审查时显示角标动效
          boxShadow: hasPending && !showReviewPanel
            ? '0 0 0 2px var(--accent-color-alpha, rgba(139,92,246,0.3))'
            : 'none',
        }}
      >
        {showReviewPanel
          ? <PanelRightClose size={14} />
          : <PanelRightOpen size={14} />}
        {/* 待审查数量角标 */}
        {hasPending && !showReviewPanel && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            background: 'var(--error-text, #ef4444)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            lineHeight: '14px',
            textAlign: 'center',
            padding: '0 2px',
          }}>
            !
          </span>
        )}
      </button>

      {/* 右栏：审查队列 */}
      {showReviewPanel && (
        <>
          {/* 拖拽调整手柄 */}
          <div
            className="resize-handle"
            onMouseDown={handleResizeMouseDown}
            style={{ cursor: 'col-resize' }}
          />
          {/* 审查面板 */}
          <div
            style={{
              width: reviewWidth,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              overflow: 'hidden',
            }}
          >
            {/* 面板标题栏 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 12px',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
              background: 'var(--bg-secondary)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
                变更审查
              </span>
              <button
                onClick={() => setReviewOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <PanelRightClose size={13} />
              </button>
            </div>

            {/* 审查队列内容 */}
            <ReviewQueue />
          </div>
        </>
      )}
    </div>
  );
}
