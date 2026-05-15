/**
 * FileSearchDropdown — @文件引用自动补全弹窗
 * 当用户在任务描述框中输入 @ 后触发，显示 fuzzy 匹配的文件列表
 *
 * 使用方式：
 *   <FileSearchDropdown
 *     cwd={workingDirectory}
 *     query={currentQuery}
 *     onSelect={(relativePath) => void}
 *     onClose={() => void}
 *     anchorRef={textareaRef}
 *   />
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { File } from 'lucide-react';

interface FileSearchDropdownProps {
  cwd: string;
  query: string;
  onSelect: (relativePath: string) => void;
  onClose: () => void;
  /** 定位参考元素（Textarea）：弹窗显示在其下方 */
  anchorRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function FileSearchDropdown({ cwd, query, onSelect, onClose, anchorRef }: FileSearchDropdownProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // 搜索文件（query 变化时重新请求）
  useEffect(() => {
    if (!cwd || query.length === 0) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setActiveIndex(0);

    const controller = new AbortController();
    window.electronAPI?.listFilesInDir(cwd, query)
      .then((res) => {
        if (controller.signal.aborted) return;
        setFiles(res.success && res.files ? res.files : []);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFiles([]);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [cwd, query]);

  // 键盘导航（↑↓回车Esc）
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, files.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (files[activeIndex]) onSelect(files[activeIndex]);
    }
  }, [files, activeIndex, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        if (!anchorRef.current?.contains(e.target as Node)) {
          onClose();
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorRef, onClose]);

  // 活动项自动滚动到可见区
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!loading && files.length === 0) return null;

  return (
    <ul className="file-search-dropdown" ref={listRef} role="listbox" aria-label="文件补全">
      {loading ? (
        <li className="file-search-dropdown-hint">搜索中…</li>
      ) : (
        files.map((f, i) => (
          <li
            key={f}
            className={`file-search-dropdown-item${i === activeIndex ? ' active' : ''}`}
            role="option"
            aria-selected={i === activeIndex}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseDown={(e) => { e.preventDefault(); onSelect(f); }}
          >
            <File size={12} className="file-search-icon" />
            <span className="file-search-path">{f}</span>
          </li>
        ))
      )}
    </ul>
  );
}
