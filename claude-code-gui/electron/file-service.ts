import fs from 'fs/promises';
import * as fsSync from 'fs';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modified: string;
}

/** CLI 历史会话记录（从 ~/.claude/projects/ 读取） */
export interface CliSessionRecord {
  sessionId: string;
  /** 第一条用户消息（预览） */
  preview: string;
  /** 对话开始时间戳（ms） */
  startedAt: number;
  /** 文件最后修改时间戳（ms，近似 lastMessageAt） */
  lastMessageAt: number;
  /** 项目目录原始名（用于展示，如 d--My-Project-claude） */
  projectDirName: string;
}

export class FileService {
  async listDirectory(dirPath: string): Promise<{ success: boolean; entries?: DirEntry[]; error?: string }> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result: DirEntry[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        let type: DirEntry['type'] = 'file';
        if (entry.isDirectory()) type = 'directory';
        else if (entry.isSymbolicLink()) type = 'symlink';

        let size = 0;
        let modified = '';
        try {
          const stat = await fs.stat(fullPath);
          size = stat.size;
          modified = stat.mtime.toISOString();
        } catch {
          // ignore stat errors for broken symlinks etc
        }

        result.push({ name: entry.name, path: fullPath, type, size, modified });
      }

      result.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });

      return { success: true, entries: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 读取 Claude CLI 历史会话列表（~/.claude/projects/ 下所有 .jsonl 文件）
   * 每个文件的第一条 queue-operation/enqueue 行包含用户第一条消息和时间戳
   */
  async loadCliHistory(): Promise<{ success: boolean; sessions?: CliSessionRecord[]; error?: string }> {
    try {
      const projectsDir = path.join(os.homedir(), '.claude', 'projects');
      let projectDirs: string[];
      try {
        projectDirs = await fs.readdir(projectsDir);
      } catch {
        // ~/.claude/projects 不存在
        return { success: true, sessions: [] };
      }

      const sessions: CliSessionRecord[] = [];
      /** 每个项目最多读取的会话数（按 mtime 倒序取最近的） */
      const MAX_SESSIONS_PER_PROJECT = 50;

      for (const dirName of projectDirs) {
        const dirPath = path.join(projectsDir, dirName);
        let files: string[];
        try {
          const entries = await fs.readdir(dirPath);
          files = entries.filter((f) => f.endsWith('.jsonl'));
        } catch {
          continue;
        }

        // 文件太多时，先 stat 取 mtime，只处理最近 MAX_SESSIONS_PER_PROJECT 个
        if (files.length > MAX_SESSIONS_PER_PROJECT) {
          const withMtime = await Promise.all(
            files.map(async (f) => {
              try {
                const s = await fs.stat(path.join(dirPath, f));
                return { f, mtime: s.mtime.getTime() };
              } catch {
                return { f, mtime: 0 };
              }
            }),
          );
          withMtime.sort((a, b) => b.mtime - a.mtime);
          files = withMtime.slice(0, MAX_SESSIONS_PER_PROJECT).map((x) => x.f);
        }

        for (const file of files) {
          const sessionId = file.replace(/\.jsonl$/, '');
          const filePath = path.join(dirPath, file);
          try {
            const stat = await fs.stat(filePath);
            // 只读取前 8KB，足够找到第一条用户消息
            const fd = await fs.open(filePath, 'r');
            const buf = Buffer.alloc(8192);
            const { bytesRead } = await fd.read(buf, 0, 8192, 0);
            await fd.close();
            const head = buf.toString('utf-8', 0, bytesRead);

            let preview = '';
            let startedAt = stat.mtime.getTime();

            for (const line of head.split('\n')) {
              if (!line.trim()) continue;
              try {
                const obj = JSON.parse(line);
                if (obj.type === 'queue-operation' && obj.operation === 'enqueue' && typeof obj.content === 'string') {
                  preview = obj.content.slice(0, 100);
                  if (obj.timestamp) startedAt = new Date(obj.timestamp).getTime();
                  break;
                }
              } catch {
                // 忽略解析失败的行
              }
            }

            sessions.push({
              sessionId,
              preview,
              startedAt,
              lastMessageAt: stat.mtime.getTime(),
              projectDirName: dirName,
            });
          } catch {
            // 忽略单个文件读取错误
          }
        }
      }

      // 按最后修改时间倒序排列
      sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

      return { success: true, sessions };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 读取指定会话的完整消息记录（~/.claude/projects/{projectDirName}/{sessionId}.jsonl）
   * 解析 stream-json 格式，重建用户/AI 消息列表
   */
  async loadSessionMessages(
    projectDirName: string,
    sessionId: string,
  ): Promise<{
    success: boolean;
    messages?: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
      thinking?: string;
      toolCalls?: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
        result?: string;
        status: 'success' | 'error' | 'pending';
      }>;
    }>;
    error?: string;
  }> {
    type HistMsg = {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
      thinking?: string;
      toolCalls?: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
        result?: string;
        status: 'success' | 'error' | 'pending';
      }>;
    };

    try {
      const filePath = path.join(os.homedir(), '.claude', 'projects', projectDirName, `${sessionId}.jsonl`);
      /** 单次最多读取 2MB（大文件只取末尾，保留最新对话） */
      const MAX_READ_BYTES = 2 * 1024 * 1024;
      /** 最多保留的消息条数 */
      const MAX_MESSAGES = 200;
      let raw: string;
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_READ_BYTES) {
          // 只读取最后 2MB，首行可能不完整，跳过第一个换行符之前的内容
          const fd = await fs.open(filePath, 'r');
          const buf = Buffer.alloc(MAX_READ_BYTES);
          await fd.read(buf, 0, MAX_READ_BYTES, stat.size - MAX_READ_BYTES);
          await fd.close();
          raw = buf.toString('utf-8');
          const firstNewline = raw.indexOf('\n');
          if (firstNewline !== -1) raw = raw.slice(firstNewline + 1);
        } else {
          raw = await fs.readFile(filePath, 'utf-8');
        }
      } catch {
        return { success: false, error: '文件不存在或无法读取' };
      }

      const lines = raw.split('\n').filter((l) => l.trim());
      const messages: HistMsg[] = [];
      // tool_use_id → 所属 assistant 消息索引
      const toolUseToMsg = new Map<string, number>();

      for (const line of lines) {
        try {
          const obj = JSON.parse(line) as Record<string, unknown>;

          // 用户消息：queue-operation/enqueue
          if (obj['type'] === 'queue-operation' && obj['operation'] === 'enqueue') {
            const rawContent = obj['content'];
            const content =
              typeof rawContent === 'string'
                ? rawContent
                : Array.isArray(rawContent)
                  ? (rawContent as Array<{ type: string; text?: string }>)
                      .filter((b) => b.type === 'text')
                      .map((b) => b.text ?? '')
                      .join('')
                  : '';
            if (!content.trim()) continue;
            const ts = obj['timestamp'] ? new Date(obj['timestamp'] as string).getTime() : Date.now();
            messages.push({ id: `hist-u-${messages.length}`, role: 'user', content, timestamp: ts });
          }

          // AI 回复：assistant（stream-json 格式）
          if (obj['type'] === 'assistant' && obj['message'] && typeof obj['message'] === 'object') {
            const msg = obj['message'] as { content?: unknown[] };
            const blocks = Array.isArray(msg.content) ? msg.content : [];
            const textParts: string[] = [];
            const thinkingParts: string[] = [];
            const toolCalls: NonNullable<HistMsg['toolCalls']> = [];

            for (const block of blocks as Array<{ type: string; text?: string; thinking?: string; id?: string; name?: string; input?: Record<string, unknown> }>) {
              if (block.type === 'text') textParts.push(block.text ?? '');
              else if (block.type === 'thinking') thinkingParts.push(block.thinking ?? '');
              else if (block.type === 'tool_use' && block.id) {
                toolCalls.push({ id: block.id, name: block.name ?? '', arguments: block.input ?? {}, status: 'pending' });
              }
            }

            const msgIdx = messages.length;
            messages.push({
              id: `hist-a-${msgIdx}`,
              role: 'assistant',
              content: textParts.join(''),
              timestamp: Date.now(),
              thinking: thinkingParts.length ? thinkingParts.join('\n\n') : undefined,
              toolCalls: toolCalls.length ? toolCalls : undefined,
            });

            for (const tc of toolCalls) toolUseToMsg.set(tc.id, msgIdx);
          }

          // 工具结果：tool（stream-json 格式）
          if (obj['type'] === 'tool' && Array.isArray(obj['content'])) {
            for (const block of obj['content'] as Array<{ type: string; tool_use_id?: string; content?: unknown }>) {
              if (block.type !== 'tool_result' || !block.tool_use_id) continue;
              const msgIdx = toolUseToMsg.get(block.tool_use_id);
              if (msgIdx === undefined || !messages[msgIdx]?.toolCalls) continue;
              const result =
                typeof block.content === 'string'
                  ? block.content
                  : Array.isArray(block.content)
                    ? (block.content as Array<{ type: string; text?: string }>)
                        .filter((b) => b.type === 'text')
                        .map((b) => b.text ?? '')
                        .join('')
                    : '';
              const tc = messages[msgIdx].toolCalls!.find((t) => t.id === block.tool_use_id);
              if (tc) { tc.result = result; tc.status = 'success'; }
            }
          }
        } catch { /* 忽略单行解析错误 */ }
      }

      return { success: true, messages: messages.slice(-MAX_MESSAGES) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 删除 CLI 历史会话文件（~/.claude/projects/{projectDirName}/{sessionId}.jsonl）
   */
  async deleteCliSession(projectDirName: string, sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filePath = path.join(os.homedir(), '.claude', 'projects', projectDirName, `${sessionId}.jsonl`);
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 删除 CLI 某个项目目录下的所有 .jsonl 文件
   * 仅删文件，不删目录本身（保留目录结构）
   */
  async deleteAllCliSessions(projectDirName: string): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const dirPath = path.join(os.homedir(), '.claude', 'projects', projectDirName);
      let files: string[];
      try {
        const entries = await fs.readdir(dirPath);
        files = entries.filter((f) => f.endsWith('.jsonl'));
      } catch {
        return { success: true, deletedCount: 0 };
      }
      let deletedCount = 0;
      await Promise.all(
        files.map(async (f) => {
          try {
            await fs.unlink(path.join(dirPath, f));
            deletedCount++;
          } catch { /* 忽略单个文件删除失败 */ }
        }),
      );
      return { success: true, deletedCount };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /** 查找 Claude-Mem 插件安装目录（返回最新版本路径，未安装则 null） */
  private findClaudeMemPluginDir(): string | null {
    const pluginBase = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'thedotmack', 'claude-mem');
    if (!fsSync.existsSync(pluginBase)) return null;
    let versions: string[];
    try {
      versions = fsSync.readdirSync(pluginBase).filter(v => /^\d/.test(v)).sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });
    } catch { return null; }
    if (!versions.length) return null;
    return path.join(pluginBase, versions[0]);
  }

  /** 查找 bun 可执行文件（优先 ~/.bun/bin/bun，回退到 PATH） */
  private findBunPath(): string {
    const homeDir = os.homedir();
    const isWin = process.platform === 'win32';
    const candidate = path.join(homeDir, '.bun', 'bin', isWin ? 'bun.exe' : 'bun');
    return fsSync.existsSync(candidate) ? candidate : 'bun';
  }

  /** 检查 Claude-Mem 插件是否已安装和启用 */
  async checkClaudeMemStatus(): Promise<{ installed: boolean; enabled: boolean; pluginDir?: string }> {
    const pluginDir = this.findClaudeMemPluginDir();
    if (!pluginDir) return { installed: false, enabled: false };
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    let enabled = false;
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      enabled = settings?.enabledPlugins?.['claude-mem@thedotmack'] === true;
    } catch { enabled = true; }
    return { installed: true, enabled, pluginDir };
  }

  /**
   * 通过 Claude-Mem MCP server 执行内存搜索
   * 使用 stdio JSON-RPC 与 `bun scripts/mcp-server.cjs` 通信
   */
  async searchClaudeMem(
    query: string,
    options: { limit?: number; project?: string; type?: string } = {},
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    return new Promise((resolve) => {
      const pluginDir = this.findClaudeMemPluginDir();
      if (!pluginDir) {
        return resolve({ success: false, error: 'Claude-Mem 插件未安装，请先运行: claude plugin install thedotmack/claude-mem' });
      }
      const mcpScript = path.join(pluginDir, 'scripts', 'mcp-server.cjs');
      if (!fsSync.existsSync(mcpScript)) {
        return resolve({ success: false, error: `MCP server 脚本不存在: ${mcpScript}` });
      }
      const bunPath = this.findBunPath();
      let proc: ChildProcess;
      try {
        proc = spawn(bunPath, [mcpScript], {
          env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginDir },
          cwd: pluginDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        return resolve({ success: false, error: `启动 MCP server 失败: ${String(err)}` });
      }

      let stdout = '';
      let resolved = false;

      const done = (result: { success: boolean; content?: string; error?: string }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try { proc.kill(); } catch { /* 忽略 */ }
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        done({ success: false, error: '搜索超时（20 秒），请确认 Claude-Mem worker 可正常启动' });
      }, 20000);

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        // 逐行解析 JSON-RPC 响应
        for (const line of stdout.split('\n')) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.id === 2) {
              if (msg.error) {
                done({ success: false, error: msg.error.message || String(msg.error) });
              } else {
                const content = (msg.result?.content || [])
                  .filter((c: { type: string }) => c.type === 'text')
                  .map((c: { text: string }) => c.text)
                  .join('\n');
                done({ success: true, content });
              }
            }
          } catch { /* 跳过非 JSON 行 */ }
        }
      });

      proc.on('error', (err) => done({ success: false, error: `进程错误: ${err.message}` }));
      proc.on('close', () => {
        if (!resolved) done({ success: false, error: '进程意外退出，请检查 bun 是否正确安装' });
      });

      // 发送 MCP 协议握手 + 搜索请求（换行分隔 JSON-RPC）
      const searchArgs: Record<string, unknown> = { query, limit: options.limit ?? 20 };
      if (options.project) searchArgs.project = options.project;
      if (options.type) searchArgs.type = options.type;

      const msgs = [
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'claude-code-gui', version: '1.0.0' } } }),
        JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search', arguments: searchArgs } }),
      ].join('\n') + '\n';

      proc.stdin?.write(msgs);
    });
  }
}
