import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Base path is configurable so the same build works on GitHub Pages
// (/<repo>/) and on any root-hosted static host.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
