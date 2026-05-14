/**
 * useCliOutput — CLI 输出监听 hook
 * 订阅 electronAPI.onCliOutput，使用 RAF 批次写入终端行，
 * 避免高频输出时每行触发一次 setState
 */
import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { TerminalLine } from '../types';

/** 从 messages 数组提取会话标题（第一条 user 消息前 60 字符） */
function extractSessionTitle(messages: { role: string; content: string }[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return '（空会话）';
  const text = first.content.replace(/\n/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function useCliOutput() {
  const addTerminalLines = useAppStore((s) => s.addTerminalLines);
  const setSession = useAppStore((s) => s.setSession);

  const terminalLineBuffer = useRef<TerminalLine[]>([]);
  const terminalRafPending = useRef(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribe = window.electronAPI.onCliOutput((event) => {
      // message-* 类型属于聊天通道，不加入 terminalLines
      if (event.type === 'stdout' || event.type === 'stderr' || event.type === 'exit') {
        terminalLineBuffer.current.push({
          id: `${Date.now()}-${Math.random()}`,
          type: event.type,
          content: event.data,
          timestamp: Date.now(),
        });
        if (!terminalRafPending.current) {
          terminalRafPending.current = true;
          requestAnimationFrame(() => {
            if (terminalLineBuffer.current.length > 0) {
              addTerminalLines(terminalLineBuffer.current);
              terminalLineBuffer.current = [];
            }
            terminalRafPending.current = false;
          });
        }
      }

      // PTY 进程退出：清除 pid，保持 isConnected；同时异步保存会话
      if (event.type === 'exit') {
        setSession({ pid: undefined });

        // 异步保存当前会话（不阻塞 exit 事件处理）
        if (window.electronAPI?.sessionSave) {
          const state = useAppStore.getState();
          const { messages, session, tokenHistory } = state;
          // 只保存有实质内容的会话（至少一条 user 消息）
          if (messages.some((m) => m.role === 'user')) {
            const sessionId = session.conversationSessionId ?? `local-${Date.now()}`;
            const now = Date.now();
            const tokenSummary = tokenHistory.reduce(
              (acc, r) => ({
                inputTokens: acc.inputTokens + r.inputTokens,
                outputTokens: acc.outputTokens + r.outputTokens,
                costUsd: (acc.costUsd ?? 0) + (r.costUsd ?? 0),
              }),
              { inputTokens: 0, outputTokens: 0, costUsd: 0 as number | undefined }
            );
            // 过滤掉 image base64 内容，避免文件过大
            const safeMessages = messages.map((m) => ({
              ...m,
              content: typeof m.content === 'string' && m.content.startsWith('data:image')
                ? '[图片已省略]' : m.content,
            }));
            window.electronAPI.sessionSave({
              sessionId,
              title: extractSessionTitle(messages),
              workingDirectory: session.workingDirectory,
              createdAt: messages[0]?.timestamp ?? now,
              updatedAt: now,
              messages: safeMessages,
              tokenSummary,
            }).catch(() => { /* 静默失败，不影响主流程 */ });
          }
        }
      }
    });

    return () => { unsubscribe(); };
  }, [addTerminalLines, setSession]);
}
