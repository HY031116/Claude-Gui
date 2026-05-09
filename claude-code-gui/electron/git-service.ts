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
