/**
 * Git 服务 — 封装常用 git 命令，供 IPC handler 调用
 * 所有操作基于 spawnSync，保持同步简洁
 */
import { spawnSync } from 'child_process';
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
