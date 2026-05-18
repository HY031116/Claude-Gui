/**
 * PlanReviewPanel.test.tsx
 * 测试 Plan Mode 计划解析工具函数（parsePlanSteps / buildSkipMessage）
 * 及组件基础渲染
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { parsePlanSteps, buildSkipMessage, PlanReviewPanel } from './PlanReviewPanel';
import { useAppStore } from '../stores/useAppStore';

// ─── parsePlanSteps 纯函数测试 ────────────────────────────────────────────────

describe('parsePlanSteps - 基础解析', () => {
  it('空文本应返回空数组', () => {
    expect(parsePlanSteps('')).toEqual([]);
  });

  it('无编号列表格式时整体作为单步骤降级', () => {
    const result = parsePlanSteps('分析代码结构');
    expect(result).toHaveLength(1);
    expect(result[0].toolType).toBe('Unknown');
    expect(result[0].riskLevel).toBe('low');
  });

  it('解析简单编号列表（句点格式）', () => {
    const text = '1. 读取配置文件\n2. 修改配置\n3. 运行 npm test';
    const result = parsePlanSteps(text);
    expect(result).toHaveLength(3);
  });

  it('解析括号格式编号列表', () => {
    const text = '1) 分析代码\n2) 执行 bash 命令';
    const result = parsePlanSteps(text);
    expect(result).toHaveLength(2);
  });

  it('步骤 id 应递增生成', () => {
    const text = '1. 读取文件\n2. 修改文件\n3. 运行测试';
    const result = parsePlanSteps(text);
    expect(result[0].id).toBe('plan-step-0');
    expect(result[1].id).toBe('plan-step-1');
    expect(result[2].id).toBe('plan-step-2');
  });

  it('步骤 index 应从 1 开始', () => {
    const text = '1. 读取文件\n2. 修改文件';
    const result = parsePlanSteps(text);
    expect(result[0].index).toBe(1);
    expect(result[1].index).toBe(2);
  });
});

describe('parsePlanSteps - 工具类型推断', () => {
  it('包含 run/npm 的步骤应推断为 Bash', () => {
    const result = parsePlanSteps('1. run npm install');
    expect(result[0].toolType).toBe('Bash');
  });

  it('包含 bash 的步骤应推断为 Bash', () => {
    const result = parsePlanSteps('1. execute bash script');
    expect(result[0].toolType).toBe('Bash');
  });

  it('包含 read/analyze 的步骤应推断为 Read', () => {
    const result = parsePlanSteps('1. read and analyze the source code');
    expect(result[0].toolType).toBe('Read');
  });

  it('包含 search 的步骤应推断为 Read', () => {
    const result = parsePlanSteps('1. search for the configuration');
    expect(result[0].toolType).toBe('Read');
  });

  it('包含 modify/edit 的步骤应推断为 Edit', () => {
    const result = parsePlanSteps('1. modify the config file');
    expect(result[0].toolType).toBe('Edit');
  });

  it('包含 create/write 的步骤应推断为 Write', () => {
    const result = parsePlanSteps('1. create a new file for the module');
    expect(result[0].toolType).toBe('Write');
  });

  it('包含 delete/remove file 的步骤应推断为 Delete', () => {
    const result = parsePlanSteps('1. delete the old file');
    expect(result[0].toolType).toBe('Delete');
  });

  it('包含 call api/http/fetch 的步骤应推断为 API', () => {
    const result = parsePlanSteps('1. call api endpoint to fetch data');
    expect(result[0].toolType).toBe('API');
  });

  it('无法匹配的步骤应推断为 Unknown', () => {
    const result = parsePlanSteps('1. something completely random xyz123');
    expect(result[0].toolType).toBe('Unknown');
  });
});

describe('parsePlanSteps - 风险等级', () => {
  it('Bash 步骤应为高风险', () => {
    const result = parsePlanSteps('1. run npm install');
    expect(result[0].riskLevel).toBe('high');
  });

  it('Delete 步骤应为高风险', () => {
    const result = parsePlanSteps('1. delete the old file');
    expect(result[0].riskLevel).toBe('high');
  });

  it('API 步骤应为高风险', () => {
    const result = parsePlanSteps('1. call api to send request');
    expect(result[0].riskLevel).toBe('high');
  });

  it('Edit 步骤应为中风险', () => {
    const result = parsePlanSteps('1. modify the config file');
    expect(result[0].riskLevel).toBe('medium');
  });

  it('Write 步骤应为中风险', () => {
    const result = parsePlanSteps('1. create a new file');
    expect(result[0].riskLevel).toBe('medium');
  });

  it('Read 步骤应为低风险', () => {
    const result = parsePlanSteps('1. analyze and search the source code');
    expect(result[0].riskLevel).toBe('low');
  });

  it('高风险步骤默认不勾选', () => {
    const result = parsePlanSteps('1. run bash command');
    expect(result[0].checked).toBe(false);
  });

  it('低风险步骤默认勾选', () => {
    const result = parsePlanSteps('1. read the configuration');
    expect(result[0].checked).toBe(true);
  });

  it('中风险步骤默认勾选', () => {
    const result = parsePlanSteps('1. modify the file content');
    expect(result[0].checked).toBe(true);
  });
});

describe('parsePlanSteps - target 提取', () => {
  it('从反引号中提取 target', () => {
    const result = parsePlanSteps('1. read the `config.json` file');
    expect(result[0].target).toBe('config.json');
  });

  it('从文件路径中提取 target', () => {
    const result = parsePlanSteps('1. analyze src/utils.ts and find issues');
    expect(result[0].target).toBe('src/utils.ts');
  });
});

describe('parsePlanSteps - 风险原因', () => {
  it('Bash+npm 步骤应有风险说明', () => {
    const result = parsePlanSteps('1. run npm install');
    expect(result[0].riskReason).toContain('node_modules');
  });

  it('Bash+pip 步骤应有风险说明', () => {
    const result = parsePlanSteps('1. run pip install requests');
    expect(result[0].riskReason).toContain('Python');
  });

  it('普通 Bash 步骤应有通用风险说明', () => {
    const result = parsePlanSteps('1. execute bash script');
    expect(result[0].riskReason).toContain('Shell');
  });

  it('Delete 步骤应有风险说明', () => {
    const result = parsePlanSteps('1. delete the old config file');
    expect(result[0].riskReason).toContain('不可撤销');
  });

  it('API 步骤应有风险说明', () => {
    const result = parsePlanSteps('1. call api to retrieve data');
    expect(result[0].riskReason).toContain('外部服务');
  });

  it('Read 步骤不应有风险说明', () => {
    const result = parsePlanSteps('1. read and analyze source code');
    expect(result[0].riskReason).toBeUndefined();
  });
});

// ─── buildSkipMessage 纯函数测试 ──────────────────────────────────────────────

describe('buildSkipMessage', () => {
  const steps = [
    { id: 's1', index: 1, rawText: '读取文件', toolType: 'Read', riskLevel: 'low' as const, checked: true, status: 'waiting' as const },
    { id: 's2', index: 2, rawText: '运行 npm install', toolType: 'Bash', riskLevel: 'high' as const, checked: false, status: 'waiting' as const },
    { id: 's3', index: 3, rawText: '修改配置', toolType: 'Edit', riskLevel: 'medium' as const, checked: true, status: 'waiting' as const },
  ];

  it('全部勾选时返回空字符串', () => {
    const checkedIds = ['s1', 's2', 's3'];
    expect(buildSkipMessage(steps, checkedIds)).toBe('');
  });

  it('有未勾选步骤时返回跳过消息', () => {
    const checkedIds = ['s1', 's3'];
    const msg = buildSkipMessage(steps, checkedIds);
    expect(msg).toContain('GUI INSTRUCTION');
    expect(msg).toContain('SKIP');
    expect(msg).toContain('Step 2: 运行 npm install');
  });

  it('跳过消息包含正确的步骤描述', () => {
    const checkedIds = ['s1'];
    const msg = buildSkipMessage(steps, checkedIds);
    expect(msg).toContain('Step 2');
    expect(msg).toContain('Step 3');
    expect(msg).not.toContain('Step 1');
  });

  it('全部跳过时消息包含所有步骤', () => {
    const checkedIds: string[] = [];
    const msg = buildSkipMessage(steps, checkedIds);
    expect(msg).toContain('Step 1');
    expect(msg).toContain('Step 2');
    expect(msg).toContain('Step 3');
  });
});

// ─── PlanReviewPanel 组件渲染测试 ────────────────────────────────────────────

const mockOnConfirm = vi.fn();
const mockOnCancel = vi.fn();

describe('PlanReviewPanel - idle 状态（无步骤）', () => {
  beforeEach(() => {
    useAppStore.setState({
      planReview: { phase: 'idle', rawPlanText: '', parsedSteps: [] },
    });
  });

  it('idle 状态渲染主审查区域', () => {
    render(<PlanReviewPanel onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    expect(screen.getByText(/Plan Mode: ON/)).toBeInTheDocument();
  });

  it('idle 无步骤时应无 checkbox', () => {
    render(<PlanReviewPanel onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes).toHaveLength(0);
  });
});

describe('PlanReviewPanel - 生成计划中', () => {
  beforeEach(() => {
    useAppStore.setState({
      planReview: { phase: 'generating_plan', rawPlanText: '', parsedSteps: [] },
    });
  });

  it('generating_plan 阶段应显示加载状态', () => {
    render(<PlanReviewPanel onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    expect(screen.getByText(/正在生成执行计划/)).toBeInTheDocument();
  });
});

describe('PlanReviewPanel - 有计划时渲染', () => {
  const planSteps = parsePlanSteps('1. 读取 `config.json` 文件\n2. 修改配置项\n3. run npm test');

  beforeEach(() => {
    useAppStore.setState({
      planReview: {
        phase: 'plan_ready',
        rawPlanText: '1. 读取 `config.json` 文件\n2. 修改配置项\n3. run npm test',
        parsedSteps: planSteps,
      },
      session: { isConnected: false, workingDirectory: 'D:\\proj' },
    });
  });

  it('有计划时应显示步骤序号', () => {
    render(<PlanReviewPanel onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    expect(screen.getByText(/步骤 1/)).toBeInTheDocument();
  });

  it('应显示"确认执行"按钮', () => {
    render(<PlanReviewPanel onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    expect(screen.getByRole('button', { name: /确认执行/ })).toBeInTheDocument();
  });

  it('有高风险步骤时应显示"取消高风险"按钮', () => {
    render(<PlanReviewPanel onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    expect(screen.getByRole('button', { name: /取消高风险/ })).toBeInTheDocument();
  });

  it('点击全选按钮可选中所有步骤', () => {
    render(<PlanReviewPanel onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    const selectAllBtn = screen.getByRole('button', { name: /全选/ });
    fireEvent.click(selectAllBtn);
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((cb) => cb.checked)).toBe(true);
  });
});

describe('PlanReviewPanel - 执行中状态', () => {
  const planSteps = parsePlanSteps('1. 读取文件\n2. 修改文件');

  beforeEach(() => {
    useAppStore.setState({
      planReview: {
        phase: 'executing',
        rawPlanText: '1. 读取文件\n2. 修改文件',
        parsedSteps: planSteps,
      },
    });
  });

  it('executing 阶段应显示执行进度文字', () => {
    render(<PlanReviewPanel onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    expect(screen.getByText(/执行中/)).toBeInTheDocument();
  });
});
