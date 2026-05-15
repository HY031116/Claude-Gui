/**
 * web-server.ts
 * Electron 内嵌本地 Web 服务器，让浏览器也能访问完整的 Claude Code GUI。
 * 监听 127.0.0.1:5175，提供：
 *   - GET /*          静态文件服务（从打包的 dist/ 目录）
 *   - GET /api/events SSE 实时推送 CLI 输出
 *   - POST /api/invoke/:channel  代理所有 IPC 调用
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { app, shell } from 'electron';
import type { CliService } from './cli-service';
import type { FileService } from './file-service';
import type { SettingsService } from './settings-service';
import type { CliConfigService } from './cli-config-service';
import {
  getGitStatus, getGitDiff, gitAdd, gitUnstage, gitCommit,
  getGitLog, isGitRepo, getGitBranch, gitPush, gitPull, getGitRemotes,
  listWorktrees, addWorktree, removeWorktree, pruneWorktrees,
} from './git-service';
import { spawnSync, spawn } from 'child_process';

/** Web 服务器监听端口（不与 Vite 5185 冲突） */
export const WEB_PORT = 5175;
const WEB_HOST = '127.0.0.1';

/** MIME 类型映射 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.json': 'application/json',
  '.map':  'application/json',
};

/** 解析请求体 JSON */
function readBody(req: IncomingMessage): Promise<unknown[]> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(body ? (JSON.parse(body) as unknown[]) : []); }
      catch { resolve([]); }
    });
  });
}

/** 发送 JSON 响应 */
function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  const json = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(json);
}

/** 服务层依赖注入容器 */
export interface WebServerServices {
  cliService: CliService;
  fileService: FileService;
  settingsService: SettingsService;
  cliConfigService: CliConfigService;
}

/**
 * 启动内嵌 Web 服务器。
 * 返回服务器实例（可在 app.quit 时手动关闭）。
 */
