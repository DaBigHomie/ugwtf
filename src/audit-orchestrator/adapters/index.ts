/**
 * Framework adapter auto-detection and registry.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FrameworkAdapter } from '../types.js';
import { nextjsAdapter } from './nextjs.js';
import { viteReactAdapter } from './vite-react.js';

const adapters: FrameworkAdapter[] = [nextjsAdapter, viteReactAdapter];

export function detectAdapter(root: string): FrameworkAdapter {
  for (const adapter of adapters) {
    if (adapter.detectFramework(root)) return adapter;
  }

  // Fallback: check package.json dependencies
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['next']) return nextjsAdapter;
    if (deps['vite']) return viteReactAdapter;
  }

  // Default to Next.js adapter
  return nextjsAdapter;
}

export { nextjsAdapter, viteReactAdapter };
export type { FrameworkAdapter };
