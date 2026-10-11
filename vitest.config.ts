import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [['tests/**/*.test.tsx', 'jsdom']],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 120000,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
