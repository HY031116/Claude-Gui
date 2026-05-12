/**
 * 导航状态转换工具（纯函数）
 * 从 App.tsx handleNavClick 提取，供测试和多处复用
 */

export type NavSection = 'chat' | 'project' | 'tools' | 'config';
export type NavClick = 'chat' | 'files' | 'changes' | 'tools' | 'config';

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

  // tools / config
  const navId = click as 'tools' | 'config';
  if (currentSection === navId) {
    // 再次点击已激活区域 → 折叠
    return { section: 'chat' };
  }

  const nextSection = navId;
  const validSubs = SECTION_VALID_SUBS[navId];
  const subPanel = validSubs.includes(currentSubPanel)
    ? undefined // 当前 sub 仍然合法，不覆盖
    : SECTION_DEFAULTS[navId];

  return { section: nextSection, subPanel };
}
