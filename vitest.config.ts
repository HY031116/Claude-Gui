import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // 使用 jsdom 模拟浏览器环境（用于 React 组件测试）
    environment: 'jsdom',
    // 自动导入 @testing-library/jest-dom 扩展断言
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      // 只统计 src 目录下的业务代码
      include: ['src/**/*.{ts,tsx}'],
      // 排除测试文件、类型声明及入口文件
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/types/**',
        'src/main.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
