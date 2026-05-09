import fs from 'fs/promises';
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
}
