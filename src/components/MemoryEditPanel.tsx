import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Save, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

type TabType = 'project' | 'user';

/** CLAUDE.md 内置编辑器面板
 *
 * 提供项目级（{cwd}/CLAUDE.md）和用户级（~/.claude/CLAUDE.md）两个标签页的内联编辑，
 * 支持创建、读取、保存，并在行数超过 200 行时给出警告。
 */
export function MemoryEditPanel() {
  const session = useAppStore((s) => s.session);

  const [activeTab, setActiveTab] = useState<TabType>('project');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fileExists, setFileExists] = useState(true);

  const projectPath = session.workingDirectory
    ? `${session.workingDirectory}/CLAUDE.md`.replace(/\\/g, '/')
    : '';
  const userPath = '~/.claude/CLAUDE.md';

  const currentPath = activeTab === 'project' ? projectPath : userPath;
  const lineCount = content ? content.split('\n').length : 0;
  const isDirty = content !== originalContent;

  const loadFile = useCallback(async () => {
    if (!currentPath) return;
    setIsLoading(true);
    setErrorMsg('');
    const result = await window.electronAPI?.readFile(currentPath);
    if (result?.success && result.content != null) {
      setContent(result.content);
      setOriginalContent(result.content);
      setFileExists(true);
    } else {
      // 文件不存在，使用空内容，用户保存时会自动创建
      setContent('');
      setOriginalContent('');
      setFileExists(false);
    }
    setIsLoading(false);
  }, [currentPath]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const handleSave = async () => {
    if (!currentPath) return;
    setSaveStatus('saving');
    setErrorMsg('');
    const result = await window.electronAPI?.writeFile(currentPath, content);
    if (result?.success) {
      setOriginalContent(content);
      setFileExists(true);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
      setErrorMsg(result?.error ?? '保存失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S / Cmd+S 快速保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (isDirty) handleSave();
    }
    // Tab 键插入两个空格而非跳出
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newContent = content.slice(0, start) + '  ' + content.slice(end);
      setContent(newContent);
      // 在下一帧恢复光标位置
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部标题栏 */}
      <div
        style={{
          padding: '12px 16px 0',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
          background: 'var(--bg-primary)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
          CLAUDE.md 记忆编辑器
        </div>
        {/* 标签页 */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['project', 'user'] as TabType[]).map((tab) => {
            const label = tab === 'project' ? '项目记忆' : '用户记忆';
            const pathLabel =
              tab === 'project'
                ? session.workingDirectory
                  ? `${session.workingDirectory}/CLAUDE.md`
                  : '（未选择工作目录）'
                : '~/.claude/CLAUDE.md';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                title={pathLabel}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: activeTab === tab ? 600 : 400,
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--accent-color)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  marginBottom: -1,
                  transition: 'color 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 路径 + 状态栏 */}
      <div
        style={{
          padding: '6px 16px',
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          title={currentPath}
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {currentPath || '请先选择工作目录'}
          {!fileExists && !isLoading && (
            <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }}>（文件不存在，保存后自动创建）</span>
          )}
        </span>
        <span style={{ flexShrink: 0 }}>
          {lineCount} 行
        </span>
      </div>

      {/* 行数超 200 警告 */}
      {lineCount > 200 && (
        <div
          style={{
            padding: '6px 16px',
            background: 'rgba(255,193,7,0.12)',
            borderBottom: '1px solid rgba(255,193,7,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#d4a017',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={13} />
          官方建议 CLAUDE.md 控制在 200 行以内（当前 {lineCount} 行）。超出部分可拆分到 Skills。
        </div>
      )}

      {/* 工具栏 */}
      <div
        style={{
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!isDirty || saveStatus === 'saving' || !currentPath}
          style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Save size={13} />
          {saveStatus === 'saving' ? '保存中…' : '保存'}
        </button>
        <button
          className="btn"
          onClick={loadFile}
          disabled={isLoading}
          title="重新从文件加载（丢弃未保存修改）"
          style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <RefreshCw size={13} />
          刷新
        </button>
        {isDirty && saveStatus === 'idle' && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>● 有未保存修改</span>
        )}
        {saveStatus === 'saved' && (
          <span style={{ fontSize: 11, color: 'var(--success-color, #4caf50)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} /> 已保存
          </span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: 11, color: 'var(--error-color, #f44336)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> {errorMsg}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Info size={11} />
          Ctrl+S 快速保存，Tab 插入空格
        </span>
      </div>

      {/* 加载占位 */}
      {isLoading ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          加载中…
        </div>
      ) : !currentPath ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={24} />
          <div>请先在委派视图中设置工作目录</div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 4, fontSize: 12, padding: '5px 14px' }}
            onClick={() => useAppStore.getState().setActiveNavSection('dispatch')}
          >
            前往委派
          </button>
        </div>
      ) : (
        /* 编辑区 */
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder={`在此编写 CLAUDE.md 内容…\n\n建议包含：\n- 项目概述\n- 构建命令\n- 编码规范\n- 常见约定（如 "永远不要删除注释"）`}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: '14px 16px',
            fontFamily: 'var(--font-mono, "Cascadia Code", "Fira Code", monospace)',
            fontSize: 13,
            lineHeight: 1.6,
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            overflowY: 'auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
