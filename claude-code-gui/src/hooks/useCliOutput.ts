/**
 * useCliOutput — CLI 输出监听 hook
 * 订阅 electronAPI.onCliOutput，使用 RAF 批次写入终端行，
 * 避免高频输出时每行触发一次 setState
 */
import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { TerminalLine } from '../types';

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

      // PTY 进程退出：清除 pid，保持 isConnected
      if (event.type === 'exit') {
        setSession({ pid: undefined });
      }
    });

    return () => { unsubscribe(); };
  }, [addTerminalLines, setSession]);
}
