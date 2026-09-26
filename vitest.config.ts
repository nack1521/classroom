import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  define: {
    'import.meta.client': true,
  },
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './app'),
      '@': path.resolve(import.meta.dirname, './app'),
      '~~': path.resolve(import.meta.dirname, '.'),
      '@@': path.resolve(import.meta.dirname, '.'),
    },
  },
})
