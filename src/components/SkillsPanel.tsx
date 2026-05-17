import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { FileText, Plus, Save, RefreshCw, Loader2, Check, X, BookOpen, FolderOpen, FilePlus2, Trash2 } from 'lucide-react';

const CUSTOM_FILES_KEY = 'claude-gui-skill-custom-files';

interface SkillFile {
  name: string;   // 展示名（如 CLAUDE.md、skills/my-skill.md）
  path: string;   // 绝对路径
  category: '项目指令' | 'Skills' | '全局指令' | '自定义';
}

/** 尝试读取一个文件，返回 null 表示不存在或失败 */
async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    const res = await window.electronAPI.readFile(filePath);
    return res.success ? (res.content ?? '') : null;
  } catch {
    return null;
  }
}

/** 列出目录，失败时返回空数组 */
async function tryListDir(dirPath: string) {
  try {
    const res = await window.electronAPI.listDirectory(dirPath);
    return res.success ? (res.entries ?? []) : [];
  } catch {
    return [];
  }
}

export function SkillsPanel() {
  const { session } = useAppStore();
  const cwd = session.workingDirectory;

  const [files, setFiles] = useState<SkillFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<SkillFile | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'ok' | 'err' | null>(null);
  const [creating, setCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('CLAUDE.md');
  // 自定义文件（手动添加，localStorage 持久化）
  const [customFiles, setCustomFiles] = useState<SkillFile[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_FILES_KEY) ?? '[]');
    } catch { return []; }
  });

  /** 持久化自定义文件列表 */
  const saveCustomFiles = useCallback((files: SkillFile[]) => {
    setCustomFiles(files);
    localStorage.setItem(CUSTOM_FILES_KEY, JSON.stringify(files));
  }, []);

  /** 打开文件 */
  const openFile = useCallback(async (file: SkillFile) => {
    setSelectedFile(file);
    const c = await tryReadFile(file.path);
    const text = c ?? '';
    setContent(text);
    setOriginalContent(text);
    setSaveResult(null);
  }, []);

  /** 浏览选择文件并添加到自定义列表 */
  const addCustomFile = useCallback(async () => {
    const res = await window.electronAPI.selectFile({ defaultPath: cwd || undefined });
    if (!res.success || !res.path) return;
    const filePath = res.path.replace(/\\/g, '/');
    if (customFiles.some((f) => f.path === filePath)) return; // 已存在，不重复添加
    const name = filePath.split('/').pop() ?? filePath;
    const newFile: SkillFile = { name, path: filePath, category: '自定义' };
    saveCustomFiles([...customFiles, newFile]);
    // 自动打开
    void openFile(newFile);
  }, [cwd, customFiles, saveCustomFiles, openFile]);

  /** 删除自定义文件（从列表移除，不删除实际文件） */
  const removeCustomFile = useCallback((filePath: string) => {
    saveCustomFiles(customFiles.filter((f) => f.path !== filePath));
    if (selectedFile?.path === filePath) {
      setSelectedFile(null);
      setContent('');
      setOriginalContent('');
    }
  }, [customFiles, saveCustomFiles, selectedFile]);

  /** 扫描当前 cwd 下的 Skill 文件 */
  const scan = useCallback(async () => {
    if (!cwd) return;
    setLoading(true);
    const found: SkillFile[] = [];

    // 1. 项目根目录的指令文件
    for (const name of ['CLAUDE.md', 'AGENTS.md', '.claude/settings.json']) {
      const fullPath = `${cwd}/${name}`.replace(/\\/g, '/');
      const content = await tryReadFile(fullPath);
      if (content !== null) {
        found.push({ name, path: fullPath, category: '项目指令' });
      }
    }

    // 2. .github/skills/ 目录
    const skillsDir = `${cwd}/.github/skills`.replace(/\\/g, '/');
    const skillDirEntries = await tryListDir(skillsDir);
    for (const entry of skillDirEntries) {
      if (entry.type === 'directory') {
        // 子目录，尝试读取 SKILL.md
        const skillMd = `${skillsDir}/${entry.name}/SKILL.md`;
        const c = await tryReadFile(skillMd);
        if (c !== null) {
          found.push({ name: `skills/${entry.name}/SKILL.md`, path: skillMd, category: 'Skills' });
        }
      } else if (entry.name.endsWith('.md')) {
        found.push({ name: `skills/${entry.name}`, path: `${skillsDir}/${entry.name}`, category: 'Skills' });
      }
    }

    // 3. 全局 ~/.claude/CLAUDE.md（如果存在）
    const homeClaudeMd = '~/.claude/CLAUDE.md';
    const homeClaudeContent = await tryReadFile(homeClaudeMd);
    if (homeClaudeContent !== null) {
      found.push({ name: '~/.claude/CLAUDE.md', path: homeClaudeMd, category: '全局指令' });
    }

    setFiles(found);
    setLoading(false);
  }, [cwd]);

  useEffect(() => {
    void scan();
  }, [scan]);

  /** 保存文件 */
  const saveFile = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await window.electronAPI.writeFile(selectedFile.path, content);
      setSaveResult(res.success ? 'ok' : 'err');
      if (res.success) setOriginalContent(content);
    } catch {
      setSaveResult('err');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 2000);
    }
  }, [selectedFile, content]);

  /** 创建新文件 */
  const createFile = useCallback(async () => {
    if (!cwd || !newFileName.trim()) return;
    const fullPath = `${cwd}/${newFileName.trim()}`.replace(/\\/g, '/');
    const initial = `# ${newFileName.trim()}\n\n> 在这里添加 Claude Code 的指令和上下文信息...\n`;
    const res = await window.electronAPI.writeFile(fullPath, initial);
    if (res.success) {
      const newFile: SkillFile = {
        name: newFileName.trim(),
        path: fullPath,
        category: newFileName.includes('skill') || newFileName.includes('SKILL') ? 'Skills' : '项目指令',
      };
      setFiles((prev) => [...prev, newFile]);
      setSelectedFile(newFile);
      setContent(initial);
      setOriginalContent(initial);
      setCreating(false);
      setNewFileName('CLAUDE.md');
    }
  }, [cwd, newFileName]);

  const isDirty = content !== originalContent;

  const categoryColors: Record<string, string> = {
    '项目指令': 'var(--accent-color)',
    'Skills': '#8250df',
    '全局指令': 'var(--text-muted)',
    '自定义': '#d29922',
  };

  // 合并扫描文件 + 自定义文件（自定义不与扫描重复）
  const allFiles = [
    ...files,
    ...customFiles.filter((cf) => !files.some((f) => f.path === cf.path)),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 头部工具栏 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <BookOpen size={16} />
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Skills / 指令文件</span>
        <button
          className="btn"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={scan}
          title="刷新扫描"
          disabled={loading}
        >
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
        </button>
        <button
          className="btn"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={addCustomFile}
          title="浏览并添加任意 Markdown 文件"
        >
          <FilePlus2 size={13} /> 浏览
        </button>
        <button
          className="btn btn-primary"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={() => setCreating(true)}
          title="新建指令文件"
        >
          <Plus size={13} /> 新建
        </button>
      </div>

      {/* 新建文件行 */}
      {creating && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexShrink: 0,
          background: 'var(--bg-tertiary)',
        }}>
          <FolderOpen size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            className="input"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="文件名，如 CLAUDE.md"
            style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
            onKeyDown={(e) => { if (e.key === 'Enter') void createFile(); if (e.key === 'Escape') setCreating(false); }}
            autoFocus
          />
          <button className="btn btn-primary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={createFile}>
            <Check size={12} />
          </button>
          <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setCreating(false)}>
            <X size={12} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 文件列表 */}
        <div style={{
          width: 180,
          borderRight: '1px solid var(--border-color)',
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          {!cwd ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              <div style={{ fontStyle: 'italic', marginBottom: 8 }}>请先在委派视图中设置工作目录</div>
              <button
                className="btn btn-primary"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => useAppStore.getState().setActiveNavSection('dispatch')}
              >
                前往委派
              </button>
            </div>
          ) : files.length === 0 && customFiles.length === 0 && !loading ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              未找到 Skill 文件<br />
              <span style={{ fontSize: 11 }}>点击"新建"创建 CLAUDE.md</span>
            </div>
          ) : (
            <>
              {(['项目指令', 'Skills', '全局指令', '自定义'] as const).map((cat) => {
                const catFiles = allFiles.filter((f) => f.category === cat);
                if (catFiles.length === 0) return null;
                return (
                  <div key={cat}>
                    <div style={{
                      padding: '6px 12px 3px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: categoryColors[cat],
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {cat}
                    </div>
                    {catFiles.map((file) => (
                      <div
                        key={file.path}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          background: selectedFile?.path === file.path ? 'var(--bg-hover)' : 'none',
                          transition: 'background 0.1s',
                        }}
                      >
                        <button
                          onClick={() => void openFile(file)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 6,
                            padding: '6px 8px 6px 12px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: selectedFile?.path === file.path ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: 12,
                          }}
                        >
                          <FileText size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span style={{ wordBreak: 'break-all', lineHeight: 1.4 }}>{file.name}</span>
                        </button>
                        {file.category === '自定义' && (
                          <button
                            onClick={() => removeCustomFile(file.path)}
                            title="从列表移除（不删除文件）"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '6px 8px 6px 4px',
                              color: 'var(--text-muted)',
                              flexShrink: 0,
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* 编辑器区域 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedFile ? (
            <>
              {/* 编辑器顶部 */}
              <div style={{
                padding: '6px 12px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
                background: 'var(--bg-secondary)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFile.name}
                  {isDirty && <span style={{ color: 'var(--warning-text, #d29922)', marginLeft: 6 }}>●</span>}
                </span>
                <button
                  className={`btn ${saveResult === 'ok' ? '' : 'btn-primary'}`}
                  style={{ padding: '3px 10px', fontSize: 11 }}
                  onClick={saveFile}
                  disabled={saving || !isDirty}
                >
                  {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> :
                   saveResult === 'ok' ? <Check size={12} /> :
                   saveResult === 'err' ? <X size={12} /> :
                   <Save size={12} />}
                  {saving ? '保存中' : saveResult === 'ok' ? '已保存' : saveResult === 'err' ? '失败' : '保存'}
                </button>
              </div>
              {/* 文本编辑器 */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{
                  flex: 1,
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                  padding: '12px 16px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: 'Menlo, Monaco, Consolas, monospace',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                spellCheck={false}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    void saveFile();
                  }
                }}
              />
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              gap: 8,
            }}>
              <BookOpen size={32} style={{ opacity: 0.3 }} />
              <span>选择左侧文件查看/编辑</span>
              <span style={{ fontSize: 11 }}>支持 CLAUDE.md、AGENTS.md、Skill 文件</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
