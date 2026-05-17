/**
 * NavRail — 左侧垂直导航栏（56px 固定宽）
 * Agent 中心设计 v4.0：8 个场景化导航区域 + 顶部工作区切换器
 * 执行类（指挥/委派/Agents）→ 控制类（审查/产物）→ 配置类（能力/监控）→ 设置
 */
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
  Plus,
  Check,
  FolderOpen,
  Layers,
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

  // 工作区相关状态
  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspacePath = useAppStore((s) => s.activeWorkspacePath);
  const switchWorkspace = useAppStore((s) => s.switchWorkspace);
  const createWorkspace = useAppStore((s) => s.createWorkspace);
  const removeWorkspace = useAppStore((s) => s.removeWorkspace);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  // 工作区切换器 Popover 状态
  const [wsPopoverOpen, setWsPopoverOpen] = useState(false);
  const [wsNewName, setWsNewName] = useState('');
  const [wsCreating, setWsCreating] = useState(false);
  const wsPopoverRef = useRef<HTMLDivElement>(null);
  const wsButtonRef = useRef<HTMLButtonElement>(null);

  // 点击 Popover 外部关闭
  useEffect(() => {
    if (!wsPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (wsPopoverRef.current?.contains(e.target as Node)) return;
      if (wsButtonRef.current?.contains(e.target as Node)) return;
      setWsPopoverOpen(false);
      setWsCreating(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [wsPopoverOpen]);

  /** 当前工作区对象 */
  const activeWorkspace = workspaces.find((w) => w.path === activeWorkspacePath);
  /** 当前工作区显示缩写（2个汉字或英文首字母） */
  const wsAbbr = useMemo(() => {
    const name = activeWorkspace?.name || '全部';
    // 汉字取前2个，否则取首字母大写
    const hanzi = name.match(/[\u4e00-\u9fa5]/g);
    if (hanzi && hanzi.length >= 1) return hanzi.slice(0, 2).join('');
    return name.slice(0, 2).toUpperCase();
  }, [activeWorkspace]);

  // 工作区选择目录（Electron 环境）
  const [wsSelectedPath, setWsSelectedPath] = useState('');
  const handlePickDir = async () => {
    if (typeof window.electronAPI?.selectDirectory === 'function') {
      const res = await window.electronAPI.selectDirectory();
      if (res.success && res.path) {
        setWsSelectedPath(res.path);
        // 自动用目录名填充工作区名称（如果用户还没输入名称）
        if (!wsNewName) {
          const dirName = res.path.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() ?? '';
          setWsNewName(dirName);
        }
      }
    }
  };
  const fmtRelTime = (ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 1) return '刚刚';
    if (hr < 1) return `${min}分前`;
    if (day < 1) return `${hr}小时前`;
    return `${day}天前`;
  };

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
      {/* 工作区切换器（替代原 Logo） */}
      <div style={{ position: 'relative' }}>
        <button
          ref={wsButtonRef}
          className="nav-rail-logo nav-ws-trigger"
          title={activeWorkspace ? `工作区：${activeWorkspace.name}` : '工作区管理'}
          data-tooltip={activeWorkspace ? `工作区：${activeWorkspace.name}` : '工作区管理'}
          onClick={() => setWsPopoverOpen((v) => !v)}
          style={{ cursor: 'pointer' }}
        >
          {activeWorkspace ? (
            <span className="nav-ws-abbr">{wsAbbr}</span>
          ) : (
            <Layers size={18} />
          )}
        </button>

        {/* 工作区 Popover */}
        {wsPopoverOpen && (
          <div ref={wsPopoverRef} className="nav-ws-popover">
            <div className="nav-ws-popover-header">
              <Layers size={12} />
              <span>工作区</span>
            </div>

            {/* 工作区列表 */}
            <div className="nav-ws-list">
              {/* "全部" 选项（不隔离 tabs） */}
              <button
                className={`nav-ws-item${!activeWorkspace ? ' active' : ''}`}
                onClick={() => { setActiveWorkspace(''); setWsPopoverOpen(false); }}
              >
                <span className="nav-ws-item-icon"><Bot size={12} /></span>
                <span className="nav-ws-item-name">全部会话</span>
                {!activeWorkspace && <Check size={11} className="nav-ws-item-check" />}
              </button>

              {workspaces.map((ws) => (
                <div key={ws.id} className={`nav-ws-item-row${ws.path === activeWorkspacePath ? ' active' : ''}`}>
                  <button
                    className="nav-ws-item"
                    onClick={() => { switchWorkspace(ws.id); setWsPopoverOpen(false); }}
                  >
                    <span className="nav-ws-item-icon nav-ws-item-abbr">
                      {(() => {
                        const hanzi = ws.name.match(/[\u4e00-\u9fa5]/g);
                        return hanzi && hanzi.length >= 1 ? hanzi.slice(0, 2).join('') : ws.name.slice(0, 2).toUpperCase();
                      })()}
                    </span>
                    <span className="nav-ws-item-info">
                      <span className="nav-ws-item-name">{ws.name}</span>
                      <span className="nav-ws-item-sub" title={ws.path || ''}>
                        {ws.path ? ws.path.replace(/\\/g, '/').split('/').slice(-2).join('/') : '未绑定目录'}
                        {ws.lastUsed ? ` · ${fmtRelTime(ws.lastUsed)}` : ''}
                      </span>
                    </span>
                    {ws.path === activeWorkspacePath && <Check size={11} className="nav-ws-item-check" />}
                  </button>
                  <button
                    className="nav-ws-item-del"
                    title="移除工作区"
                    onClick={(e) => { e.stopPropagation(); removeWorkspace(ws.id); }}
                  >×</button>
                </div>
              ))}
            </div>

            {/* 新建工作区 */}
            <div className="nav-ws-popover-footer">
              {wsCreating ? (
                <div className="nav-ws-create-row">
                  <input
                    autoFocus
                    className="nav-ws-create-input"
                    placeholder="工作区名称"
                    value={wsNewName}
                    onChange={(e) => setWsNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && wsNewName.trim()) {
                        createWorkspace(wsNewName.trim(), wsSelectedPath);
                        setWsNewName(''); setWsSelectedPath(''); setWsCreating(false); setWsPopoverOpen(false);
                      } else if (e.key === 'Escape') {
                        setWsCreating(false); setWsNewName(''); setWsSelectedPath('');
                      }
                      e.stopPropagation();
                    }}
                  />
                  {typeof window.electronAPI?.selectDirectory === 'function' && (
                    <button
                      className="nav-ws-create-dir-btn"
                      title={wsSelectedPath || '选择目录'}
                      onClick={handlePickDir}
                    >
                      <FolderOpen size={11} />
                    </button>
                  )}
                  <button
                    className="nav-ws-create-confirm"
                    disabled={!wsNewName.trim()}
                    onClick={() => {
                      if (wsNewName.trim()) {
                        createWorkspace(wsNewName.trim(), wsSelectedPath);
                        setWsNewName(''); setWsSelectedPath(''); setWsCreating(false); setWsPopoverOpen(false);
                      }
                    }}
                  ><Check size={11} /></button>
                </div>
              ) : (
                <button className="nav-ws-create-btn" onClick={() => setWsCreating(true)}>
                  <Plus size={11} />
                  新建工作区
                </button>
              )}
            </div>
          </div>
        )}
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


