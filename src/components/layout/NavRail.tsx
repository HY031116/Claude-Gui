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
  Wrench,
  Settings,
  History,
  Sun,
  Moon,
} from 'lucide-react';

type NavSection = 'chat' | 'project' | 'tools' | 'config' | 'history';

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ElementType }[] = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'project', label: '项目', icon: FolderOpen },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'config', label: '配置', icon: Settings },
  { id: 'history', label: '历史', icon: History },
];

interface NavRailProps {
  onNavClick: (id: NavSection) => void;
}

export function NavRail({ onNavClick }: NavRailProps) {
  const activeNavSection = useAppStore((s) => s.activeNavSection) as NavSection;
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const handleThemeToggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.electronAPI?.setNativeTheme?.(next);
  }, [theme, setTheme]);

  return (
    <div
      style={{
        width: 56,
        background: 'rgba(7, 7, 20, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        gap: 4,
        flexShrink: 0,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeNavSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavClick(item.id)}
            title={item.label}
            className={`nav-button ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} />
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      {/* 暗/亮主题切换 */}
      <button
        onClick={handleThemeToggle}
        title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
        className="nav-button"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
