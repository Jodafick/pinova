import path from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@pinova/shared': path.resolve(__dirname, 'src/shared/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
