/**
 * Vite + React adapter — resolves file paths for Vite-based React projects.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FrameworkAdapter } from '../types.js';

export const viteReactAdapter: FrameworkAdapter = {
  framework: 'vite-react',

  resolveStylesheet(root) {
    const candidates = [
      join(root, 'src', 'index.css'),
      join(root, 'src', 'App.css'),
      join(root, 'src', 'styles', 'globals.css'),
      join(root, 'src', 'app', 'globals.css'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  resolveConfig(root) {
    const candidates = [
      join(root, 'tailwind.config.ts'),
      join(root, 'tailwind.config.js'),
      join(root, 'tailwind.config.mjs'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  resolveLayout(root) {
    const candidates = [
      join(root, 'src', 'App.tsx'),
      join(root, 'src', 'App.jsx'),
      join(root, 'src', 'main.tsx'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  resolvePages(root) {
    const candidates = [
      join(root, 'src', 'pages'),
      join(root, 'src', 'views'),
      join(root, 'src', 'routes'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  resolveComponents(root) {
    const candidates = [
      join(root, 'src', 'components', 'ui'),
      join(root, 'src', 'shared', 'ui'),
      join(root, 'src', 'components'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  resolveSrc(root) {
    return join(root, 'src');
  },

  detectFramework(root) {
    return (
      existsSync(join(root, 'vite.config.ts')) ||
      existsSync(join(root, 'vite.config.js')) ||
      existsSync(join(root, 'vite.config.mjs'))
    );
  },
};
