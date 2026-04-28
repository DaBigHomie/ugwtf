/**
 * audit-orchestrator/scanner — Unit Tests
 *
 * Covers findFiles, fileContains, countMatches, readFileSafe.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { findFiles, fileContains, countMatches, readFileSafe } from './scanner.js';

// ---------------------------------------------------------------------------
// Temp directory setup
// ---------------------------------------------------------------------------

const TMP_ROOT = '/tmp/scanner-test-' + Date.now();

beforeAll(() => {
  mkdirSync(join(TMP_ROOT, 'src', 'components'), { recursive: true });
  mkdirSync(join(TMP_ROOT, 'node_modules', 'pkg'), { recursive: true });
  mkdirSync(join(TMP_ROOT, 'empty-dir'), { recursive: true });

  writeFileSync(join(TMP_ROOT, 'src', 'index.tsx'), `
    const el = <button aria-label="click me" data-testid="btn">OK</button>;
    const el2 = <img alt="photo" />;
  `);
  writeFileSync(join(TMP_ROOT, 'src', 'components', 'Card.tsx'), `
    export function Card() {
      return <div aria-hidden="true" data-testid="card" />;
    }
  `);
  writeFileSync(join(TMP_ROOT, 'src', 'styles.css'), `
    :root { --color-bg: #fff; }
    .dark { background: #000; }
  `);
  writeFileSync(join(TMP_ROOT, 'node_modules', 'pkg', 'index.js'), 'aria-label');
});

afterAll(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// findFiles
// ---------------------------------------------------------------------------

describe('findFiles', () => {
  it('finds tsx files recursively', () => {
    const files = findFiles(join(TMP_ROOT, 'src'), /\.tsx$/);
    expect(files.length).toBe(2);
    expect(files.some((f) => f.endsWith('index.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('Card.tsx'))).toBe(true);
  });

  it('excludes node_modules by default', () => {
    const files = findFiles(TMP_ROOT, /\.js$/);
    expect(files.every((f) => !f.includes('node_modules'))).toBe(true);
  });

  it('returns empty array for nonexistent directory', () => {
    const files = findFiles('/nonexistent/path/xyz', /\.ts$/);
    expect(files).toEqual([]);
  });

  it('returns empty array for empty directory', () => {
    const files = findFiles(join(TMP_ROOT, 'empty-dir'), /\.ts$/);
    expect(files).toEqual([]);
  });

  it('handles file path directly (returns it if matches ext)', () => {
    const file = join(TMP_ROOT, 'src', 'index.tsx');
    const files = findFiles(file, /\.tsx$/);
    expect(files).toEqual([file]);
  });

  it('handles file path directly (returns empty if no match)', () => {
    const file = join(TMP_ROOT, 'src', 'index.tsx');
    const files = findFiles(file, /\.css$/);
    expect(files).toEqual([]);
  });

  it('respects custom ignore list', () => {
    const files = findFiles(TMP_ROOT, /\.js$/, []);
    // With no ignore, finds node_modules
    expect(files.some((f) => f.includes('node_modules'))).toBe(true);
  });

  it('finds css files', () => {
    const files = findFiles(join(TMP_ROOT, 'src'), /\.css$/);
    expect(files.some((f) => f.endsWith('styles.css'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fileContains
// ---------------------------------------------------------------------------

describe('fileContains', () => {
  it('returns true when file contains a string pattern', () => {
    const file = join(TMP_ROOT, 'src', 'index.tsx');
    expect(fileContains(file, ['aria-label'])).toBe(true);
  });

  it('returns false when file does not contain pattern', () => {
    const file = join(TMP_ROOT, 'src', 'index.tsx');
    expect(fileContains(file, ['nonexistent-pattern-xyz'])).toBe(false);
  });

  it('returns true when file matches a RegExp pattern', () => {
    const file = join(TMP_ROOT, 'src', 'index.tsx');
    expect(fileContains(file, [/data-testid=/])).toBe(true);
  });

  it('returns false for nonexistent file', () => {
    expect(fileContains('/nonexistent/file.tsx', ['anything'])).toBe(false);
  });

  it('returns true when any pattern matches', () => {
    const file = join(TMP_ROOT, 'src', 'index.tsx');
    expect(fileContains(file, ['nonexistent-xyz', 'aria-label'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// countMatches
// ---------------------------------------------------------------------------

describe('countMatches', () => {
  it('counts aria- attributes across all tsx files in src', () => {
    const count = countMatches(join(TMP_ROOT, 'src'), /aria-/g);
    // index.tsx has 1 (aria-label), Card.tsx has 1 (aria-hidden) = 2
    expect(count).toBe(2);
  });

  it('counts data-testid across all tsx files', () => {
    const count = countMatches(join(TMP_ROOT, 'src'), /data-testid=/g);
    // index.tsx: 1, Card.tsx: 1 = 2
    expect(count).toBe(2);
  });

  it('returns 0 for pattern with no matches', () => {
    const count = countMatches(join(TMP_ROOT, 'src'), /FocusTrap/g);
    expect(count).toBe(0);
  });

  it('returns 0 for nonexistent directory', () => {
    const count = countMatches('/nonexistent/path', /aria-/g);
    expect(count).toBe(0);
  });

  it('respects custom file extension filter', () => {
    // Only look at .css files
    const count = countMatches(join(TMP_ROOT, 'src'), /color/g, /\.css$/);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// readFileSafe
// ---------------------------------------------------------------------------

describe('readFileSafe', () => {
  it('returns file content for existing file', () => {
    const content = readFileSafe(join(TMP_ROOT, 'src', 'index.tsx'));
    expect(content).toContain('aria-label');
  });

  it('returns empty string for nonexistent file', () => {
    expect(readFileSafe('/nonexistent/file.tsx')).toBe('');
  });
});
