import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Folder, FileText, ChevronRight, ChevronDown, RefreshCw, FileCode, FileJson, FileImage } from 'lucide-react';
import type { DirEntry } from '../types';

const fileIcons: Record<string, React.ReactNode> = {
  '.ts': <FileCode size={14} />,
  '.tsx': <FileCode size={14} />,
  '.js': <FileCode size={14} />,
  '.jsx': <FileCode size={14} />,
  '.json': <FileJson size={14} />,
  '.md': <FileText size={14} />,
  '.png': <FileImage size={14} />,
  '.jpg': <FileImage size={14} />,
  '.svg': <FileImage size={14} />,
};

function getFileIcon(name: string) {
  const ext = name.slice(name.lastIndexOf('.'));
  return fileIcons[ext] || <FileText size={14} />;
}

export function FileExplorer() {
  const { currentPath, entries, setCurrentPath, setEntries, setSelectedFile, setFileContent } = useAppStore();
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const result = await window.electronAPI.listDirectory(path);
      if (result.success && result.entries) {
        setEntries(result.entries);
        setCurrentPath(path);
      }
    } catch {
      // 无后端时静默忽略
    } finally {
      setLoading(false);
    }
  }, [setEntries, setCurrentPath]);

  useEffect(() => {
    if (!currentPath) {
      const defaultPath = '~';
      loadDirectory(defaultPath);
    }
  }, [currentPath, loadDirectory]);

  const handleEntryClick = useCallback(async (entry: DirEntry) => {
    if (entry.type === 'directory') {
      if (expandedDirs.has(entry.path)) {
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.delete(entry.path);
          return next;
        });
      } else {
        await loadDirectory(entry.path);
        setExpandedDirs((prev) => new Set(prev).add(entry.path));
      }
    } else {
      setSelectedFile(entry.path);
      try {
        const result = await window.electronAPI.readFile(entry.path);
        if (result.success) {
          setFileContent(result.content || '');
        }
      } catch {
        // 无后端时静默忽略
      }
    }
  }, [expandedDirs, loadDirectory, setSelectedFile, setFileContent]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Path bar */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <input
          type="text"
          className="input"
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') loadDirectory(currentPath);
          }}
          style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
        />
        <button
          className="btn"
          onClick={() => loadDirectory(currentPath)}
          disabled={loading}
          style={{ padding: '4px 8px' }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {currentPath && (
          <div
            style={{
              padding: '4px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
            onClick={() => {
              const parent = currentPath.split('\\').slice(0, -1).join('\\') || currentPath.split('/').slice(0, -1).join('/');
              if (parent) loadDirectory(parent);
            }}
          >
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
            <span>..</span>
          </div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.path}
            style={{
              padding: '4px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
            onClick={() => handleEntryClick(entry)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              {entry.type === 'directory' ? (
                expandedDirs.has(entry.path) ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <span style={{ width: 14 }} />
              )}
            </span>

            <span
              style={{
                color:
                  entry.type === 'directory'
                    ? 'var(--accent-color)'
                    : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {entry.type === 'directory' ? <Folder size={14} /> : getFileIcon(entry.name)}
            </span>

            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.name}
            </span>

            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
              {formatSize(entry.size)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
