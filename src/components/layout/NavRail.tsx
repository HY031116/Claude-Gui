/**
 * NavRail — 左侧垂直导航栏（56px 固定宽）
 * 直接从 Zustand store 读取 activeNavSection / theme，
 * 将 onNavClick 通过 props 传入（handleNavClick 含 toggle 逻辑，保留在 App.tsx）
 */
import { useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import {
  MessageSquare,
  FolderOpen,
  GitCommit,
  Wrench,
  Settings,
  Sun,
  Moon,
  Bot,
} from 'lucide-react';

// NavClick：NavRail 可展发的点击 id（包含快捷入口 files/changes）
type NavClick = 'chat' | 'files' | 'changes' | 'tools' | 'config';

const NAV_ITEMS: { id: NavClick; label: string; icon: React.ElementType }[] = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'files', label: '文件', icon: FolderOpen },
  { id: 'changes', label: '变更', icon: GitCommit },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'config', label: '配置', icon: Settings },
];

interface NavRailProps {
  onNavClick: (id: NavClick) => void;
}

export function NavRail({ onNavClick }: NavRailProps) {
  const activeNavSection = useAppStore((s) => s.activeNavSection);
  const activeAuxSubPanel = useAppStore((s) => s.activeAuxSubPanel);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  // 判断导航项是否激活（files/changes 需要匹配 project 子面板状态）
  const isActive = (id: NavClick): boolean => {
    if (id === 'files') return activeNavSection === 'project' && activeAuxSubPanel === 'files';
    if (id === 'changes') return activeNavSection === 'project' && activeAuxSubPanel === 'changes';
    return activeNavSection === id;
  };

  const handleThemeToggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.electronAPI?.setNativeTheme?.(next);
  }, [theme, setTheme]);

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
        return (
          <button
            key={item.id}
            onClick={() => onNavClick(item.id)}
            className={`nav-button ${active ? 'active' : ''}`}
            aria-label={item.label}
            data-tooltip={item.label}
          >
            <Icon size={18} />
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* 暗/亮主题切换 */}
      <button
        onClick={handleThemeToggle}
        className="nav-button"
        aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
        data-tooltip={theme === 'dark' ? '亮色主题' : '暗色主题'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
