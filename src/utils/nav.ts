/**
 * 导航状态转换工具（纯函数）
 * 从 App.tsx handleNavClick 提取，供测试和多处复用
 */

export type NavSection = 'chat' | 'project' | 'tools' | 'config';
export type NavClick = 'chat' | 'files' | 'changes' | 'settings';

/** tools/config 展开时默认激活的子标签 */
export const SECTION_DEFAULTS: Record<'tools' | 'config', string> = {
  tools: 'mcp',
  config: 'settings',
};

/** tools/config 合法子标签（切换 section 时避免残留旧 sub 值） */
export const SECTION_VALID_SUBS: Record<'tools' | 'config', string[]> = {
  tools: ['mcp', 'agents', 'plugins', 'hooks', 'skills', 'tasks'],
  config: ['settings', 'rules', 'claude-md', 'mem', 'cost'],
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

  if (click === 'files') {
    // 已激活 → 折叠回 chat；否则直达 project/files
    if (currentSection === 'project' && currentSubPanel === 'files') {
      return { section: 'chat' };
    }
    return { section: 'project', subPanel: 'files' };
  }

  if (click === 'changes') {
    // 已激活 → 折叠回 chat；否则直达 project/changes
    if (currentSection === 'project' && currentSubPanel === 'changes') {
      return { section: 'chat' };
    }
    return { section: 'project', subPanel: 'changes' };
  }

  // settings：合并 tools + config，点击循环 tools → config → chat
  if (currentSection === 'tools') {
    // tools 已激活 → 切到 config
    const sub = SECTION_VALID_SUBS.config.includes(currentSubPanel)
      ? undefined
      : SECTION_DEFAULTS.config;
    return { section: 'config', subPanel: sub };
  }
  if (currentSection === 'config') {
    // config 已激活 → 折叠
    return { section: 'chat' };
  }
  // 其他状态 → 进入 tools
  const sub = SECTION_VALID_SUBS.tools.includes(currentSubPanel)
    ? undefined
    : SECTION_DEFAULTS.tools;
  return { section: 'tools', subPanel: sub };
}
