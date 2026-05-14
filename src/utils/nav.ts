/**
 * 导航状态转换工具（纯函数）
 * 从 App.tsx handleNavClick 提取，供测试和多处复用
 */

export type NavSection = 'chat' | 'project' | 'tools' | 'config' | 'history';
export type NavClick = 'chat' | 'project' | 'tools' | 'config' | 'history';

/** tools/config/history 展开时默认激活的子标签 */
export const SECTION_DEFAULTS: Record<'tools' | 'config' | 'history', string> = {
  tools: 'mcp',
  config: 'settings',
  history: 'sessions',
};

/** 各 section 合法子标签 */
export const SECTION_VALID_SUBS: Record<'project' | 'tools' | 'config' | 'history', string[]> = {
  project: ['files', 'git', 'changes', 'context', 'worktrees', 'checkpoints'],
  tools: ['mcp', 'agents', 'plugins', 'hooks', 'skills', 'tasks'],
  config: ['settings', 'rules', 'claude-md', 'mem', 'cost'],
  history: ['sessions', 'cost', 'mem-search'],
};

export interface NavTransition {
  /** 新的一级导航区域 */
  section: NavSection;
  /** 新的子标签（undefined = 不变） */
  subPanel?: string;
}

/**
 * 根据当前导航状态 + NavRail 点击 ID，计算下一个状态
 *
 * 规则：点击已激活的同一入口 → 折叠回 chat；否则展开对应 section。
 *
 * @param currentSection  当前 activeNavSection
 * @param currentSubPanel 当前 activeAuxSubPanel
 * @param click           NavRail 按钮 ID
 * @returns 需要更新的状态（section 始终返回，subPanel 仅在需要变更时返回）
 */
export function computeNavTransition(
  currentSection: NavSection,
  currentSubPanel: string,
  click: NavClick,
): NavTransition {
  if (click === 'chat') {
    return { section: 'chat' };
  }

  // 点击已激活的 section → 折叠
  if (currentSection === click) {
    return { section: 'chat' };
  }

  // 切换到新 section，需要给出默认子标签
  if (click === 'project') {
    const sub = SECTION_VALID_SUBS.project.includes(currentSubPanel)
      ? currentSubPanel
      : 'files';
    return { section: 'project', subPanel: sub };
  }

  if (click === 'tools') {
    const sub = SECTION_VALID_SUBS.tools.includes(currentSubPanel)
      ? currentSubPanel
      : SECTION_DEFAULTS.tools;
    return { section: 'tools', subPanel: sub };
  }

  if (click === 'config') {
    const sub = SECTION_VALID_SUBS.config.includes(currentSubPanel)
      ? currentSubPanel
      : SECTION_DEFAULTS.config;
    return { section: 'config', subPanel: sub };
  }

  if (click === 'history') {
    const sub = SECTION_VALID_SUBS.history.includes(currentSubPanel)
      ? currentSubPanel
      : SECTION_DEFAULTS.history;
    return { section: 'history', subPanel: sub };
  }

  return { section: 'chat' };
}
