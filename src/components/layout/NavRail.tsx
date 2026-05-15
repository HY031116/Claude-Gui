/**
 * NavRail — 左侧垂直导航栏（56px 固定宽）
 * Agent 中心设计 v3.0：8 个场景化导航区域
 * 执行类（指挥/委派/Agents）→ 控制类（审查/产物）→ 配置类（能力/监控）→ 设置
 */
import { useCallback, useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import {
  LayoutDashboard,
  Zap,
  Bot,
  CheckSquare,
  Package,
  Wrench,
  BarChart2,
  Settings,
  Sun,
  Moon,
  ArrowUpCircle,
  Globe,
} from 'lucide-react';
import type { NavSection, NavClick } from '../../utils/nav';

/** 导航项定义 */
interface NavItem {
  id: NavClick;
  label: string;
  icon: React.ElementType;
  group?: 'exec' | 'control' | 'config'; // 分组，用于渲染分隔线
}

const NAV_ITEMS: NavItem[] = [
  // 执行类
  { id: 'command', label: '指挥中心', icon: LayoutDashboard, group: 'exec' },
  { id: 'dispatch', label: '委派', icon: Zap, group: 'exec' },
  { id: 'agents', label: 'Agents', icon: Bot, group: 'exec' },
  // 控制类
  { id: 'review', label: '审查', icon: CheckSquare, group: 'control' },
  { id: 'artifacts', label: '产物', icon: Package, group: 'control' },
  // 配置类
  { id: 'capabilities', label: '能力配置', icon: Wrench, group: 'config' },
  { id: 'monitor', label: '监控', icon: BarChart2, group: 'config' },
];

/** 文件修改类工具名称（用于计算待审查数量） */
const FILE_MODIFY_TOOLS = new Set([
  'Write', 'write_file',
  'Edit', 'edit_file', 'str_replace_editor', 'str_replace_based_edit_tool',
  'MultiEdit', 'multiedit',
]);

interface NavRailProps {
  onNavClick: (id: NavClick) => void;
}

export function NavRail({ onNavClick }: NavRailProps) {
  const activeNavSection = useAppStore((s) => s.activeNavSection) as NavSection;
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const messages = useAppStore((s) => s.messages);
  const processingTabs = useAppStore((s) => s.processingTabs);
  const tokenUsage = useAppStore((s) => s.tokenUsage);

  // 计算待审查变更数量（未审阅的文件修改工具调用）
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

  // 处理中 Agent 数量
  const processingAgentCount = useMemo(
    () => Object.values(processingTabs).filter(Boolean).length,
    [processingTabs],
  );
  const hasProcessingAgent = processingAgentCount > 0;

  // token 高用量警告（超过 100k 时）
  const tokenHighUsage = useMemo(() => {
    if (!tokenUsage) return false;
    return (tokenUsage.inputTokens + tokenUsage.outputTokens) > 100_000;
  }, [tokenUsage]);

  const handleThemeToggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.electronAPI?.setNativeTheme?.(next);
  }, [theme, setTheme]);

  /** 订阅 autoUpdater 状态 */
  const [updateState, setUpdateState] = useState<'available' | 'downloaded' | null>(null);
  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;
    return window.electronAPI.onUpdateStatus((s) => {
      if (s.type === 'available') setUpdateState('available');
      else if (s.type === 'downloaded') setUpdateState('downloaded');
      else if (s.type === 'not-available') setUpdateState(null);
    });
  }, []);

  /** 渲染单个导航按钮 */
  const renderNavButton = (item: NavItem) => {
    const Icon = item.icon;
    const active = activeNavSection === item.id;

    // 各按钮的徽章逻辑
    let badge: React.ReactNode = null;
    if (item.id === 'command' && hasProcessingAgent) {
      // 指挥中心：显示活跃 agent 数量（多于1个时才显示数字，否则只显示脉冲点）
      badge = processingAgentCount > 1 ? (
        <span style={{
          position: 'absolute', top: 4, right: 2,
          minWidth: 14, height: 14,
          borderRadius: 7, padding: '0 2px',
          background: '#3b82f6',
          border: '1.5px solid var(--bg-primary)',
          color: '#fff', fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {processingAgentCount > 9 ? '9+' : processingAgentCount}
        </span>
      ) : (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 7, height: 7, borderRadius: '50%',
          background: '#3b82f6',
          border: '1.5px solid var(--bg-primary)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      );
    } else if (item.id === 'dispatch' && hasProcessingAgent) {
      // 委派视图：处理中脉冲点
      badge = (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 7, height: 7, borderRadius: '50%',
          background: '#3b82f6',
          border: '1.5px solid var(--bg-primary)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      );
    } else if (item.id === 'review' && pendingChangesCount > 0) {
      // 待审查：红色数字徽章
      badge = (
        <span style={{
          position: 'absolute', top: 4, right: 2,
          minWidth: 14, height: 14,
          borderRadius: 7, padding: '0 2px',
          background: '#ef4444',
          border: '1.5px solid var(--bg-primary)',
          color: '#fff', fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}>
          {pendingChangesCount > 9 ? '9+' : pendingChangesCount}
        </span>
      );
    } else if (item.id === 'monitor' && tokenHighUsage) {
      // 监控：token 高用量橙色警告点
      badge = (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 7, height: 7, borderRadius: '50%',
          background: '#f59e0b',
          border: '1.5px solid var(--bg-primary)',
        }} />
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => onNavClick(item.id)}
        className={`nav-button${active ? ' active' : ''}`}
        aria-label={item.label}
        data-tooltip={item.label}
        style={{ position: 'relative' }}
      >
        <Icon size={18} />
        {badge}
      </button>
    );
  };

  return (
    <div className="nav-rail">
      {/* 顶部 Logo */}
      <div className="nav-rail-logo" title="Claude Code GUI">
        <Bot size={20} />
      </div>

      <div className="nav-rail-divider" />

      {/* 执行类导航 */}
      {NAV_ITEMS.filter((i) => i.group === 'exec').map(renderNavButton)}

      <div className="nav-rail-divider" />

      {/* 控制类导航 */}
      {NAV_ITEMS.filter((i) => i.group === 'control').map(renderNavButton)}

      <div className="nav-rail-divider" />

      {/* 配置类导航 */}
      {NAV_ITEMS.filter((i) => i.group === 'config').map(renderNavButton)}

      {/* 底部弹性空间 */}
      <div className="nav-rail-spacer" />

      {/* 更新按钮 */}
      {updateState && (
        <button
          onClick={() => onNavClick('settings')}
          className="nav-button nav-button-update"
          aria-label={updateState === 'downloaded' ? '更新已就绪，点击安装' : '有可用更新，点击查看'}
          data-tooltip={updateState === 'downloaded' ? '重启安装更新' : '发现新版本'}
          style={{ position: 'relative' }}
        >
          <ArrowUpCircle size={16} />
          <span className="nav-update-dot" data-ready={updateState === 'downloaded'} />
        </button>
      )}

      {/* 在浏览器中打开（仅原生 Electron 环境显示，Web 模式下 openInBrowser 为 undefined） */}
      {typeof window.electronAPI?.openInBrowser === 'function' && (
        <button
          onClick={() => window.electronAPI?.openInBrowser?.()}
          className="nav-button"
          aria-label="在浏览器中打开"
          data-tooltip="在浏览器中打开 Web 版"
        >
          <Globe size={16} />
        </button>
      )}

      {/* 设置按鈕（置底） */}
      <button
        onClick={() => onNavClick('settings')}
        className={`nav-button${activeNavSection === 'settings' ? ' active' : ''}`}
        aria-label="设置"
        data-tooltip="设置"
      >
        <Settings size={16} />
      </button>

      {/* 主题切换 */}
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


