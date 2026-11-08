import { defineConfig } from 'vitest/config';

// Unit tests only need Node; keeping this separate from vite.config.ts avoids loading the PWA plugin.
// Component tests opt into a browser-like DOM with a `// @vitest-environment jsdom` comment.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
