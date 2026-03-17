import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeFile, repoPath, yamlStr } from '../utils/fs.js';
import type { RepoConfig } from '../config/repo-registry.js';

const TEST_DIR = join(import.meta.dirname, '../../.test-tmp');

describe('utils/fs', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('writeFile', () => {
    it('creates a new file', () => {
      const filePath = join(TEST_DIR, 'new-file.txt');
      const result = writeFile(filePath, 'hello');
      expect(result.action).toBe('created');
      expect(readFileSync(filePath, 'utf-8')).toBe('hello');
    });

    it('creates nested directories', () => {
      const filePath = join(TEST_DIR, 'a/b/c/deep.txt');
      const result = writeFile(filePath, 'deep');
      expect(result.action).toBe('created');
      expect(readFileSync(filePath, 'utf-8')).toBe('deep');
    });

    it('skips write when content is identical', () => {
      const filePath = join(TEST_DIR, 'same.txt');
      writeFileSync(filePath, 'same');
      const result = writeFile(filePath, 'same');
      expect(result.action).toBe('skipped');
    });

    it('updates file when content differs', () => {
      const filePath = join(TEST_DIR, 'changed.txt');
      writeFileSync(filePath, 'old');
      const result = writeFile(filePath, 'new');
      expect(result.action).toBe('updated');
      expect(readFileSync(filePath, 'utf-8')).toBe('new');
    });

    it('returns the absolute path', () => {
      const filePath = join(TEST_DIR, 'path-check.txt');
      const result = writeFile(filePath, 'x');
      expect(result.path).toBe(filePath);
    });
  });

  describe('repoPath', () => {
    it('joins segments onto localPath', () => {
      const fakeRepo = { localPath: '/repos/my-repo' } as RepoConfig;
      expect(repoPath(fakeRepo, '.github', 'workflows', 'ci.yml'))
        .toBe('/repos/my-repo/.github/workflows/ci.yml');
    });

    it('works with no segments', () => {
      const fakeRepo = { localPath: '/repos/my-repo' } as RepoConfig;
      expect(repoPath(fakeRepo)).toBe('/repos/my-repo');
    });
  });

  describe('yamlStr', () => {
    it('wraps string in single quotes', () => {
      expect(yamlStr('hello')).toBe("'hello'");
    });

    it('escapes single quotes', () => {
      expect(yamlStr("it's")).toBe("'it''s'");
    });

    it('handles empty string', () => {
      expect(yamlStr('')).toBe("''");
    });
  });
});
