import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__mocks__/**',
        'src/agents/**',
        'src/generators/**',
        'src/integrations/**',
        'src/clients/**',
      ],
      thresholds: {
        lines: 60,
      },
    },
  },
});