export function startWebServer(services: WebServerServices): http.Server {
  const { cliService, fileService, settingsService, cliConfigService } = services;

  // ── SSE 客户端列表 ─────────────────────────────────────────────────────────
  const sseClients = new Set<ServerResponse>();

  function broadcastSSE(payload: object): void {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of [...sseClients]) {
      try { client.write(data); }
      catch { sseClients.delete(client); }
    }
  }

  // 订阅 CLI 输出事件 → 广播到所有 SSE 客户端
  cliService.addOutputListener((event) => {
    broadcastSSE({ channel: 'cli:output', payload: event });
  });

  // ── API 路由处理器 ─────────────────────────────────────────────────────────
  async function handleInvoke(
    channel: string,
    args: unknown[],
    res: ServerResponse,
  ): Promise<void> {
    let result: unknown;

    try {
      switch (channel) {
        // ── CLI ──
        case 'cli:start':
          result = cliService.start(args[0] as { cwd: string; args?: string[] });
          break;
        case 'cli:send':
          result = await cliService.send(args[0] as string);
          break;
        case 'cli:stop':
          result = await cliService.stop();
          break;
        case 'cli:sendMessage': {
          const [msg, cwd, sessionId, imagePaths, agentOverride, tabId, extraArgs] = args as [string, string?, string?, string[]?, string?, string?, string[]?];
          result = await cliService.sendMessage(msg, cwd, sessionId, imagePaths, agentOverride, tabId, extraArgs);
          break;
        }
        case 'cli:stopMessage':
          result = await cliService.stopMessage(args[0] as string | undefined);
          break;
        case 'cli:sendToStdin':
          result = await cliService.sendToMessageStdin(args[0] as string);
          break;
        case 'cli:respondPermission':
          result = await cliService.respondPermissionRequest(args[0] as string, args[1] as boolean);
          break;
        case 'cli:history':
          result = await fileService.loadCliHistory();
          break;
        case 'cli:delete-session':
          result = await fileService.deleteCliSession(args[0] as string, args[1] as string);
          break;
        case 'cli:delete-project-sessions':
          result = await fileService.deleteAllCliSessions(args[0] as string);
          break;
        case 'cli:load-messages':
          result = await fileService.loadSessionMessages(args[0] as string, args[1] as string);
          break;
        case 'cli:list-agents':
          result = await cliService.listAgents();
          break;
        case 'cli:doctor':
          result = await cliService.runDoctor();
          break;
        case 'cli:update':
          result = await cliService.runUpdate((args[0] as 'update' | 'upgrade') ?? 'update');
          break;

        // ── 文件系统 ──
        case 'fs:list':
          result = await fileService.listDirectory(args[0] as string);
          break;
        case 'fs:read':
          result = await fileService.readFile(args[0] as string);
          break;
        case 'fs:write':
          result = await fileService.writeFile(args[0] as string, args[1] as string);
          break;
        case 'fs:saveTempImage': {
          const { randomUUID } = await import('crypto');
          const ext = (args[1] as string) ?? 'png';
          const tmpDir = app.getPath('temp');
          const filename = `claude-paste-${randomUUID()}.${ext}`;
          const filePath = path.join(tmpDir, filename);
          const buffer = Buffer.from(args[0] as string, 'base64');
          fs.writeFileSync(filePath, buffer);
          result = { success: true, path: filePath };
          break;
        }
        // Web 模式下文件/目录对话框不可用，降级返回 null
        case 'fs:selectDirectory':
        case 'fs:selectFile':
        case 'dialog:save-file':
          result = { success: true, path: null };
          break;
        // Web 模式下打开编辑器：用系统默认方式尝试
        case 'fs:openInEditor': {
          const filePath = args[0] as string;
          const line = args[1] as number | undefined;
          try {
            const vsArgs = line != null ? ['--goto', `${filePath}:${line}`] : [filePath];
            const { spawn } = await import('child_process');
            const proc = spawn('code', vsArgs, { shell: true, detached: true, stdio: 'ignore' });
            proc.unref();
            result = { success: true };
          } catch (err) {
            result = { success: false, error: String(err) };
          }
          break;
        }

        // ── 设置 ──
        case 'settings:load': {
          const r = settingsService.load();
          if (r.success && r.settings) cliService.setConfig(r.settings);
          result = r;
          break;
        }
        case 'settings:save':
          cliService.setConfig(args[0] as object);
          result = settingsService.save(args[0] as never);
          break;
        case 'theme:set':
          // Web 模式下无 nativeTheme，静默忽略
          result = { success: true };
          break;

        // ── 认证 ──
        case 'auth:status':
          result = { success: true, status: cliService.getAuthStatus() };
          break;
        case 'auth:login':
          result = await cliService.launchOfficialLogin();
          break;

        // ── CLI Config ──
        case 'cli-config:load': {
          const r = cliConfigService.load();
          if (r.success && r.settings) {
            cliService.setConfig({
              model: r.settings.model,
              permissionMode: r.settings.permissions?.mode,
              effortLevel: r.settings.effortLevel,
            });
          }
          result = r;
          break;
        }
        case 'cli-config:save': {
          const settings = args[0] as Record<string, unknown>;
          const r = cliConfigService.save(settings);
          if (r.success) {
            cliService.setConfig({
              model: settings['model'] as string,
              permissionMode: (settings['permissions'] as { mode?: string })?.mode,
              effortLevel: settings['effortLevel'] as string,
            });
          }
          result = r;
          break;
        }
        case 'cli-config:path':
          result = { success: true, path: cliConfigService.getConfigPath() };
          break;

        // ── Git ──
        case 'git:status':
          try { result = { success: true, status: getGitStatus(args[0] as string) }; }
          catch (e) { result = { success: false, error: String(e) }; }
          break;
        case 'git:diff':
          try { result = { success: true, diff: getGitDiff(args[0] as string, args[1] as string, args[2] as boolean) }; }
          catch (e) { result = { success: false, error: String(e) }; }
          break;
        case 'git:add':
          result = await gitAdd(args[0] as string, args[1] as string[]);
          break;
        case 'git:unstage':
          result = await gitUnstage(args[0] as string, args[1] as string[]);
          break;
        case 'git:commit':
          result = await gitCommit(args[0] as string, args[1] as string);
          break;
        case 'git:log':
          try { result = { success: true, log: getGitLog(args[0] as string, (args[1] as number) ?? 20) }; }
          catch (e) { result = { success: false, error: String(e) }; }
          break;
        case 'git:isRepo':
          result = { success: true, isRepo: isGitRepo(args[0] as string) };
          break;
        case 'git:branch':
          result = { success: true, branch: getGitBranch(args[0] as string) };
          break;
        case 'git:remotes':
          result = { success: true, remotes: getGitRemotes(args[0] as string) };
          break;
        case 'git:push':
          result = await gitPush(args[0] as string, args[1] as string, args[2] as string, args[3] as boolean);
          break;
        case 'git:pull':
          result = await gitPull(args[0] as string, args[1] as string, args[2] as string);
          break;
        case 'git:worktree:list':
          try { result = { success: true, worktrees: listWorktrees(args[0] as string) }; }
          catch (e) { result = { success: false, error: String(e) }; }
          break;
        case 'git:worktree:add':
          result = await addWorktree(args[0] as string, args[1] as string, args[2] as string, args[3] as boolean, args[4] as string | undefined);
          break;
        case 'git:worktree:remove':
          result = await removeWorktree(args[0] as string, args[1] as string, args[2] as boolean);
          break;
        case 'git:worktree:prune':
          result = await pruneWorktrees(args[0] as string);
          break;
        case 'git:worktree:fullDiff': {
          const wtPath = args[0] as string;
          const statusResult = spawnSync('git', ['status', '--porcelain', '-u'], { cwd: wtPath, encoding: 'utf-8', timeout: 10000 });
          const changedFiles: string[] = [];
          if (statusResult.status === 0 && statusResult.stdout) {
            for (const line of statusResult.stdout.split('\n')) {
              if (!line.trim()) continue;
              changedFiles.push(line.slice(3).trim());
            }
          }
          const diffResult = spawnSync('git', ['diff', 'HEAD'], { cwd: wtPath, encoding: 'utf-8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
          result = { success: true, diff: diffResult.status === 0 ? diffResult.stdout ?? '' : '', changedFiles };
          break;
        }

        // ── 通知（Web 模式通过 SSE 转发给前端 transport 处理）──
        case 'notify:send':
          broadcastSSE({ channel: 'notify:send', payload: { title: args[0], body: args[1], tabId: args[2] } });
          result = { success: true };
          break;

        // ── Claude-Mem ──
        case 'mem:check':
          result = await fileService.checkClaudeMemStatus();
          break;
        case 'mem:search':
          result = await fileService.searchClaudeMem(args[0] as string | undefined, args[1] as object);
          break;
        case 'mem:timeline':
          result = await fileService.timelineClaudeMem(args[0] as object);
          break;
        case 'mem:get_observations':
          result = await fileService.getObservationsClaudeMem(args[0] as number[], (args[1] as object) ?? {});
          break;

        // ── 自定义 Agent ──
        case 'agent:list':
          result = await fileService.listCustomAgents();
          break;
        case 'agent:write':
          result = await fileService.writeCustomAgent(args[0] as string, args[1] as Parameters<FileService['writeCustomAgent']>[1]);
          break;
        case 'agent:delete':
          result = await fileService.deleteCustomAgent(args[0] as string);
          break;

        // ── Plugin ──
        case 'plugin:list':
          result = await fileService.listInstalledPlugins();
          break;
        case 'plugin:toggle':
          result = await fileService.togglePlugin(args[0] as string, args[1] as boolean);
          break;
        case 'plugin:install':
          result = await cliService.installPlugin(args[0] as string);
          break;
        case 'plugin:uninstall':
          result = await cliService.uninstallPlugin(args[0] as string);
          break;

        // ── 会话持久化 ──
        case 'session:save':
          result = await fileService.saveSession(args[0] as Parameters<FileService['saveSession']>[0]);
          break;
        case 'session:list':
          result = await fileService.listSessions();
          break;
        case 'session:load':
          result = await fileService.loadSession(args[0] as string);
          break;
        case 'session:delete':
          result = await fileService.deleteSession(args[0] as string);
          break;

        // ── Hook 测试（内联实现 spawn）──
        case 'hook:test': {
          const [hookCmd, hookCwd, envVars] = args as [string, string, Record<string, string>];
          const start = Date.now();
          const mergedEnv = { ...process.env, ...envVars };
          const isWin = process.platform === 'win32';
          const hookShell = isWin ? 'cmd.exe' : '/bin/sh';
          const hookShellArgs = isWin ? ['/c', hookCmd] : ['-c', hookCmd];
          result = await new Promise<object>((resolve) => {
            let stdout = ''; let stderr = ''; let finished = false;
            const child = spawn(hookShell, hookShellArgs, {
              cwd: hookCwd || process.env.HOME || '/',
              env: mergedEnv,
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
            child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
            const timer = setTimeout(() => {
              if (!finished) { finished = true; child.kill(); resolve({ success: false, stdout, stderr, exitCode: null, durationMs: Date.now() - start, error: '超时30s' }); }
            }, 30_000);
            child.on('close', (code: number | null) => {
              if (finished) return; finished = true; clearTimeout(timer);
              resolve({ success: code === 0, stdout, stderr, exitCode: code, durationMs: Date.now() - start });
            });
            child.on('error', (err: Error) => {
              if (finished) return; finished = true; clearTimeout(timer);
              resolve({ success: false, stdout, stderr, exitCode: null, durationMs: Date.now() - start, error: err.message });
            });
          });
          break;
        }

        // ── 更新（Web 模式降级：打开 GitHub Releases 页面）──
        case 'update:check':
        case 'update:download':
          await shell.openExternal('https://github.com/HY031116/Claude-Gui/releases');
          result = { success: true };
          break;

        default:
          sendJson(res, { success: false, error: `未知的 channel: ${channel}` }, 404);
          return;
      }
    } catch (err) {
      sendJson(res, { success: false, error: String(err) }, 500);
      return;
    }

    sendJson(res, result);
  }

  // ── HTTP 服务器 ─────────────────────────────────────────────────────────────
  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const urlStr = req.url ?? '/';
    const url = new URL(urlStr, `http://${WEB_HOST}:${WEB_PORT}`);

    // 只允许本地访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── SSE 端点 ──
    if (url.pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': connected\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // ── API invoke 端点 ──
    if (url.pathname.startsWith('/api/invoke/') && req.method === 'POST') {
      const channel = url.pathname.slice('/api/invoke/'.length);
      const args = await readBody(req);
      await handleInvoke(channel, args, res);
      return;
    }

    // ── 静态文件服务 ──
    if (req.method === 'GET') {
      const distDir = path.join(app.getAppPath(), 'dist');
      let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);

      // 路径安全检查：防止目录穿越
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      // 文件不存在时，对于非资源路径，回退到 index.html（SPA 路由）
      if (!fs.existsSync(filePath)) {
        const ext = path.extname(url.pathname);
        if (!ext || ext === '.html') {
          filePath = path.join(distDir, 'index.html');
        } else {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
      }

      try {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(content);
      } catch {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    res.writeHead(405);
    res.end('Method Not Allowed');
  });

  server.listen(WEB_PORT, WEB_HOST, () => {
    console.log(`[WebServer] 本地 Web 服务运行中 → http://${WEB_HOST}:${WEB_PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[WebServer] 端口 ${WEB_PORT} 已被占用，Web 模式不可用`);
    } else {
      console.error('[WebServer] 启动失败：', err.message);
    }
  });

  return server;
}
