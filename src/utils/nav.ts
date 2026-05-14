/**
 * 导航状态转换工具（纯函数）
 * Agent 中心设计 v3.0：8 个场景化导航区域
 */

/**
 * 一级导航区域（Agent 中心范式）
 * - command:      指挥中心（默认首页，Agent 看板 + 介入队列）
 * - dispatch:     委派（对话/任务委派入口，含 Chat + Terminal）
 * - agents:       Agents（舰队管理 + Worktree）
 * - review:       审查（Diff + Plan + Checkpoint）
 * - artifacts:    产物（Git + 历史 + 变更）
 * - capabilities: 能力配置（MCP + Hooks + Skills + Plugins + Rules + Memory）
 * - monitor:      监控（Token + 成本 + 会话历史）
 * - settings:     设置
 */
export type NavSection =
  | 'command'
  | 'dispatch'
  | 'agents'
  | 'review'
  | 'artifacts'
  | 'capabilities'
  | 'monitor'
  | 'settings';

export type NavClick = NavSection;

/** dispatch section 辅助面板默认子标签 */
export const DISPATCH_AUX_DEFAULT = 'files';

/** dispatch 的辅助面板子标签（右侧上下文工具） */
export const DISPATCH_AUX_SUBS = ['files', 'git', 'changes', 'context', 'checkpoints'] as const;

export interface NavTransition {
  /** 新的一级导航区域 */
  section: NavSection;
  /** 新的辅助面板子标签（undefined = 不变） */
  subPanel?: string;
}

/**
 * 根据当前状态 + NavRail 点击 ID，计算下一个导航状态
 *
 * 规则：点击已激活的同一入口 → 跳回指挥中心；否则切换到对应 section。
 */
export function computeNavTransition(
  currentSection: NavSection,
  currentSubPanel: string,
  click: NavClick,
): NavTransition {
  // 点击已激活的 section → 跳回指挥中心
  if (currentSection === click && click !== 'command') {
    return { section: 'command' };
  }

  // 切换到 dispatch 时，保留或初始化辅助面板子标签
  if (click === 'dispatch') {
    const sub = (DISPATCH_AUX_SUBS as readonly string[]).includes(currentSubPanel)
      ? currentSubPanel
      : DISPATCH_AUX_DEFAULT;
    return { section: 'dispatch', subPanel: sub };
  }

  // 其余 section 直接切换，无需 subPanel
  return { section: click };
}
