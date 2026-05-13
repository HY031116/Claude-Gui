/**
 * ContextPanel — 当前会话上下文面板
 * 展示：
 *   1. Claude 已读取的文件列表（从 Read 工具调用中提取）
 *   2. CLAUDE.md 摘要（读取工作目录下的 CLAUDE.md）
 *   3. Token 用量进度条
 */
import { useMemo, useEffect, useState } from 'react';
import { FileText, BookOpen, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { Message } from '../types';

/** 从消息列表中提取 Read 工具读取过的文件去重集合 */
function extractReadFiles(messages: Message[]): string[] {
  const seen = new Set<string>();
  for (const msg of messages) {
    for (const tc of msg.toolCalls ?? []) {
      if (tc.name !== 'Read' && tc.name !== 'read_file') continue;
      const fp = String(tc.arguments?.file_path ?? tc.arguments?.path ?? '');
      if (fp && !seen.has(fp)) seen.add(fp);
    }
  }
  return Array.from(seen);
}

/** 从 CLAUDE.md 内容提取前 N 行摘要 */
function extractSummary(content: string, maxLines = 8): string {
  return content
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, maxLines)
    .join('\n');
}

export function ContextPanel() {
  const messages = useAppStore((s) => s.messages);
  const session = useAppStore((s) => s.session);
  const tokenUsage = useAppStore((s) => s.tokenUsage);

  const [claudeMdContent, setClaudeMdContent] = useState<string | null>(null);
  const [claudeMdLoading, setClaudeMdLoading] = useState(false);
  const [claudeMdExpanded, setClaudeMdExpanded] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);

  // 提取 Read 过的文件列表
  const readFiles = useMemo(() => extractReadFiles(messages), [messages]);

  // 从工作目录读取 CLAUDE.md
  const workingDir = session.workingDirectory;
  useEffect(() => {
    if (!workingDir) { setClaudeMdContent(null); return; }
    setClaudeMdLoading(true);
    const claudeMdPath = workingDir.replace(/\\/g, '/').replace(/\/$/, '') + '/CLAUDE.md';
    window.electronAPI.readFile(claudeMdPath)
      .then((res) => {
        if (res.success && res.content) setClaudeMdContent(res.content);
        else setClaudeMdContent(null);
      })
      .catch(() => setClaudeMdContent(null))
      .finally(() => setClaudeMdLoading(false));
  }, [workingDir]);

  // Token 用量显示（来自 tokenUsage store）
  const inputTokens = tokenUsage?.inputTokens ?? 0;
  const outputTokens = tokenUsage?.outputTokens ?? 0;
  const totalTokens = inputTokens + outputTokens;
  // Claude 典型上下文窗口（200k，仅作参考比例）
  const contextLimit = 200_000;
  const usagePercent = Math.min((totalTokens / contextLimit) * 100, 100);

  const sectionTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-color)',
    cursor: 'pointer',
    userSelect: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12, height: '100%', overflow: 'auto' }}>

      {/* Token 用量 */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Zap size={13} style={{ color: 'var(--accent-warning, #f59e0b)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Token 用量</span>
        </div>
        {totalTokens > 0 ? (
          <>
            {/* 进度条 */}
            <div style={{
              height: 4, borderRadius: 2, background: 'var(--border-color)',
              overflow: 'hidden', marginBottom: 6,
            }}>
              <div style={{
                height: '100%',
                width: `${usagePercent}%`,
                borderRadius: 2,
                background: usagePercent > 80
                  ? 'var(--accent-danger, #ef4444)'
                  : usagePercent > 60
                  ? 'var(--accent-warning, #f59e0b)'
                  : 'var(--accent)',
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>输入 {inputTokens.toLocaleString()} · 输出 {outputTokens.toLocaleString()}</span>
              <span>{totalTokens.toLocaleString()} / {(contextLimit / 1000).toFixed(0)}k</span>
            </div>
            {tokenUsage?.costUsd != null && (
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                约 ${tokenUsage.costUsd.toFixed(4)} USD
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>暂无数据</div>
        )}
      </div>

      {/* 已读取文件列表 */}
      <div>
        <div style={sectionTitleStyle} onClick={() => setFilesExpanded((v) => !v)}>
          {filesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <BookOpen size={13} style={{ color: 'var(--accent-info, #3b82f6)' }} />
          <span>已读取文件</span>
          <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--text-muted)' }}>
            {readFiles.length} 个
          </span>
        </div>
        {filesExpanded && (
          <div style={{ padding: '4px 0' }}>
            {readFiles.length === 0 ? (
              <div style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>本会话暂未读取文件</div>
            ) : (
              readFiles.map((fp) => {
                const name = fp.replace(/\\/g, '/').split('/').pop() ?? fp;
                return (
                  <div
                    key={fp}
                    title={fp}
                    style={{
                      padding: '3px 14px 3px 28px',
                      fontFamily: 'monospace',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ marginRight: 6, color: 'var(--text-muted)' }}>📄</span>
                    {name}
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>
                      {fp.replace(/\\/g, '/').replace(name, '').replace(/\/$/, '')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* CLAUDE.md 摘要 */}
      <div style={{ borderTop: '1px solid var(--border-color)' }}>
        <div style={sectionTitleStyle} onClick={() => setClaudeMdExpanded((v) => !v)}>
          {claudeMdExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <FileText size={13} style={{ color: 'var(--accent-success, #22c55e)' }} />
          <span>CLAUDE.md</span>
          <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
            {claudeMdLoading
              ? <span style={{ color: 'var(--text-muted)' }}>读取中…</span>
              : claudeMdContent
              ? <span style={{ color: 'var(--accent-success, #22c55e)' }}>已加载</span>
              : <span style={{ color: 'var(--text-muted)' }}>未检测到</span>
            }
          </span>
        </div>
        {claudeMdExpanded && claudeMdContent && (
          <pre style={{
            margin: '4px 14px 12px',
            padding: '8px 10px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 300,
            overflow: 'auto',
          }}>
            {extractSummary(claudeMdContent)}
            {claudeMdContent.split('\n').filter((l) => l.trim()).length > 8 && (
              <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                … 共 {claudeMdContent.split('\n').filter((l) => l.trim()).length} 行
              </span>
            )}
          </pre>
        )}
        {claudeMdExpanded && !claudeMdContent && !claudeMdLoading && (
          <div style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>
            工作目录下未找到 CLAUDE.md
          </div>
        )}
      </div>
    </div>
  );
}
