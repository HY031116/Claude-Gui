/**
 * StatusBar — 底部状态栏组件
 * 显示连接状态 + Token 用量
 */
import { useAppStore } from '../../stores/useAppStore';

export function StatusBar() {
  const session = useAppStore((s) => s.session);
  const tokenUsage = useAppStore((s) => s.tokenUsage);

  return (
    <div className="status-bar">
      <span className={`status-dot ${session.isConnected ? 'connected' : 'disconnected'}`} />
      <span className="status-item">
        {session.isConnected ? '已连接' : '未连接'}
      </span>
      {session.isConnected && tokenUsage && (
        <>
          <span className="status-sep">|</span>
          <span
            className="status-item status-tokens"
            title={`输入 ${tokenUsage.inputTokens.toLocaleString()} tokens，输出 ${tokenUsage.outputTokens.toLocaleString()} tokens${tokenUsage.costUsd != null ? `，费用 $${tokenUsage.costUsd.toFixed(4)}` : ''}`}
          >
            ↑{tokenUsage.inputTokens.toLocaleString()} ↓{tokenUsage.outputTokens.toLocaleString()} tokens
            {tokenUsage.costUsd != null && (
              <> · ${tokenUsage.costUsd.toFixed(4)}</>
            )}
          </span>
        </>
      )}
    </div>
  );
}
