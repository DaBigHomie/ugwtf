/**
 * audit-orchestrator/adapters — Unit Tests
 *
 * Covers detectAdapter, nextjsAdapter, viteReactAdapter.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Temp directory setup
// ---------------------------------------------------------------------------

const TMP = join(tmpdir(), 'adapters-test-' + Date.now());
const NEXT_ROOT = join(TMP, 'next-project');
const VITE_ROOT = join(TMP, 'vite-project');
const PKG_NEXT_ROOT = join(TMP, 'pkg-next-project');
const PKG_VITE_ROOT = join(TMP, 'pkg-vite-project');
const EMPTY_ROOT = join(TMP, 'empty-project');

beforeAll(() => {
  // Next.js project (has next.config.ts)
  mkdirSync(join(NEXT_ROOT, 'src', 'app'), { recursive: true });
  mkdirSync(join(NEXT_ROOT, 'src', 'shared', 'ui'), { recursive: true });
  writeFileSync(join(NEXT_ROOT, 'next.config.ts'), 'export default {}');
  writeFileSync(join(NEXT_ROOT, 'tailwind.config.ts'), 'module.exports = {}');
  writeFileSync(join(NEXT_ROOT, 'src', 'app', 'globals.css'), '/* styles */');
  writeFileSync(join(NEXT_ROOT, 'src', 'app', 'layout.tsx'), '<html />');

  // Vite project (has vite.config.ts)
  mkdirSync(join(VITE_ROOT, 'src', 'pages'), { recursive: true });
  mkdirSync(join(VITE_ROOT, 'src', 'components', 'ui'), { recursive: true });
  writeFileSync(join(VITE_ROOT, 'vite.config.ts'), 'export default {}');
  writeFileSync(join(VITE_ROOT, 'src', 'index.css'), '/* styles */');
  writeFileSync(join(VITE_ROOT, 'src', 'App.tsx'), '<App />');

  // Package.json-based detection (Next)
  mkdirSync(PKG_NEXT_ROOT, { recursive: true });
  writeFileSync(join(PKG_NEXT_ROOT, 'package.json'), JSON.stringify({ dependencies: { next: '^14.0.0' } }));

  // Package.json-based detection (Vite)
  mkdirSync(PKG_VITE_ROOT, { recursive: true });
  writeFileSync(join(PKG_VITE_ROOT, 'package.json'), JSON.stringify({ dependencies: { vite: '^5.0.0' } }));

  // Empty project (no config files)
  mkdirSync(EMPTY_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// detectAdapter
// ---------------------------------------------------------------------------

describe('detectAdapter', () => {
  it('detects Next.js adapter via next.config.ts', async () => {
    const { detectAdapter } = await import('./index.js');
    const adapter = detectAdapter(NEXT_ROOT);
    expect(adapter.framework).toBe('nextjs');
  });

  it('detects Vite adapter via vite.config.ts', async () => {
    const { detectAdapter } = await import('./index.js');
    const adapter = detectAdapter(VITE_ROOT);
    expect(adapter.framework).toBe('vite-react');
  });

  it('falls back to next adapter via package.json dependencies', async () => {
    const { detectAdapter } = await import('./index.js');
    const adapter = detectAdapter(PKG_NEXT_ROOT);
    expect(adapter.framework).toBe('nextjs');
  });

  it('falls back to vite adapter via package.json devDependencies', async () => {
    const { detectAdapter } = await import('./index.js');
    const adapter = detectAdapter(PKG_VITE_ROOT);
    expect(adapter.framework).toBe('vite-react');
  });

  it('defaults to Next.js when no config or package.json', async () => {
    const { detectAdapter } = await import('./index.js');
    const adapter = detectAdapter(EMPTY_ROOT);
    expect(adapter.framework).toBe('nextjs');
  });
});

// ---------------------------------------------------------------------------
// nextjsAdapter
// ---------------------------------------------------------------------------

describe('nextjsAdapter', () => {
  it('resolveStylesheet returns existing css path', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveStylesheet(NEXT_ROOT);
    expect(path).toBe(join(NEXT_ROOT, 'src', 'app', 'globals.css'));
  });

  it('resolveStylesheet returns candidate[0] when none exist', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveStylesheet(EMPTY_ROOT);
    expect(path).toContain('globals.css');
  });

  it('resolveConfig returns existing tailwind.config.ts', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveConfig(NEXT_ROOT);
    expect(path).toBe(join(NEXT_ROOT, 'tailwind.config.ts'));
  });

  it('resolveConfig falls back to candidate[0] when none exist', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveConfig(EMPTY_ROOT);
    expect(path).toContain('tailwind.config.ts');
  });

  it('resolveLayout returns existing layout.tsx', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveLayout(NEXT_ROOT);
    expect(path).toBe(join(NEXT_ROOT, 'src', 'app', 'layout.tsx'));
  });

  it('resolveLayout falls back to candidate[0] when none exist', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveLayout(EMPTY_ROOT);
    expect(path).toContain('layout.tsx');
  });

  it('resolvePages returns src/app when it exists', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolvePages(NEXT_ROOT);
    expect(path).toBe(join(NEXT_ROOT, 'src', 'app'));
  });

  it('resolvePages falls back to candidate[0] when none exist', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolvePages(EMPTY_ROOT);
    expect(path).toContain('src');
  });

  it('resolveComponents returns src/shared/ui when it exists', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveComponents(NEXT_ROOT);
    expect(path).toBe(join(NEXT_ROOT, 'src', 'shared', 'ui'));
  });

  it('resolveComponents falls back to candidate[0] when none exist', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveComponents(EMPTY_ROOT);
    expect(path).toContain('ui');
  });

  it('resolveSrc returns src/ when it exists', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveSrc(NEXT_ROOT);
    expect(path).toBe(join(NEXT_ROOT, 'src'));
  });

  it('resolveSrc falls back to root when src/ missing', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    const path = nextjsAdapter.resolveSrc(EMPTY_ROOT);
    expect(path).toBe(EMPTY_ROOT);
  });

  it('detectFramework returns true for next.config.ts', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    expect(nextjsAdapter.detectFramework(NEXT_ROOT)).toBe(true);
  });

  it('detectFramework returns false when no next config', async () => {
    const { nextjsAdapter } = await import('./nextjs.js');
    expect(nextjsAdapter.detectFramework(EMPTY_ROOT)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// viteReactAdapter
// ---------------------------------------------------------------------------

describe('viteReactAdapter', () => {
  it('resolveStylesheet returns src/index.css when it exists', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolveStylesheet(VITE_ROOT);
    expect(path).toBe(join(VITE_ROOT, 'src', 'index.css'));
  });

  it('resolveStylesheet falls back to candidate[0] when none exist', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolveStylesheet(EMPTY_ROOT);
    expect(path).toContain('index.css');
  });

  it('resolveConfig returns tailwind.config.ts when it exists', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolveConfig(VITE_ROOT);
    expect(path).toContain('tailwind.config.ts');
  });

  it('resolveLayout returns src/App.tsx when it exists', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolveLayout(VITE_ROOT);
    expect(path).toBe(join(VITE_ROOT, 'src', 'App.tsx'));
  });

  it('resolveLayout falls back to candidate[0] when none exist', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolveLayout(EMPTY_ROOT);
    expect(path).toContain('App.tsx');
  });

  it('resolvePages returns src/pages when it exists', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolvePages(VITE_ROOT);
    expect(path).toBe(join(VITE_ROOT, 'src', 'pages'));
  });

  it('resolvePages falls back to candidate[0] when none exist', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolvePages(EMPTY_ROOT);
    expect(path).toContain('pages');
  });

  it('resolveComponents returns src/components/ui when it exists', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolveComponents(VITE_ROOT);
    expect(path).toBe(join(VITE_ROOT, 'src', 'components', 'ui'));
  });

  it('resolveComponents falls back to candidate[0] when none exist', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    const path = viteReactAdapter.resolveComponents(EMPTY_ROOT);
    expect(path).toContain('ui');
  });

  it('resolveSrc always returns src/', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    expect(viteReactAdapter.resolveSrc(VITE_ROOT)).toBe(join(VITE_ROOT, 'src'));
    expect(viteReactAdapter.resolveSrc(EMPTY_ROOT)).toBe(join(EMPTY_ROOT, 'src'));
  });

  it('detectFramework returns true for vite.config.ts', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    expect(viteReactAdapter.detectFramework(VITE_ROOT)).toBe(true);
  });

  it('detectFramework returns false when no vite config', async () => {
    const { viteReactAdapter } = await import('./vite-react.js');
    expect(viteReactAdapter.detectFramework(EMPTY_ROOT)).toBe(false);
  });
});
