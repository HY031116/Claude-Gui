/**
 * Git 服务 — 封装常用 git 命令，供 IPC handler 调用
 * 所有操作基于 spawnSync，保持同步简洁
 */
import { spawnSync, spawn } from 'child_process';
import * as path from 'path';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: string[];
}

export interface GitFile {
  path: string;
  status: string; // 'M' | 'A' | 'D' | 'R' | '?'
}

export interface GitCommitResult {
  success: boolean;
  hash?: string;
  error?: string;
}

function run(args: string[], cwd: string): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout: 10000,
  });
  return {
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    code: result.status ?? 1,
  };
}

/** 获取当前分支名 */
export function getGitBranch(cwd: string): string {
  const r = run(['branch', '--show-current'], cwd);
  return r.code === 0 ? r.stdout : '';
}

/** 获取工作区完整状态 */
export function getGitStatus(cwd: string): GitStatus | null {
  // 确认是 git 仓库
  const checkRepo = run(['rev-parse', '--is-inside-work-tree'], cwd);
  if (checkRepo.code !== 0) return null;

  const branch = getGitBranch(cwd);

  // ahead/behind
  let ahead = 0, behind = 0;
  const ab = run(['rev-list', '--count', '--left-right', '@{u}...HEAD'], cwd);
  if (ab.code === 0 && ab.stdout) {
    const parts = ab.stdout.split('\t');
    if (parts.length === 2) {
      behind = parseInt(parts[0], 10) || 0;
      ahead = parseInt(parts[1], 10) || 0;
    }
  }

  // 解析 git status --porcelain
  const statusOut = run(['status', '--porcelain', '-u'], cwd);
  const staged: GitFile[] = [];
  const unstaged: GitFile[] = [];
  const untracked: string[] = [];

  if (statusOut.code === 0 && statusOut.stdout) {
    for (const line of statusOut.stdout.split('\n')) {
      if (!line) continue;
      const xy = line.slice(0, 2);
      const filePath = line.slice(3).trim();
      const x = xy[0]; // staged 状态
      const y = xy[1]; // unstaged 状态

      if (x === '?' && y === '?') {
        untracked.push(filePath);
        continue;
      }
      if (x !== ' ' && x !== '?') {
        staged.push({ path: filePath, status: x });
      }
      if (y !== ' ' && y !== '?') {
        unstaged.push({ path: filePath, status: y });
      }
    }
  }

  return { branch, ahead, behind, staged, unstaged, untracked };
}

/** 获取文件的 diff（staged 或 unstaged） */
export function getGitDiff(cwd: string, filePath: string, staged: boolean): string {
  const args = staged
    ? ['diff', '--cached', '--', filePath]
    : ['diff', '--', filePath];
  const r = run(args, cwd);
  return r.code === 0 ? r.stdout : '';
}

/** 暂存文件（git add） */
export function gitAdd(cwd: string, files: string[]): { success: boolean; error?: string } {
  const r = run(['add', '--', ...files], cwd);
  return r.code === 0 ? { success: true } : { success: false, error: r.stderr };
}

/** 取消暂存（git restore --staged） */
export function gitUnstage(cwd: string, files: string[]): { success: boolean; error?: string } {
  const r = run(['restore', '--staged', '--', ...files], cwd);
  return r.code === 0 ? { success: true } : { success: false, error: r.stderr };
}

/** 提交（git commit -m） */
export function gitCommit(cwd: string, message: string): GitCommitResult {
  const r = run(['commit', '-m', message], cwd);
  if (r.code !== 0) return { success: false, error: r.stderr };
  // 取最新 commit hash
  const hash = run(['rev-parse', '--short', 'HEAD'], cwd);
  return { success: true, hash: hash.stdout };
}

/** 获取最近 N 条提交日志 */
export function getGitLog(cwd: string, limit = 20): Array<{ hash: string; message: string; date: string; author: string }> {
  const r = run(['log', `--max-count=${limit}`, '--pretty=format:%h\t%s\t%cr\t%an'], cwd);
  if (r.code !== 0 || !r.stdout) return [];
  return r.stdout.split('\n').map((line) => {
    const [hash, message, date, author] = line.split('\t');
    return { hash, message, date, author };
  });
}

/** 检测 cwd 是否在 git 仓库内 */
export function isGitRepo(cwd: string): boolean {
  const r = run(['rev-parse', '--is-inside-work-tree'], cwd);
  return r.code === 0;
}

/** 异步执行 git 命令（用于网络操作如 push/pull），超时 60s */
function runAsync(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr: stderr || '操作超时（60s）', code: 1 });
    }, 60000);
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 1 });
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: e.message, code: 1 });
    });
  });
}

