import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { CheckCircle2, Circle, Loader2, ClipboardList, XCircle, Zap } from 'lucide-react';

export function TaskPanel() {
  const { todoItems, activePlanSteps } = useAppStore();
  const clearPlanSteps = useAppStore((s) => s.clearPlanSteps);

  // 所有步骤完成后触发淡出 → 1.5s 后清空，避免区域常驻遮挡任务列表
  const [fadingOut, setFadingOut] = useState(false);
  useEffect(() => {
    if (activePlanSteps.length === 0) {
      setFadingOut(false);
      return;
    }
    const allDone = activePlanSteps.every((s) => s.status === 'done' || s.status === 'error');
    if (allDone) {
      setFadingOut(true);
      const timer = setTimeout(() => {
        clearPlanSteps();
        setFadingOut(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [activePlanSteps, clearPlanSteps]);

  if (todoItems.length === 0 && activePlanSteps.length === 0 && !fadingOut) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 12,
        color: 'var(--text-muted)',
        padding: 24,
      }}>
        <ClipboardList size={36} strokeWidth={1} />
        <span style={{ fontSize: 13, textAlign: 'center' }}>
          暂无任务<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>当 Claude 创建待办事项时，任务将在这里显示</span>
        </span>
      </div>
    );
  }

  const total = todoItems.length;
  const done = todoItems.filter((t) => t.status === 'completed').length;
  const progress = Math.round((done / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* 实时执行步骤（对标 Codex turn/plan/updated），完成后淡出 */}
      {activePlanSteps.length > 0 && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
          background: 'rgba(88, 166, 255, 0.04)',
          opacity: fadingOut ? 0 : 1,
          transition: 'opacity 1.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Zap size={12} color="var(--accent-color)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-color)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              实时执行步骤
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activePlanSteps.map((step) => (
              <div key={step.id} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                opacity: step.status === 'done' ? 0.55 : 1,
                transition: 'opacity 0.3s',
              }}>
                {/* 状态图标 */}
                <div style={{ flexShrink: 0, marginTop: 1 }}>
                  {step.status === 'running' ? (
                    <Loader2
                      size={13}
                      color="var(--accent-color)"
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                  ) : step.status === 'done' ? (
                    <CheckCircle2 size={13} color="var(--success-text)" />
                  ) : (
                    <XCircle size={13} color="var(--error-text, #f85149)" />
                  )}
                </div>
                {/* 标签 + 描述 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: step.status === 'running' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}>
                    {step.label}
                  </span>
                  {step.description && (
                    <span style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginLeft: 6,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'inline-block',
                      maxWidth: '160px',
                      verticalAlign: 'bottom',
                    }}>
                      {step.description}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 进度概览 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            任务进度 {done}/{total}
          </span>
          <span style={{ fontSize: 12, color: 'var(--accent-color)', fontWeight: 600 }}>{progress}%</span>
        </div>
        {/* 进度条 */}
        <div style={{
          height: 4,
          background: 'var(--bg-tertiary)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress === 100 ? 'var(--success-text)' : 'var(--accent-color)',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* 任务列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {todoItems.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '8px 16px',
              opacity: item.status === 'completed' ? 0.55 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {/* 状态图标 */}
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              {item.status === 'completed' ? (
                <CheckCircle2 size={15} color="var(--success-text)" />
              ) : item.status === 'in_progress' ? (
                <Loader2
                  size={15}
                  color="var(--accent-color)"
                  style={{ animation: 'spin 1s linear infinite' }}
                />
              ) : (
                <Circle size={15} color="var(--text-muted)" />
              )}
            </div>
            {/* 任务内容 */}
            <span style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              textDecoration: item.status === 'completed' ? 'line-through' : 'none',
              flex: 1,
            }}>
              {item.content}
            </span>
            {/* 状态标签 */}
            {item.status === 'in_progress' && (
              <span style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 10,
                background: 'rgba(88, 166, 255, 0.15)',
                color: 'var(--accent-color)',
                flexShrink: 0,
                fontWeight: 500,
              }}>
                进行中
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
