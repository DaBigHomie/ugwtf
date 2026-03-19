/**
 * Next.js App Router adapter — resolves file paths for Next.js projects.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FrameworkAdapter } from '../types.js';

export const nextjsAdapter: FrameworkAdapter = {
  framework: 'nextjs',

  resolveStylesheet(root) {
    const candidates = [
      join(root, 'src', 'app', 'globals.css'),
      join(root, 'app', 'globals.css'),
      join(root, 'src', 'styles', 'globals.css'),
      join(root, 'styles', 'globals.css'),
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
      join(root, 'src', 'app', 'layout.tsx'),
      join(root, 'app', 'layout.tsx'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  resolvePages(root) {
    const candidates = [
      join(root, 'src', 'app'),
      join(root, 'app'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  resolveComponents(root) {
    const candidates = [
      join(root, 'src', 'shared', 'ui'),
      join(root, 'src', 'components', 'ui'),
      join(root, 'components', 'ui'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  resolveSrc(root) {
    const candidates = [join(root, 'src'), root];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  },

  detectFramework(root) {
    return (
      existsSync(join(root, 'next.config.ts')) ||
      existsSync(join(root, 'next.config.js')) ||
      existsSync(join(root, 'next.config.mjs'))
    );
  },
};
