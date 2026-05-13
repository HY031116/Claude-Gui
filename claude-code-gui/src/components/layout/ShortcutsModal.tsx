/**
 * ShortcutsModal — 快捷键一览 Modal 组件
 * 通过 `?` 键触发，点击遮罩或 ESC 关闭
 */
import { useEffect } from 'react';

const SHORTCUTS = [
  { key: 'Ctrl+F', desc: '搜索消息' },
  { key: 'Ctrl+O', desc: '全局展开/折叠 Thinking' },
  { key: 'Ctrl+T', desc: '新建会话标签' },
  { key: 'Ctrl+W', desc: '关闭当前标签' },
  { key: 'Ctrl+V', desc: '粘贴截图为附件' },
  { key: 'Enter', desc: '发送消息（Shift+Enter 换行）' },
  { key: 'Esc', desc: '关闭搜索/弹窗' },
  { key: '?', desc: '显示此快捷键面板' },
];

interface ShortcutsModalProps {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="shortcuts-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="快捷键一览"
    >
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <span>⌨ 快捷键一览</span>
          <button className="shortcuts-close-btn" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div className="shortcuts-modal-body">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="shortcut-row">
              <kbd className="shortcut-key">{key}</kbd>
              <span className="shortcut-desc">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
