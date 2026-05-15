/**
 * CommandPalette — 全局命令面板（Ctrl+K）
 *
 * 功能：
 *   - 模糊搜索所有可用命令
 *   - 键盘导航（↑↓ 选项，Enter 执行，Esc 关闭）
 *   - 分组：导航 / 会话 / 标签 / 视图 / 系统
 *   - 快捷键提示显示
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Zap, Bot, CheckSquare, Package,
  Wrench, BarChart2, Settings, Sun, Moon, Plus, X,
  Keyboard, Terminal, GitBranch, Layers, History,
  BookOpen, Puzzle, Anchor, FileText, MemoryStick,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { NavClick } from '../../utils/nav';

// ── 命令定义 ──────────────────────────────────────────────────────────────────

type CommandCategory =
  | '导航'
  | '标签'
  | '会话'
  | '能力配置'
  | '系统';

interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  icon: React.ElementType;
  shortcut?: string;
  keywords?: string[];          // 额外搜索关键词（别名、拼音首字母等）
  action: () => void;
  danger?: boolean;
}

interface CommandPaletteProps {
  onClose: () => void;
  onNavClick: (id: NavClick) => void;
  onStartSession: () => void;
  onShowShortcuts: () => void;
}

// ── 简易模糊匹配 ─────────────────────────────────────────────────────────────

function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 2;          // 包含则高分
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;       // 字符序列匹配则得分，否则 0
}

function matchCommand(cmd: PaletteCommand, query: string): number {
  if (!query) return 1;
  const targets = [cmd.label, cmd.description ?? '', ...(cmd.keywords ?? [])];
  return Math.max(...targets.map((t) => fuzzyScore(query, t)));
}

// ── 样式常量 ─────────────────────────────────────────────────────────────────

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '12vh',
};

const MODAL_STYLE: React.CSSProperties = {
  width: 560,
  maxWidth: '90vw',
  maxHeight: '65vh',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const INPUT_WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-color)',
};

const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--text-primary)',
  fontSize: 15,
  fontFamily: 'inherit',
};

const LIST_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '6px 0',
};

// ── 组件 ─────────────────────────────────────────────────────────────────────

export function CommandPalette({ onClose, onNavClick, onStartSession, onShowShortcuts }: CommandPaletteProps) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const session = useAppStore((s) => s.session);
  const addTab = useAppStore((s) => s.addTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const tabs = useAppStore((s) => s.tabs);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 导航辅助
  const navigate = useCallback((id: NavClick) => {
    onNavClick(id);
    onClose();
  }, [onNavClick, onClose]);

  // ── 命令表 ──────────────────────────────────────────────────────────────
  const commands = useMemo<PaletteCommand[]>(() => [
    // ─── 导航 ───────────────────────────────────────────────────────────
    {
      id: 'nav-command', label: '指挥中心',
      description: 'Agent 状态看板 + 介入队列',
      category: '导航', icon: LayoutDashboard,
      shortcut: 'Ctrl+1',
      keywords: ['command center', 'home', '首页', 'agent'],
      action: () => navigate('command'),
    },
    {
      id: 'nav-dispatch', label: '委派',
      description: '启动新任务 / 与 Claude 对话',
      category: '导航', icon: Zap,
      shortcut: 'Ctrl+2',
      keywords: ['dispatch', 'launch', 'chat', '对话', '任务'],
      action: () => navigate('dispatch'),
    },
    {
      id: 'nav-agents', label: 'Agents',
      description: 'Worktree 并行会话 + Subagent 定义 + Agent Teams',
      category: '导航', icon: Bot,
      shortcut: 'Ctrl+3',
      keywords: ['agents', 'worktree', 'subagent', 'team'],
      action: () => navigate('agents'),
    },
    {
      id: 'nav-review', label: '审查',
      description: 'Diff 审查 + Plan 审查 + Checkpoint',
      category: '导航', icon: CheckSquare,
      shortcut: 'Ctrl+4',
      keywords: ['review', 'diff', 'plan', 'checkpoint', '变更', '回滚'],
      action: () => navigate('review'),
    },
    {
      id: 'nav-artifacts', label: '产物',
      description: '文件变更 + Git + 会话历史',
      category: '导航', icon: Package,
      shortcut: 'Ctrl+5',
      keywords: ['artifacts', 'git', 'history', '历史', '提交', '分支'],
      action: () => navigate('artifacts'),
    },
    {
      id: 'nav-capabilities', label: '能力配置',
      description: 'Skills / Hooks / MCP / 插件 / Rules / Memory',
      category: '导航', icon: Wrench,
      shortcut: 'Ctrl+6',
      keywords: ['capabilities', 'skills', 'hooks', 'mcp', 'plugins', '规则', '技能'],
      action: () => navigate('capabilities'),
    },
    {
      id: 'nav-monitor', label: '监控',
      description: 'Token 用量 + 成本追踪 + 会话历史',
      category: '导航', icon: BarChart2,
      shortcut: 'Ctrl+7',
      keywords: ['monitor', 'token', 'cost', '费用', '用量'],
      action: () => navigate('monitor'),
    },
    {
      id: 'nav-settings', label: '设置',
      description: '模型 / 认证 / 权限模式 / 主题',
      category: '导航', icon: Settings,
      keywords: ['settings', 'config', '配置', '模型', '认证', 'api key'],
      action: () => navigate('settings'),
    },

    // ─── 标签 ───────────────────────────────────────────────────────────
    {
      id: 'tab-new', label: '新建会话标签',
      description: '在新标签中开启独立对话',
      category: '标签', icon: Plus,
      shortcut: 'Ctrl+T',
      keywords: ['new tab', '新建', 'tab'],
      action: () => { addTab(); onClose(); },
    },
    {
      id: 'tab-close', label: '关闭当前标签',
      description: tabs.length > 1 ? `关闭「${tabs.find((t) => t.id === activeTabId)?.label ?? ''}」` : '只剩一个标签，无法关闭',
      category: '标签', icon: X,
      shortcut: 'Ctrl+W',
      keywords: ['close tab', '关闭'],
      action: () => { if (tabs.length > 1) { closeTab(activeTabId); } onClose(); },
    },

    // ─── 会话 ───────────────────────────────────────────────────────────
    ...(session.isConnected ? [] : [{
      id: 'session-connect', label: '连接 Claude',
      description: '启动 Claude CLI 进程',
      category: '会话' as CommandCategory, icon: Terminal,
      keywords: ['connect', '连接', 'start', 'cli'],
      action: () => { onStartSession(); onClose(); },
    }]),

    // ─── 能力配置快捷跳转 ────────────────────────────────────────────
    {
      id: 'cap-hooks', label: '配置 Hooks',
      description: '打开 Hooks 可视化配置器',
      category: '能力配置', icon: Anchor,
      keywords: ['hooks', 'hook', 'preToolUse', 'postToolUse'],
      action: () => { navigate('capabilities'); },
    },
    {
      id: 'cap-skills', label: '管理 Skills',
      description: '技能库 / CLAUDE.md 编辑',
      category: '能力配置', icon: BookOpen,
      keywords: ['skills', 'claude.md', '技能'],
      action: () => { navigate('capabilities'); },
    },
    {
      id: 'cap-mcp', label: 'MCP 服务器',
      description: 'Model Context Protocol 服务配置',
      category: '能力配置', icon: Layers,
      keywords: ['mcp', 'server', 'model context'],
      action: () => { navigate('capabilities'); },
    },
    {
      id: 'cap-plugins', label: '插件市场',
      description: '安装 / 管理 Claude Code 插件',
      category: '能力配置', icon: Puzzle,
      keywords: ['plugins', 'install', '插件'],
      action: () => { navigate('capabilities'); },
    },
    {
      id: 'cap-memory', label: 'Memory 编辑',
      description: '编辑 CLAUDE.md 记忆文件',
      category: '能力配置', icon: MemoryStick,
      keywords: ['memory', 'claude.md', '记忆', 'CLAUDE.md'],
      action: () => { navigate('capabilities'); },
    },
    {
      id: 'cap-rules', label: '路径规则',
      description: '配置文件路径规则（Rules）',
      category: '能力配置', icon: FileText,
      keywords: ['rules', '规则', 'path'],
      action: () => { navigate('capabilities'); },
    },
    {
      id: 'cap-git', label: 'Git 操作',
      description: '提交 / 分支 / 日志',
      category: '能力配置', icon: GitBranch,
      keywords: ['git', 'commit', 'branch', '分支', '提交'],
      action: () => { navigate('artifacts'); },
    },
    {
      id: 'cap-history', label: '会话历史',
      description: '查看跨重启的历史对话记录',
      category: '能力配置', icon: History,
      keywords: ['history', '历史', 'session'],
      action: () => { navigate('artifacts'); },
    },

    // ─── 系统 ───────────────────────────────────────────────────────────
    {
      id: 'sys-theme', label: theme === 'dark' ? '切换到浅色主题' : '切换到深色主题',
      description: `当前：${theme === 'dark' ? '深色' : '浅色'}`,
      category: '系统', icon: theme === 'dark' ? Sun : Moon,
      keywords: ['theme', 'dark', 'light', '主题', '夜间', '日间'],
      action: () => {
        const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        window.electronAPI?.setNativeTheme?.(next);
        onClose();
      },
    },
    {
      id: 'sys-shortcuts', label: '快捷键一览',
      description: '查看所有键盘快捷键',
      category: '系统', icon: Keyboard,
      shortcut: '?',
      keywords: ['shortcuts', 'keyboard', '快捷键', 'hotkey'],
      action: () => { onShowShortcuts(); onClose(); },
    },
  ], [theme, setTheme, navigate, addTab, closeTab, activeTabId, tabs, session.isConnected, onStartSession, onClose, onShowShortcuts]);

  // ── 过滤 & 排序 ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((cmd) => ({ cmd, score: matchCommand(cmd, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd);
  }, [commands, query]);

  // query 变化时重置高亮到第一项
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // ── 键盘事件 ────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[activeIndex]?.action();
    }
  }, [onClose, filtered, activeIndex]);

  // 高亮项滚动到可视区
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // ── 按分组渲染 ───────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, PaletteCommand[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.category) ?? [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    return map;
  }, [filtered]);

  let flatIndex = 0;  // 跨分组计算全局索引

  return (
    <div
      style={OVERLAY_STYLE}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
    >
      <div style={MODAL_STYLE} onKeyDown={handleKeyDown}>
        {/* 搜索栏 */}
        <div style={INPUT_WRAP_STYLE}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1 }}>⌕</span>
          <input
            ref={inputRef}
            style={INPUT_STYLE}
            placeholder="搜索命令…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}
              aria-label="清空"
            >
              ✕
            </button>
          )}
          <kbd style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 5px' }}>
            ESC
          </kbd>
        </div>

        {/* 命令列表 */}
        <div ref={listRef} style={LIST_STYLE}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              没有匹配的命令
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, cmds]) => (
              <div key={category}>
                {/* 分组标题 */}
                <div style={{
                  padding: '6px 14px 2px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                }}>
                  {category}
                </div>

                {cmds.map((cmd) => {
                  const idx = flatIndex++;
                  const Icon = cmd.icon;
                  const isActive = idx === activeIndex;

                  return (
                    <div
                      key={cmd.id}
                      data-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={cmd.action}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 14px',
                        cursor: 'pointer',
                        background: isActive ? 'var(--accent-color)' : 'transparent',
                        color: isActive ? '#fff' : cmd.danger ? 'var(--error-color)' : 'var(--text-primary)',
                        borderRadius: 0,
                        transition: 'background 0.08s',
                        userSelect: 'none',
                      }}
                    >
                      {/* 图标 */}
                      <Icon size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />

                      {/* 标签 + 描述 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{cmd.label}</div>
                        {cmd.description && (
                          <div style={{
                            fontSize: 11,
                            opacity: isActive ? 0.85 : 0.5,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.3,
                          }}>
                            {cmd.description}
                          </div>
                        )}
                      </div>

                      {/* 快捷键提示 */}
                      {cmd.shortcut && (
                        <kbd style={{
                          fontSize: 10,
                          color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)',
                          background: isActive ? 'rgba(255,255,255,0.15)' : 'var(--bg-tertiary)',
                          border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : 'var(--border-color)'}`,
                          borderRadius: 4,
                          padding: '1px 5px',
                          flexShrink: 0,
                          fontFamily: 'inherit',
                        }}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          padding: '5px 14px',
          display: 'flex',
          gap: 16,
          fontSize: 10,
          color: 'var(--text-tertiary)',
        }}>
          <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> 导航</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>Enter</kbd> 执行</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}
