"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
class FileService {
    async listDirectory(dirPath) {
        try {
            const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
            const result = [];
            for (const entry of entries) {
                const fullPath = path_1.default.join(dirPath, entry.name);
                let type = 'file';
                if (entry.isDirectory())
                    type = 'directory';
                else if (entry.isSymbolicLink())
                    type = 'symlink';
                let size = 0;
                let modified = '';
                try {
                    const stat = await promises_1.default.stat(fullPath);
                    size = stat.size;
                    modified = stat.mtime.toISOString();
                }
                catch {
                    // ignore stat errors for broken symlinks etc
                }
                result.push({ name: entry.name, path: fullPath, type, size, modified });
            }
            result.sort((a, b) => {
                if (a.type === b.type)
                    return a.name.localeCompare(b.name);
                return a.type === 'directory' ? -1 : 1;
            });
            return { success: true, entries: result };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async readFile(filePath) {
        try {
            const content = await promises_1.default.readFile(filePath, 'utf-8');
            return { success: true, content };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async writeFile(filePath, content) {
        try {
            await promises_1.default.writeFile(filePath, content, 'utf-8');
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    /**
     * 读取 Claude CLI 历史会话列表（~/.claude/projects/ 下所有 .jsonl 文件）
     * 每个文件的第一条 queue-operation/enqueue 行包含用户第一条消息和时间戳
     */
    async loadCliHistory() {
        try {
            const projectsDir = path_1.default.join(os_1.default.homedir(), '.claude', 'projects');
            let projectDirs;
            try {
                projectDirs = await promises_1.default.readdir(projectsDir);
            }
            catch {
                // ~/.claude/projects 不存在
                return { success: true, sessions: [] };
            }
            const sessions = [];
            /** 每个项目最多读取的会话数（按 mtime 倒序取最近的） */
            const MAX_SESSIONS_PER_PROJECT = 50;
            for (const dirName of projectDirs) {
                const dirPath = path_1.default.join(projectsDir, dirName);
                let files;
                try {
                    const entries = await promises_1.default.readdir(dirPath);
                    files = entries.filter((f) => f.endsWith('.jsonl'));
                }
                catch {
                    continue;
                }
                // 文件太多时，先 stat 取 mtime，只处理最近 MAX_SESSIONS_PER_PROJECT 个
                if (files.length > MAX_SESSIONS_PER_PROJECT) {
                    const withMtime = await Promise.all(files.map(async (f) => {
                        try {
                            const s = await promises_1.default.stat(path_1.default.join(dirPath, f));
                            return { f, mtime: s.mtime.getTime() };
                        }
                        catch {
                            return { f, mtime: 0 };
                        }
                    }));
                    withMtime.sort((a, b) => b.mtime - a.mtime);
                    files = withMtime.slice(0, MAX_SESSIONS_PER_PROJECT).map((x) => x.f);
                }
                for (const file of files) {
                    const sessionId = file.replace(/\.jsonl$/, '');
                    const filePath = path_1.default.join(dirPath, file);
                    try {
                        const stat = await promises_1.default.stat(filePath);
                        // 只读取前 8KB，足够找到第一条用户消息
                        const fd = await promises_1.default.open(filePath, 'r');
                        const buf = Buffer.alloc(8192);
                        const { bytesRead } = await fd.read(buf, 0, 8192, 0);
                        await fd.close();
                        const head = buf.toString('utf-8', 0, bytesRead);
                        let preview = '';
                        let startedAt = stat.mtime.getTime();
                        for (const line of head.split('\n')) {
                            if (!line.trim())
                                continue;
                            try {
                                const obj = JSON.parse(line);
                                if (obj.type === 'queue-operation' && obj.operation === 'enqueue' && typeof obj.content === 'string') {
                                    preview = obj.content.slice(0, 100);
                                    if (obj.timestamp)
                                        startedAt = new Date(obj.timestamp).getTime();
                                    break;
                                }
                            }
                            catch {
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
                    }
                    catch {
                        // 忽略单个文件读取错误
                    }
                }
            }
            // 按最后修改时间倒序排列
            sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
            return { success: true, sessions };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    /**
     * 删除 CLI 历史会话文件（~/.claude/projects/{projectDirName}/{sessionId}.jsonl）
     */
    async deleteCliSession(projectDirName, sessionId) {
        try {
            const filePath = path_1.default.join(os_1.default.homedir(), '.claude', 'projects', projectDirName, `${sessionId}.jsonl`);
            await promises_1.default.unlink(filePath);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    /**
     * 删除 CLI 某个项目目录下的所有 .jsonl 文件
     * 仅删文件，不删目录本身（保留目录结构）
     */
    async deleteAllCliSessions(projectDirName) {
        try {
            const dirPath = path_1.default.join(os_1.default.homedir(), '.claude', 'projects', projectDirName);
            let files;
            try {
                const entries = await promises_1.default.readdir(dirPath);
                files = entries.filter((f) => f.endsWith('.jsonl'));
            }
            catch {
                return { success: true, deletedCount: 0 };
            }
            let deletedCount = 0;
            await Promise.all(files.map(async (f) => {
                try {
                    await promises_1.default.unlink(path_1.default.join(dirPath, f));
                    deletedCount++;
                }
                catch { /* 忽略单个文件删除失败 */ }
            }));
            return { success: true, deletedCount };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
}
exports.FileService = FileService;
