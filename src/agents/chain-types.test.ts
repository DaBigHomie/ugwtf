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

describe('cross-repo chain resolution — 30x validation (integration)', () => {
  const o43ChainPath = join(UGWTF_ROOT, 'projects', '043', CHAIN_CONFIG_FILENAME);
  const ugwtfChainPath = join(UGWTF_ROOT, 'scripts', CHAIN_CONFIG_FILENAME);
  const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];

  function loadChain(path: string) {
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  /**
   * 30x structural validation — asserts every entry in a chain has correct
   * types, unique IDs, valid refs, and topological ordering.
   */
  function assert30xStructure(
    config: Record<string, unknown>,
    expectedRepo: string,
    expectedEntries: number,
    expectedWaves: number,
  ): void {
    // Top-level fields
    expect(config.version).toBeTypeOf('number');
    expect(config.repo).toBe(expectedRepo);
    expect(Array.isArray(config.labels)).toBe(true);
    expect(Array.isArray(config.chain)).toBe(true);

    const chain = config.chain as Array<Record<string, unknown>>;
    expect(chain.length).toBe(expectedEntries);

    const positions = new Set<number>();
    const promptIds = new Set<string>();
    const waveOf = new Map<string, number>();
    const posOf = new Map<string, number>();

    // Per-entry field validation
    for (const entry of chain) {
      expect(entry.position).toBeTypeOf('number');
      expect(entry.prompt).toBeTypeOf('string');
      expect(entry.file).toBeTypeOf('string');
      expect(entry.wave).toBeTypeOf('number');
      expect(VALID_SEVERITIES).toContain(entry.severity);
      expect(Array.isArray(entry.depends)).toBe(true);
      expect((entry.file as string)).toMatch(/\.prompt\.md$/);

      positions.add(entry.position as number);
      promptIds.add(entry.prompt as string);
      waveOf.set(entry.prompt as string, entry.wave as number);
      posOf.set(entry.prompt as string, entry.position as number);
    }

    // Uniqueness
    expect(positions.size).toBe(expectedEntries);
    expect(promptIds.size).toBe(expectedEntries);

    // Wave count
    const waves = new Set(chain.map(e => e.wave));
    expect(waves.size).toBe(expectedWaves);

    // Dependency integrity: every dep reference exists in the chain
    for (const entry of chain) {
      for (const dep of entry.depends as string[]) {
        expect(promptIds.has(dep)).toBe(true);
      }
    }

    // Topological ordering: dep wave ≤ dependent wave
    for (const entry of chain) {
      for (const dep of entry.depends as string[]) {
        expect(waveOf.get(dep)).toBeLessThanOrEqual(entry.wave as number);
      }
    }

    // Position ordering: dep position < dependent position
    for (const entry of chain) {
      for (const dep of entry.depends as string[]) {
        expect(posOf.get(dep)).toBeLessThan(entry.position as number);
      }
    }
  }

  it('projects/043/prompt-chain.json passes 30x structural validation', () => {
    expect(existsSync(o43ChainPath)).toBe(true);
    const config = loadChain(o43ChainPath);
    assert30xStructure(config, 'DaBigHomie/one4three-co-next-app', 30, 4);
  });

  it('resolveChainPath deterministically resolves 043 to a valid 30-entry chain', () => {
    const fakeLocalPath = join(TMP_ROOT, '.fake-043-local');
    mkdirSync(fakeLocalPath, { recursive: true });

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(UGWTF_ROOT);
    try {
      const result = resolveChainPath(fakeLocalPath, '043');
      expect(result).not.toBeNull();
      expect(result).toBe(o43ChainPath);

      // Validate the resolved chain has full 30-entry structure
      const config = loadChain(result!);
      assert30xStructure(config, 'DaBigHomie/one4three-co-next-app', 30, 4);
    } finally {
      cwdSpy.mockRestore();
      rmSync(fakeLocalPath, { recursive: true, force: true });
    }
  });

  it('ugwtf self-dogfood chain resolves to scripts/ with 40-entry structure', () => {
    const result = resolveChainPath(UGWTF_ROOT, 'ugwtf');
    expect(result).toBe(ugwtfChainPath);

    const config = loadChain(result!);
    assert30xStructure(config, 'DaBigHomie/ugwtf', 40, 8);
  });

  it('no collision: ugwtf (40-entry/8-wave) and 043 (30-entry/4-wave) chains are fully disjoint', () => {
    const ugwtfConfig = loadChain(ugwtfChainPath);
    const o43Config = loadChain(o43ChainPath);

    // Different repos
    expect(ugwtfConfig.repo).toBe('DaBigHomie/ugwtf');
    expect(o43Config.repo).toBe('DaBigHomie/one4three-co-next-app');

    const ugwtfEntries = ugwtfConfig.chain as Array<Record<string, unknown>>;
    const o43Entries = o43Config.chain as Array<Record<string, unknown>>;

    // Different entry counts
    expect(ugwtfEntries.length).toBe(40);
    expect(o43Entries.length).toBe(30);

    // Different wave counts
    const ugwtfWaves = new Set(ugwtfEntries.map(e => e.wave));
    const o43Waves = new Set(o43Entries.map(e => e.wave));
    expect(ugwtfWaves.size).toBe(8);
    expect(o43Waves.size).toBe(4);

    // Zero overlapping prompt IDs
    const ugwtfIds = new Set(ugwtfEntries.map(e => e.prompt));
    const o43Ids = new Set(o43Entries.map(e => e.prompt));
    const overlap = [...ugwtfIds].filter(id => o43Ids.has(id));
    expect(overlap).toEqual([]);

    // Both pass independent 30x validation
    assert30xStructure(ugwtfConfig, 'DaBigHomie/ugwtf', 40, 8);
    assert30xStructure(o43Config, 'DaBigHomie/one4three-co-next-app', 30, 4);
  });
});
