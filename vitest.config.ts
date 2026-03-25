import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['scripts/__tests__/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['scripts/**/*.ts'],
      exclude: [
        'scripts/__tests__/**',
        'scripts/__mocks__/**',
        'scripts/**/interfaces/**',
        'scripts/**/templates/**',
        'scripts/**/views/**',
        'scripts/**/patterns/**',
      ],
      reporter: ['text', 'text-summary'],
    },
    alias: {
      // Mock `vscode` module — not available outside the extension host
      vscode: path.resolve(__dirname, 'scripts/__mocks__/vscode.ts'),
    },
  },
});
