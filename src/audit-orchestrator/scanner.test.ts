import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { findFiles, fileContains, countMatches, readFileSafe } from './scanner.js';

const TEST_DIR = join(import.meta.dirname, '../../.test-tmp-scanner');

describe('audit-orchestrator/scanner', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('findFiles', () => {
    it('returns empty array for non-existent directory', () => {
      expect(findFiles('/nonexistent/path', /\.ts$/)).toEqual([]);
    });

    it('finds files matching extension in a directory', () => {
      writeFileSync(join(TEST_DIR, 'a.ts'), 'content a');
      writeFileSync(join(TEST_DIR, 'b.tsx'), 'content b');
      writeFileSync(join(TEST_DIR, 'c.css'), 'content c');
      const result = findFiles(TEST_DIR, /\.tsx?$/);
      expect(result).toHaveLength(2);
      expect(result.some((f) => f.endsWith('a.ts'))).toBe(true);
      expect(result.some((f) => f.endsWith('b.tsx'))).toBe(true);
    });

    it('recurses into subdirectories', () => {
      const sub = join(TEST_DIR, 'sub');
      mkdirSync(sub, { recursive: true });
      writeFileSync(join(sub, 'nested.ts'), 'nested');
      const result = findFiles(TEST_DIR, /\.ts$/);
      expect(result.some((f) => f.endsWith('nested.ts'))).toBe(true);
    });

    it('ignores node_modules and .next by default', () => {
      const nm = join(TEST_DIR, 'node_modules');
      mkdirSync(nm, { recursive: true });
      writeFileSync(join(nm, 'dep.ts'), 'ignored');
      writeFileSync(join(TEST_DIR, 'real.ts'), 'real');
      const result = findFiles(TEST_DIR, /\.ts$/);
      expect(result.every((f) => !f.includes('node_modules'))).toBe(true);
    });

    it('returns a single file when given a file path matching extension', () => {
      const filePath = join(TEST_DIR, 'single.ts');
      writeFileSync(filePath, 'single');
      const result = findFiles(filePath, /\.ts$/);
      expect(result).toEqual([filePath]);
    });

    it('returns empty array when file path does not match extension', () => {
      const filePath = join(TEST_DIR, 'single.css');
      writeFileSync(filePath, 'css');
      const result = findFiles(filePath, /\.ts$/);
      expect(result).toEqual([]);
    });
  });

  describe('fileContains', () => {
    it('returns false for non-existent file', () => {
      expect(fileContains('/nonexistent.ts', ['pattern'])).toBe(false);
    });

    it('returns true when file contains string pattern', () => {
      const file = join(TEST_DIR, 'check.ts');
      writeFileSync(file, 'export const foo = "bar";');
      expect(fileContains(file, ['foo'])).toBe(true);
    });

    it('returns false when file does not contain any pattern', () => {
      const file = join(TEST_DIR, 'check.ts');
      writeFileSync(file, 'export const foo = "bar";');
      expect(fileContains(file, ['baz', 'qux'])).toBe(false);
    });

    it('returns true when file matches regex pattern', () => {
      const file = join(TEST_DIR, 'check.ts');
      writeFileSync(file, 'aria-label="close"');
      expect(fileContains(file, [/aria-/])).toBe(true);
    });

    it('returns true when at least one pattern matches', () => {
      const file = join(TEST_DIR, 'check.ts');
      writeFileSync(file, 'skip-to-content');
      expect(fileContains(file, ['not-here', 'skip-to'])).toBe(true);
    });
  });

  describe('countMatches', () => {
    it('returns 0 for directory with no matching files', () => {
      expect(countMatches(TEST_DIR, /aria-/g)).toBe(0);
    });

    it('counts pattern matches across files', () => {
      writeFileSync(join(TEST_DIR, 'a.ts'), 'aria-label="x" aria-label="y"');
      writeFileSync(join(TEST_DIR, 'b.ts'), 'aria-hidden="true"');
      const count = countMatches(TEST_DIR, /aria-/g);
      expect(count).toBe(3);
    });

    it('returns 0 when pattern does not match any file', () => {
      writeFileSync(join(TEST_DIR, 'a.ts'), 'export const x = 1;');
      expect(countMatches(TEST_DIR, /nonexistent-pattern-xyz/g)).toBe(0);
    });
  });

  describe('readFileSafe', () => {
    it('returns empty string for non-existent file', () => {
      expect(readFileSafe('/nonexistent/file.ts')).toBe('');
    });

    it('returns file content for existing file', () => {
      const file = join(TEST_DIR, 'safe.ts');
      writeFileSync(file, 'hello world');
      expect(readFileSafe(file)).toBe('hello world');
    });
  });
});
