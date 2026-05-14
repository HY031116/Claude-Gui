/**
 * NavRail — 左侧垂直导航栏（56px 固定宽）
 * 5 个一级导航：对话 / 项目 / 工具 / 配置 / 历史
 * 直接从 Zustand store 读取 activeNavSection / theme，
 * 将 onNavClick 通过 props 传入（handleNavClick 含 toggle 逻辑，保留在 App.tsx）
 */
import { useCallback, useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import {
  Play,
  FolderOpen,
  Wrench,
  Clock,
  Sun,
  Moon,
  Bot,
  ArrowUpCircle,
} from 'lucide-react';
import type { NavClick } from '../../utils/nav';

const NAV_ITEMS: { id: NavClick; label: string; icon: React.ElementType }[] = [
  { id: 'chat', label: '任务', icon: Play },
  { id: 'project', label: '项目', icon: FolderOpen },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'history', label: '历史', icon: Clock },
];

/** 文件修改类工具名称 */
const FILE_MODIFY_TOOLS = new Set([
  'Write', 'write_file',
  'Edit', 'edit_file', 'str_replace_editor', 'str_replace_based_edit_tool',
  'MultiEdit', 'multiedit',
]);

interface NavRailProps {
  onNavClick: (id: NavClick) => void;
}

export function NavRail({ onNavClick }: NavRailProps) {
  const activeNavSection = useAppStore((s) => s.activeNavSection);
  const activeAuxSubPanel = useAppStore((s) => s.activeAuxSubPanel);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const messages = useAppStore((s) => s.messages);

  // 计算本轮会话中文件修改工具调用（成功且未审阅）数量
  const pendingChangesCount = useMemo(() => {
    let count = 0;
    for (const msg of messages) {
      for (const tc of msg.toolCalls ?? []) {
        if (FILE_MODIFY_TOOLS.has(tc.name) && tc.status === 'success' && !tc.diffReviewStatus) {
          count++;
        }
      }
    }
    return count;
  }, [messages]);

  // 判断导航项是否激活（点击已激活则折叠，所以用 activeNavSection 直接匹配）
  const isActive = (id: NavClick): boolean => {
    return activeNavSection === id;
  };

  // 是否显示变更角标（project 且有待处理变更）
  const showChangeBadge = (id: NavClick): boolean => {
    return id === 'project' && pendingChangesCount > 0;
  };

  const handleThemeToggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.electronAPI?.setNativeTheme?.(next);
  }, [theme, setTheme]);

  /** 订阅 autoUpdater 状态，有可用更新时亮角标 */
  const [updateState, setUpdateState] = useState<'available' | 'downloaded' | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;
    return window.electronAPI.onUpdateStatus((s) => {
      if (s.type === 'available') setUpdateState('available');
      else if (s.type === 'downloaded') setUpdateState('downloaded');
      else if (s.type === 'not-available') setUpdateState(null);
    });
  }, []);

  // activeAuxSubPanel 用于 tooltip 显示当前激活子面板（保留以备用）
  void activeAuxSubPanel;

  return (
    <div className="nav-rail">
      {/* 顶部 Logo 区域 */}
      <div className="nav-rail-logo" title="Claude Code GUI">
        <Bot size={20} />
      </div>

      {/* 分割线 */}
      <div className="nav-rail-divider" />

      {/* 主导航按钮 */}
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.id);
        const showBadge = showChangeBadge(item.id);
        return (
          <button
            key={item.id}
            onClick={() => onNavClick(item.id)}
            className={`nav-button ${active ? 'active' : ''}`}
            aria-label={item.label}
            data-tooltip={item.label}
            style={{ position: 'relative' }}
          >
            <Icon size={18} />
            {showBadge && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent)',
                border: '1.5px solid var(--bg-primary)',
              }} />
            )}
          </button>
        );
      })}

      {/* 底部区域（主题切换 + 更新角标） */}
      <div className="nav-rail-spacer" />
      {/* 更新可用时显示更新按钮（跳转至设置面板） */}
      {updateState && (
        <button
          onClick={() => onNavClick('tools')}
          className="nav-button nav-button-update"
          aria-label={updateState === 'downloaded' ? '更新已就绪，点击安装' : '有可用更新，点击查看'}
          data-tooltip={updateState === 'downloaded' ? '重启安装更新' : '发现新版本'}
          style={{ position: 'relative' }}
        >
          <ArrowUpCircle size={16} />
          <span className="nav-update-dot" data-ready={updateState === 'downloaded'} />
        </button>
      )}
      <button
        onClick={handleThemeToggle}
        className="nav-button"
        aria-label={theme === 'dark' ? '切换浅色' : '切换深色'}
        data-tooltip={theme === 'dark' ? '浅色模式' : '深色模式'}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
