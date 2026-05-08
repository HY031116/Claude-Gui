import { useAppStore } from '../stores/useAppStore';
import { Wrench, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function ToolCallView() {
  const { messages } = useAppStore();
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  // Extract tool calls from messages
  const toolCalls = messages
    .flatMap((msg) => msg.toolCalls || [])
    .filter(Boolean);

  const toggleExpanded = (id: string) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={14} color="var(--success-text)" />;
      case 'error':
        return <XCircle size={14} color="var(--error-text)" />;
      default:
        return <Clock size={14} color="var(--warning)" />;
    }
  };

  if (toolCalls.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          gap: 12,
          textAlign: 'center',
        }}
      >
        <Wrench size={32} strokeWidth={1} />
        <p style={{ fontSize: 13 }}>
          暂无工具调用记录
          <br />
          <span style={{ fontSize: 12 }}>与 Claude 交互时，工具调用将显示在这里</span>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          padding: '8px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: 4,
        }}
      >
        共 {toolCalls.length} 次工具调用
      </div>

      {toolCalls.map((call) => {
        const isExpanded = expandedCalls.has(call.id);
        return (
          <div
            key={call.id}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                background: 'var(--bg-tertiary)',
              }}
              onClick={() => toggleExpanded(call.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>

              {getStatusIcon(call.status)}

              <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>
                {call.name}
              </span>

              <span
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background:
                    call.status === 'success'
                      ? 'rgba(35, 134, 54, 0.2)'
                      : call.status === 'error'
                      ? 'rgba(218, 54, 51, 0.2)'
                      : 'rgba(210, 153, 34, 0.2)',
                  color:
                    call.status === 'success'
                      ? 'var(--success-text)'
                      : call.status === 'error'
                      ? 'var(--error-text)'
                      : 'var(--warning)',
                }}
              >
                {call.status === 'success' ? '成功' : call.status === 'error' ? '失败' : '执行中'}
              </span>
            </div>

            {isExpanded && (
              <div style={{ padding: 12, fontSize: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>参数:</div>
                  <pre
                    style={{
                      background: 'var(--bg-primary)',
                      padding: 8,
                      borderRadius: 4,
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {JSON.stringify(call.arguments, null, 2)}
                  </pre>
                </div>

                {call.result && (
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>结果:</div>
                    <pre
                      style={{
                        background: 'var(--bg-primary)',
                        padding: 8,
                        borderRadius: 4,
                        overflow: 'auto',
                        maxHeight: 300,
                      }}
                    >
                      {call.result}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
