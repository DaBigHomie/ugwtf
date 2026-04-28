import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { nextjsAdapter } from './nextjs.js';
import { viteReactAdapter } from './vite-react.js';
import { detectAdapter } from './index.js';

const TEST_DIR = join(import.meta.dirname, '../../../.test-tmp-adapters');

describe('audit-orchestrator/adapters', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('nextjsAdapter', () => {
    it('has framework="nextjs"', () => {
      expect(nextjsAdapter.framework).toBe('nextjs');
    });

    describe('detectFramework', () => {
      it('returns true when next.config.ts exists', () => {
        writeFileSync(join(TEST_DIR, 'next.config.ts'), '');
        expect(nextjsAdapter.detectFramework(TEST_DIR)).toBe(true);
      });

      it('returns true when next.config.js exists', () => {
        writeFileSync(join(TEST_DIR, 'next.config.js'), '');
        expect(nextjsAdapter.detectFramework(TEST_DIR)).toBe(true);
      });

      it('returns true when next.config.mjs exists', () => {
        writeFileSync(join(TEST_DIR, 'next.config.mjs'), '');
        expect(nextjsAdapter.detectFramework(TEST_DIR)).toBe(true);
      });

      it('returns false when no next.config file exists', () => {
        expect(nextjsAdapter.detectFramework(TEST_DIR)).toBe(false);
      });
    });

    describe('resolveStylesheet', () => {
      it('returns src/app/globals.css when it exists', () => {
        const dir = join(TEST_DIR, 'src', 'app');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'globals.css'), '');
        expect(nextjsAdapter.resolveStylesheet(TEST_DIR)).toBe(join(TEST_DIR, 'src', 'app', 'globals.css'));
      });

      it('falls back to first candidate when none exist', () => {
        const result = nextjsAdapter.resolveStylesheet(TEST_DIR);
        expect(result).toContain('globals.css');
      });
    });

    describe('resolveConfig', () => {
      it('returns tailwind.config.ts when it exists', () => {
        writeFileSync(join(TEST_DIR, 'tailwind.config.ts'), '');
        expect(nextjsAdapter.resolveConfig(TEST_DIR)).toBe(join(TEST_DIR, 'tailwind.config.ts'));
      });

      it('falls back to first candidate when none exist', () => {
        expect(nextjsAdapter.resolveConfig(TEST_DIR)).toContain('tailwind.config');
      });
    });

    describe('resolveLayout', () => {
      it('returns src/app/layout.tsx when it exists', () => {
        const dir = join(TEST_DIR, 'src', 'app');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'layout.tsx'), '');
        expect(nextjsAdapter.resolveLayout(TEST_DIR)).toBe(join(TEST_DIR, 'src', 'app', 'layout.tsx'));
      });

      it('falls back to first candidate when none exist', () => {
        expect(nextjsAdapter.resolveLayout(TEST_DIR)).toContain('layout.tsx');
      });
    });

    describe('resolvePages', () => {
      it('returns src/app when it exists', () => {
        const dir = join(TEST_DIR, 'src', 'app');
        mkdirSync(dir, { recursive: true });
        expect(nextjsAdapter.resolvePages(TEST_DIR)).toBe(dir);
      });

      it('falls back to first candidate when none exist', () => {
        expect(nextjsAdapter.resolvePages(TEST_DIR)).toContain('app');
      });
    });

    describe('resolveComponents', () => {
      it('returns src/shared/ui when it exists', () => {
        const dir = join(TEST_DIR, 'src', 'shared', 'ui');
        mkdirSync(dir, { recursive: true });
        expect(nextjsAdapter.resolveComponents(TEST_DIR)).toBe(dir);
      });

      it('falls back to first candidate when none exist', () => {
        expect(nextjsAdapter.resolveComponents(TEST_DIR)).toContain('ui');
      });
    });

    describe('resolveSrc', () => {
      it('returns src/ when it exists', () => {
        const src = join(TEST_DIR, 'src');
        mkdirSync(src, { recursive: true });
        expect(nextjsAdapter.resolveSrc(TEST_DIR)).toBe(src);
      });

      it('falls back to root when src does not exist', () => {
        expect(nextjsAdapter.resolveSrc(TEST_DIR)).toBe(TEST_DIR);
      });
    });
  });

  describe('viteReactAdapter', () => {
    it('has framework="vite-react"', () => {
      expect(viteReactAdapter.framework).toBe('vite-react');
    });

    describe('detectFramework', () => {
      it('returns true when vite.config.ts exists', () => {
        writeFileSync(join(TEST_DIR, 'vite.config.ts'), '');
        expect(viteReactAdapter.detectFramework(TEST_DIR)).toBe(true);
      });

      it('returns true when vite.config.js exists', () => {
        writeFileSync(join(TEST_DIR, 'vite.config.js'), '');
        expect(viteReactAdapter.detectFramework(TEST_DIR)).toBe(true);
      });

      it('returns false when no vite config exists', () => {
        expect(viteReactAdapter.detectFramework(TEST_DIR)).toBe(false);
      });
    });

    describe('resolveStylesheet', () => {
      it('returns src/index.css when it exists', () => {
        const src = join(TEST_DIR, 'src');
        mkdirSync(src, { recursive: true });
        writeFileSync(join(src, 'index.css'), '');
        expect(viteReactAdapter.resolveStylesheet(TEST_DIR)).toBe(join(src, 'index.css'));
      });

      it('falls back to first candidate when none exist', () => {
        expect(viteReactAdapter.resolveStylesheet(TEST_DIR)).toContain('css');
      });
    });

    describe('resolveLayout', () => {
      it('returns src/App.tsx when it exists', () => {
        const src = join(TEST_DIR, 'src');
        mkdirSync(src, { recursive: true });
        writeFileSync(join(src, 'App.tsx'), '');
        expect(viteReactAdapter.resolveLayout(TEST_DIR)).toBe(join(src, 'App.tsx'));
      });

      it('falls back to first candidate when none exist', () => {
        expect(viteReactAdapter.resolveLayout(TEST_DIR)).toContain('App');
      });
    });

    describe('resolvePages', () => {
      it('returns src/pages when it exists', () => {
        const pages = join(TEST_DIR, 'src', 'pages');
        mkdirSync(pages, { recursive: true });
        expect(viteReactAdapter.resolvePages(TEST_DIR)).toBe(pages);
      });

      it('falls back to first candidate when none exist', () => {
        expect(viteReactAdapter.resolvePages(TEST_DIR)).toContain('pages');
      });
    });

    describe('resolveComponents', () => {
      it('returns src/components/ui when it exists', () => {
        const ui = join(TEST_DIR, 'src', 'components', 'ui');
        mkdirSync(ui, { recursive: true });
        expect(viteReactAdapter.resolveComponents(TEST_DIR)).toBe(ui);
      });

      it('falls back to first candidate when none exist', () => {
        expect(viteReactAdapter.resolveComponents(TEST_DIR)).toContain('components');
      });
    });

    describe('resolveSrc', () => {
      it('always returns {root}/src', () => {
        expect(viteReactAdapter.resolveSrc(TEST_DIR)).toBe(join(TEST_DIR, 'src'));
      });
    });
  });

  describe('detectAdapter', () => {
    it('detects Next.js when next.config.ts exists', () => {
      writeFileSync(join(TEST_DIR, 'next.config.ts'), '');
      expect(detectAdapter(TEST_DIR).framework).toBe('nextjs');
    });

    it('detects Vite when vite.config.ts exists', () => {
      writeFileSync(join(TEST_DIR, 'vite.config.ts'), '');
      expect(detectAdapter(TEST_DIR).framework).toBe('vite-react');
    });

    it('detects Next.js from package.json dependencies', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({ dependencies: { next: '14.0.0' } }),
      );
      expect(detectAdapter(TEST_DIR).framework).toBe('nextjs');
    });

    it('detects Vite from package.json devDependencies', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({ devDependencies: { vite: '5.0.0' } }),
      );
      expect(detectAdapter(TEST_DIR).framework).toBe('vite-react');
    });

    it('falls back to Next.js adapter when nothing matches', () => {
      // No config files, no package.json
      expect(detectAdapter(TEST_DIR).framework).toBe('nextjs');
    });
  });
});
