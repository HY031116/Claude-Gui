/**
 * RoutinesService — 定时任务管理服务
 * v4.9.0 FEAT-411：监控视图「定时任务」Tab，底层使用 node-cron
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

export interface RoutineHistoryEntry {
  runAt: number;
  success: boolean;
  error?: string;
}

export interface Routine {
  id: string;
  name: string;
  /** 发送给 Claude 的任务提示词 */
  prompt: string;
  /** 工作目录（Claude 执行时的 cwd） */
  cwd: string;
  /** cron 表达式，例如 "0 9 * * 1" = 每周一 9:00 */
  cronExpr: string;
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  /** 最近 20 条执行历史（新 → 旧排列） */
  history: RoutineHistoryEntry[];
}

// ─── 服务实现 ────────────────────────────────────────────────────────────────

export class RoutinesService {
  private readonly routinesPath: string;
  private routines: Routine[] = [];
  private activeTasks: Map<string, cron.ScheduledTask> = new Map();
  private onRunCallback?: (routine: Routine) => void;

  constructor() {
    this.routinesPath = path.join(app.getPath('userData'), 'routines.json');
    this.load();
  }

  // ── 持久化 ─────────────────────────────────────────────────────────────

  private load(): void {
    try {
      if (fs.existsSync(this.routinesPath)) {
        const raw = fs.readFileSync(this.routinesPath, 'utf-8');
        this.routines = JSON.parse(raw) as Routine[];
      }
    } catch {
      this.routines = [];
    }
  }

  private save(): void {
    fs.writeFileSync(this.routinesPath, JSON.stringify(this.routines, null, 2), 'utf-8');
  }

  // ── 调度 ────────────────────────────────────────────────────────────────

  /** 设置任务触发时的回调（由 main.ts 注入，用于调用 CLI 发送消息） */
  setRunCallback(cb: (routine: Routine) => void): void {
    this.onRunCallback = cb;
  }

  /** 应用启动后调用，对所有 enabled 的任务注册 cron */
  start(): void {
    for (const routine of this.routines) {
      if (routine.enabled) this.scheduleRoutine(routine);
    }
  }

  /** 应用退出时清理所有 cron 任务 */
  stop(): void {
    for (const [, task] of this.activeTasks) task.stop();
    this.activeTasks.clear();
  }

  private scheduleRoutine(routine: Routine): void {
    if (!cron.validate(routine.cronExpr)) return;
    // 先停止已有任务（update 时重新调度）
    const existing = this.activeTasks.get(routine.id);
    if (existing) {
      existing.stop();
      this.activeTasks.delete(routine.id);
    }
    const task = cron.schedule(routine.cronExpr, () => {
      // 每次触发时重新从最新状态读取，防止 enabled 已被用户关闭
      const latest = this.routines.find((r) => r.id === routine.id);
      if (latest?.enabled) this.onRunCallback?.(latest);
    });
    this.activeTasks.set(routine.id, task);
  }

  private unscheduleRoutine(id: string): void {
    const existing = this.activeTasks.get(id);
    if (existing) {
      existing.stop();
      this.activeTasks.delete(id);
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  list(): Routine[] {
    return this.routines;
  }

  create(data: Omit<Routine, 'id' | 'createdAt' | 'history'>): Routine {
    const routine: Routine = {
      ...data,
      id: `routine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      history: [],
    };
    this.routines.push(routine);
    this.save();
    if (routine.enabled) this.scheduleRoutine(routine);
    return routine;
  }

  update(id: string, data: Partial<Omit<Routine, 'id' | 'createdAt' | 'history'>>): Routine | null {
    const idx = this.routines.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    this.routines[idx] = { ...this.routines[idx], ...data };
    this.save();
    const routine = this.routines[idx];
    this.unscheduleRoutine(id);
    if (routine.enabled) this.scheduleRoutine(routine);
    return routine;
  }

  delete(id: string): boolean {
    const idx = this.routines.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    this.unscheduleRoutine(id);
    this.routines.splice(idx, 1);
    this.save();
    return true;
  }

  /** 手动立即触发一次（不影响调度周期） */
  runNow(id: string): Routine | null {
    const routine = this.routines.find((r) => r.id === id);
    if (!routine) return null;
    this.onRunCallback?.(routine);
    return routine;
  }

  /** 记录一次执行结果（由 main.ts 在 CLI 调用完成后回调） */
  recordHistory(id: string, entry: RoutineHistoryEntry): void {
    const routine = this.routines.find((r) => r.id === id);
    if (!routine) return;
    routine.lastRunAt = entry.runAt;
    routine.history = [entry, ...routine.history].slice(0, 20);
    this.save();
  }

  /** 验证 cron 表达式合法性 */
  validateCron(expr: string): boolean {
    return cron.validate(expr);
  }
}
