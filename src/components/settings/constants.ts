import type { AppSettings } from '../../types';

export const MODEL_OPTIONS = [
  { value: 'default', label: '默认 (default)' },
  { value: 'sonnet', label: 'Sonnet (推荐)' },
  { value: 'opus', label: 'Opus (最强)' },
  { value: 'haiku', label: 'Haiku (最快)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'AWS Bedrock Sonnet v2' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'OpenRouter Claude 3.5 Sonnet' },
  { value: 'meta/llama-3.1-405b-instruct', label: 'Llama 3.1 405B' },
  { value: 'custom', label: '自定义模型...' }, // 选此项才显示自定义输入框
];

export const EFFORT_LEVELS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中 (默认)' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '超高 (xhigh)' },
  { value: 'max', label: '最高 (max)' },
];

export const CONFIG_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  settings: Partial<AppSettings>;
}> = [
  {
    id: 'developer',
    label: '开发模式',
    description: 'Sonnet + 高努力',
    settings: {
      model: 'sonnet',
      effortLevel: 'high',
    } as Partial<AppSettings>,
  },
  {
    id: 'power',
    label: '强力模式',
    description: 'Opus + 最高努力',
    settings: {
      model: 'opus',
      effortLevel: 'max',
    } as Partial<AppSettings>,
  },
  {
    id: 'fast',
    label: '快速模式',
    description: 'Haiku + 低努力',
    settings: {
      model: 'haiku',
      effortLevel: 'low',
    } as Partial<AppSettings>,
  },
];
