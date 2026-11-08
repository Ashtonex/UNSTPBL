import { defineConfig } from 'vitest/config';

// Unit tests only need Node; keeping this separate from vite.config.ts avoids loading the PWA plugin.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
