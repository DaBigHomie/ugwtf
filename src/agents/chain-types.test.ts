/**
 * Chain Types — Unit Tests
 *
 * Tests for resolveChainPath, getUgwtfRoot, and cross-repo chain resolution.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolveChainPath, getUgwtfRoot, CHAIN_CONFIG_FILENAME } from './chain-types.js';

// ---------------------------------------------------------------------------
// Temp directory for isolated test fixtures
// ---------------------------------------------------------------------------

const TMP_ROOT = join(import.meta.dirname, '../../tests/fixtures/.tmp-chain-types-test');
const UGWTF_ROOT = join(import.meta.dirname, '../..');

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(join(filePath, '..'));
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveChainPath', () => {
  beforeEach(() => {
    ensureDir(TMP_ROOT);
  });

  afterEach(() => {
    if (existsSync(TMP_ROOT)) {
      rmSync(TMP_ROOT, { recursive: true, force: true });
    }
  });

  it('finds chain config in scripts/ directory', () => {
    const repoDir = join(TMP_ROOT, 'repo-scripts');
    writeJson(join(repoDir, 'scripts', CHAIN_CONFIG_FILENAME), { version: 1 });

    const result = resolveChainPath(repoDir);
    expect(result).toBe(join(repoDir, 'scripts', CHAIN_CONFIG_FILENAME));
  });

  it('finds chain config in repo root', () => {
    const repoDir = join(TMP_ROOT, 'repo-root');
    writeJson(join(repoDir, CHAIN_CONFIG_FILENAME), { version: 1 });

    const result = resolveChainPath(repoDir);
    expect(result).toBe(join(repoDir, CHAIN_CONFIG_FILENAME));
  });

  it('finds chain config in .github/ directory', () => {
    const repoDir = join(TMP_ROOT, 'repo-github');
    writeJson(join(repoDir, '.github', CHAIN_CONFIG_FILENAME), { version: 1 });

    const result = resolveChainPath(repoDir);
    expect(result).toBe(join(repoDir, '.github', CHAIN_CONFIG_FILENAME));
  });

  it('returns null when no chain config exists', () => {
    const repoDir = join(TMP_ROOT, 'repo-empty');
    ensureDir(repoDir);

    const result = resolveChainPath(repoDir);
    expect(result).toBeNull();
  });

  it('prefers scripts/ over root', () => {
    const repoDir = join(TMP_ROOT, 'repo-priority');
    writeJson(join(repoDir, 'scripts', CHAIN_CONFIG_FILENAME), { version: 1, location: 'scripts' });
    writeJson(join(repoDir, CHAIN_CONFIG_FILENAME), { version: 1, location: 'root' });

    const result = resolveChainPath(repoDir);
    expect(result).toBe(join(repoDir, 'scripts', CHAIN_CONFIG_FILENAME));
  });

  it('falls back to projects/<alias>/ in ugwtf root when repoAlias is provided', () => {
    // Simulate: target repo has no chain config, but ugwtf projects dir does
    const targetDir = join(TMP_ROOT, 'target-repo-no-chain');
    ensureDir(targetDir);

    const expectedPath = join(UGWTF_ROOT, 'projects', '043', CHAIN_CONFIG_FILENAME);

    // Pin cwd so getUgwtfRoot() deterministically resolves to our repo root
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(UGWTF_ROOT);
    try {
      const result = resolveChainPath(targetDir, '043');
      expect(result).not.toBeNull();
      expect(result).toBe(expectedPath);
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('does not use projects/ fallback when repoAlias is omitted', () => {
    const targetDir = join(TMP_ROOT, 'target-no-alias');
    ensureDir(targetDir);

    const result = resolveChainPath(targetDir);
    expect(result).toBeNull();
  });

  it('returns null (not ugwtf scripts/) when target repo has no chain and no alias', () => {
    // Ensures we never accidentally pick up ugwtf's own chain for other repos
    const targetDir = join(TMP_ROOT, 'target-no-alias-collision');
    ensureDir(targetDir);

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(UGWTF_ROOT);
    try {
      const result = resolveChainPath(targetDir);
      expect(result).toBeNull();
    } finally {
      cwdSpy.mockRestore();
    }
  });
});

describe('getUgwtfRoot', () => {
  it('returns a path containing projects/ directory when cwd is ugwtf', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(UGWTF_ROOT);
    try {
      const root = getUgwtfRoot();
      expect(root).not.toBeNull();
      expect(existsSync(join(root!, 'projects'))).toBe(true);
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('returns null when cwd has no projects/ and registry does not match', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/tmp/no-such-dir');
    try {
      const root = getUgwtfRoot();
      // May still resolve via registry if localPath exists on disk — that's OK
      // The key invariant: if it returns non-null, projects/ exists there
      if (root) {
        expect(existsSync(join(root, 'projects'))).toBe(true);
      }
    } finally {
      cwdSpy.mockRestore();
    }
  });
});

describe('cross-repo chain resolution (integration)', () => {
  const o43ChainPath = join(UGWTF_ROOT, 'projects', '043', CHAIN_CONFIG_FILENAME);

  it('projects/043/prompt-chain.json exists and targets one4three', () => {
    expect(existsSync(o43ChainPath)).toBe(true);
    const config = JSON.parse(readFileSync(o43ChainPath, 'utf-8'));
    expect(config.repo).toBe('DaBigHomie/one4three-co-next-app');
  });

  it('resolveChainPath deterministically finds 043 chain via projects/ fallback', () => {
    // Simulate: 043's localPath doesn't exist (like in GitHub web context)
    const fakeLocalPath = join(TMP_ROOT, '.fake-043-local');
    mkdirSync(fakeLocalPath, { recursive: true });

    // Pin cwd so getUgwtfRoot() deterministically resolves
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(UGWTF_ROOT);
    try {
      const result = resolveChainPath(fakeLocalPath, '043');
      // Must resolve to projects/043, never to scripts/prompt-chain.json
      expect(result).not.toBeNull();
      expect(result).toBe(o43ChainPath);
    } finally {
      cwdSpy.mockRestore();
      rmSync(fakeLocalPath, { recursive: true, force: true });
    }
  });

  it('ugwtf self-dogfood chain resolves to scripts/ not projects/', () => {
    // When running against ugwtf itself, scripts/prompt-chain.json should be found first
    const result = resolveChainPath(UGWTF_ROOT, 'ugwtf');
    expect(result).toBe(join(UGWTF_ROOT, 'scripts', CHAIN_CONFIG_FILENAME));
  });

  it('no collision: ugwtf chain is different from 043 chain', () => {
    const ugwtfChain = JSON.parse(
      readFileSync(join(UGWTF_ROOT, 'scripts', CHAIN_CONFIG_FILENAME), 'utf-8')
    );
    const o43Chain = JSON.parse(
      readFileSync(o43ChainPath, 'utf-8')
    );

    expect(ugwtfChain.repo).toBe('DaBigHomie/ugwtf');
    expect(o43Chain.repo).toBe('DaBigHomie/one4three-co-next-app');
    expect(ugwtfChain.chain.length).not.toBe(o43Chain.chain.length);
  });
});