/** 获取远端列表 */
export function getGitRemotes(cwd: string): string[] {
  const r = run(['remote'], cwd);
  if (r.code !== 0 || !r.stdout) return [];
  return r.stdout.split('\n').filter(Boolean);
}

/** 推送到远端（异步，避免阻塞主进程） */
export async function gitPush(
  cwd: string,
  remote = 'origin',
  branch?: string,
  setUpstream = false,
): Promise<{ success: boolean; output?: string; error?: string }> {
  const args: string[] = ['push'];
  if (setUpstream) args.push('-u');
  args.push(remote);
  if (branch) args.push(branch);

  const r = await runAsync(args, cwd);
  // git push 进度信息写到 stderr，成功时 stderr 也可能有内容
  const output = [r.stdout, r.stderr].filter(Boolean).join('\n').trim();
  if (r.code === 0) return { success: true, output };
  return { success: false, error: output || '推送失败' };
}

/** 从远端拉取（异步，避免阻塞主进程） */
export async function gitPull(
  cwd: string,
  remote = 'origin',
  branch?: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  const args: string[] = ['pull'];
  args.push(remote);
  if (branch) args.push(branch);

  const r = await runAsync(args, cwd);
  const output = [r.stdout, r.stderr].filter(Boolean).join('\n').trim();
  if (r.code === 0) return { success: true, output };
  return { success: false, error: output || '拉取失败' };
}

// ===================== Worktree 管理 =====================

export interface WorktreeInfo {
  path: string;         // worktree 绝对路径
  head: string;         // HEAD commit hash
  branch: string;       // 分支名（空字符串代表 detached）
  isMain: boolean;      // 是否为主 worktree（第一个）
  isDetached: boolean;  // 是否处于分离 HEAD 状态
  isLocked: boolean;    // 是否被锁定
}

/** 列出所有 worktree，解析 --porcelain 输出 */
export function listWorktrees(cwd: string): WorktreeInfo[] {
  const r = run(['worktree', 'list', '--porcelain'], cwd);
  if (r.code !== 0 || !r.stdout) return [];

  const results: WorktreeInfo[] = [];
  // 每个 worktree block 以空行分隔
  const blocks = r.stdout.split(/\n\n+/);
  let isFirst = true;

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split('\n');
    const info: WorktreeInfo = {
      path: '',
      head: '',
      branch: '',
      isMain: isFirst,
      isDetached: false,
      isLocked: false,
    };
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        info.path = line.slice('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        info.head = line.slice('HEAD '.length, line.indexOf(' HEAD ') >= 0 ? undefined : undefined).trim();
        // 实际格式：HEAD <hash> （7位或完整hash）
        info.head = line.slice(5).trim();
      } else if (line.startsWith('branch refs/heads/')) {
        info.branch = line.slice('branch refs/heads/'.length).trim();
      } else if (line === 'detached') {
        info.isDetached = true;
      } else if (line.startsWith('locked')) {
        info.isLocked = true;
      }
    }
    if (info.path) {
      results.push(info);
      isFirst = false;
    }
  }
  return results;
}

/**
 * 新建 worktree
 * @param worktreePath  新 worktree 的目录路径（绝对或相对 cwd）
 * @param branch        目标分支名
 * @param createBranch  为 true 时用 -b 创建新分支
 * @param commitIsh     起点（仅 createBranch=true 时有意义），默认 HEAD
 */
export function addWorktree(
  cwd: string,
  worktreePath: string,
  branch: string,
  createBranch: boolean,
  commitIsh = 'HEAD',
): { success: boolean; error?: string } {
  const args: string[] = ['worktree', 'add'];
  if (createBranch) {
    args.push('-b', branch, worktreePath, commitIsh);
  } else {
    args.push(worktreePath, branch);
  }
  const r = run(args, cwd);
  return r.code === 0
    ? { success: true }
    : { success: false, error: r.stderr || r.stdout };
}

/**
 * 删除 worktree
 * @param force  强制删除（即使有未提交变更）
 */
export function removeWorktree(
  cwd: string,
  worktreePath: string,
  force = false,
): { success: boolean; error?: string } {
  const args: string[] = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(worktreePath);
  const r = run(args, cwd);
  return r.code === 0
    ? { success: true }
    : { success: false, error: r.stderr || r.stdout };
}

/** 修剪已不存在路径的 worktree 记录 */
export function pruneWorktrees(cwd: string): { success: boolean; output?: string; error?: string } {
  const r = run(['worktree', 'prune', '-v'], cwd);
  return r.code === 0
    ? { success: true, output: r.stdout }
    : { success: false, error: r.stderr };
}
