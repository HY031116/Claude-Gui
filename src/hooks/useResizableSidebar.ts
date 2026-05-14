/**
 * useResizableSidebar — 可拖拽侧边栏宽度 hook
 * 宽度范围 240~480px，持久化至 localStorage
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'claude-gui-sidebar-width';
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 280;

export function useResizableSidebar() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = parseInt(localStorage.getItem(STORAGE_KEY) || String(DEFAULT_WIDTH), 10);
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, stored));
  });

  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    document.body.classList.add('is-resizing');
    e.preventDefault();
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - resizeStartX.current;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth.current + delta));
      setSidebarWidth(next);
      localStorage.setItem(STORAGE_KEY, String(next));
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.classList.remove('is-resizing');
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return { sidebarWidth, handleResizeMouseDown };
}
