import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 只跑纯 TS 逻辑测试；组件级测试暂不引入
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
  },
})
