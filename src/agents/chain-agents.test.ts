/**
 * Chain Generator Agent — Integration Tests
 *
 * Tests the full generate-chain pipeline: prompt scanning, dependency parsing,
 * toposort, wave assignment, and output generation using test fixtures.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { chainGeneratorAgents } from './chain-generator.js';
import { scanAllPrompts, clearPromptScanCache } from '../prompt/index.js';
import type { AgentContext, AgentResult } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = join(import.meta.dirname, '../../tests/fixtures/test-repo');

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    repoAlias: 'test-repo',
    repoSlug: 'DaBigHomie/test-repo',
    localPath: FIXTURES_DIR,
    dryRun: true,
    extras: {},
    github: {} as AgentContext['github'],
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
      debug: vi.fn(),
    } as unknown as AgentContext['logger'],
    ...overrides,
  };
}

// Mock getRepo so the agent can resolve our test repo alias
vi.mock('../config/repo-registry.js', () => ({
  UNIVERSAL_LABELS: [],
  getRepo: vi.fn((alias: string) => {
    if (alias === 'test-repo') {
      return {
        alias: 'test-repo',
        slug: 'DaBigHomie/test-repo',
        owner: 'DaBigHomie',
        name: 'test-repo',
        localPath: join(import.meta.dirname, '../../tests/fixtures/test-repo'),
      };
    }
    return undefined;
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scanAllPrompts', () => {
  beforeEach(() => {
    clearPromptScanCache();
  });

  it('discovers prompts in all scan directories', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    // 7 in docs/prompts/feature-improvements + 1 in .github/prompts
    expect(prompts.length).toBeGreaterThanOrEqual(7);
  });

  it('parses Format B prompts correctly', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const setup = prompts.find(p => p.fileName.includes('01-setup'));
    expect(setup).toBeDefined();
    expect(setup!.format).toBe('B');
    expect(setup!.priority).toBe('P0');
    expect(setup!.title).toContain('Setup Foundation');
  });

  it('parses "Dependencies: None" as empty array', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const setup = prompts.find(p => p.fileName.includes('01-setup'));
    expect(setup!.depends).toEqual([]);
  });

  it('parses "Dependencies: Gaps #1, #2" correctly', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const auth = prompts.find(p => p.fileName.includes('03-auth'));
    expect(auth).toBeDefined();
    expect(auth!.depends).toContain('#1');
    expect(auth!.depends).toContain('#2');
  });

  it('parses single dep "Gaps #2"', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const api = prompts.find(p => p.fileName.includes('04-api'));
    expect(api).toBeDefined();
    expect(api!.depends).toEqual(['#2']);
  });

  it('parses "can run in parallel" as empty deps', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const email = prompts.find(p => p.fileName.includes('06-email'));
    expect(email).toBeDefined();
    expect(email!.depends).toEqual([]);
  });
});

describe('chainGenerator agent', () => {
  const agent = chainGeneratorAgents[0]!;

  beforeEach(() => {
    clearPromptScanCache();
  });

  it('agent exists and has correct id', () => {
    expect(agent).toBeDefined();
    expect(agent.id).toBe('chain-generator');
    expect(agent.clusterId).toBe('generate-chain');
  });

  it('shouldRun returns true', () => {
    const ctx = makeCtx();
    expect(agent.shouldRun(ctx)).toBe(true);
  });

  it('generates chain in dry-run mode (all prompts)', async () => {
    const ctx = makeCtx({ dryRun: true, extras: {} });
    const result = await agent.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.message).toContain('DRY RUN');
    expect(result.message).toMatch(/\d+ entries/);
    expect(result.message).toMatch(/\d+ waves/);
  });

  it('scopes to folder with --path', async () => {
    const ctx = makeCtx({
      dryRun: true,
      extras: { path: 'docs/prompts/feature-improvements' },
    });
    const result = await agent.execute(ctx);

    expect(result.status).toBe('success');
    // Should have exactly the 7 prompts from feature-improvements, NOT the .github/prompts one
    expect(result.message).toContain('7 entries');
  });

  it('scopes to single file with --path', async () => {
    const ctx = makeCtx({
      dryRun: true,
      extras: { path: 'docs/prompts/feature-improvements/01-setup-foundation.prompt.md' },
    });
    const result = await agent.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.message).toContain('1 entries');
  });

  it('returns skipped when --path matches nothing', async () => {
    const ctx = makeCtx({
      dryRun: true,
      extras: { path: 'nonexistent/folder' },
    });
    const result = await agent.execute(ctx);

    expect(result.status).toBe('skipped');
    expect(result.message).toContain('No prompts');
  });

  it('returns failed for unknown repo alias', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent-repo' });
    const result = await agent.execute(ctx);

    expect(result.status).toBe('failed');
    expect(result.message).toContain('Repo not found');
  });

  it('assigns correct waves based on dependencies', async () => {
    const ctx = makeCtx({
      dryRun: true,
      extras: { path: 'docs/prompts/feature-improvements' },
    });
    const result = await agent.execute(ctx);

    // Check that the logger was called with wave information
    const infoCalls = (ctx.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const waveLines = infoCalls
      .map(c => String(c[0]))
      .filter(s => /wave \d/.test(s));

    // Wave 1: prompts 01, 02, 06 (no deps)
    // Wave 2: prompts 03, 04 (depend on 01/02)
    // Wave 3: prompt 05 (depends on 03, 04)
    // Wave 4: prompt 07 (depends on 05)
    expect(waveLines.length).toBeGreaterThanOrEqual(7);

    // Verify wave 1 items have no depends
    const wave1Lines = waveLines.filter(s => /wave 1/.test(s));
    for (const line of wave1Lines) {
      expect(line).not.toContain('depends');
    }
  });

  it('writes output file in non-dry-run mode with 30x structural validation', async () => {
    const ctx = makeCtx({
      dryRun: false,
      extras: { path: 'docs/prompts/feature-improvements' },
    });
    const result = await agent.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.artifacts.length).toBeGreaterThan(0);

    // Output goes to the natural path — temp directories are a violation.
    // Tests must validate real-world output paths to catch path-routing bugs
    // like the original collision (ugwtf scripts/ vs projects/<alias>/).
    // Cleanup via rmSync in finally block keeps the working tree pristine.
    const outputPath = result.artifacts[0]!;
    expect(existsSync(outputPath)).toBe(true);

    try {
      const config = JSON.parse(readFileSync(outputPath, 'utf-8'));

      // -- Top-level 30x validation --
      expect(config.version).toBe(3);
      expect(config.repo).toBe('DaBigHomie/test-repo');
      expect(config.description).toBeTypeOf('string');
      expect(Array.isArray(config.labels)).toBe(true);
      expect(config.labels.length).toBeGreaterThan(0);
      expect(Array.isArray(config.chain)).toBe(true);
      expect(config.chain.length).toBe(7);

      // -- Per-entry structural validation --
      const validSeverities = ['critical', 'high', 'medium', 'low'];
      const positions = new Set<number>();
      const promptIds = new Set<string>();
      const waveOf = new Map<string, number>();
      const posOf = new Map<string, number>();

      for (const entry of config.chain) {
        // Required field types
        expect(entry.position).toBeTypeOf('number');
        expect(entry.prompt).toBeTypeOf('string');
        expect(entry.file).toBeTypeOf('string');
        expect(entry.wave).toBeTypeOf('number');
        expect(validSeverities).toContain(entry.severity);
        expect(Array.isArray(entry.depends)).toBe(true);

        // Prompt file path convention
        expect(entry.file).toMatch(/\.prompt\.md$/);

        // Collect for aggregate checks
        positions.add(entry.position);
        promptIds.add(entry.prompt);
        waveOf.set(entry.prompt, entry.wave);
        posOf.set(entry.prompt, entry.position);
      }

      // -- Uniqueness --
      expect(positions.size).toBe(7);
      expect(promptIds.size).toBe(7);

      // -- Dependency integrity: every dep ref exists --
      for (const entry of config.chain) {
        for (const dep of entry.depends) {
          expect(promptIds.has(dep)).toBe(true);
        }
      }

      // -- Topological ordering: dep position < dependent position --
      for (const entry of config.chain) {
        for (const dep of entry.depends) {
          const depPos = posOf.get(dep);
          expect(depPos).toBeDefined();
          expect(depPos).toBeLessThan(entry.position);
        }
      }

      // -- Wave ordering: dep wave < dependent wave --
      for (const entry of config.chain) {
        for (const dep of entry.depends) {
          expect(waveOf.get(dep)).toBeLessThan(entry.wave);
        }
      }

      // -- Wave structure: exactly 4 waves for the 7-entry fixture --
      const waves = new Set(config.chain.map((e: { wave: number }) => e.wave));
      expect(waves.size).toBe(4);

      // -- Positions are sequential from 1 --
      const sortedPositions = [...positions].sort((a, b) => a - b);
      expect(sortedPositions[0]).toBe(1);
      expect(sortedPositions[sortedPositions.length - 1]).toBe(7);
    } finally {
      // Clean up generated file — keeps the working tree pristine
      rmSync(outputPath, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Real chain file validation — projects/043/prompt-chain.json
// ---------------------------------------------------------------------------

describe('real chain file: projects/043/prompt-chain.json', () => {
  const chainPath = join(import.meta.dirname, '../../projects/043/prompt-chain.json');

  it('exists and is valid JSON', () => {
    expect(existsSync(chainPath)).toBe(true);
    const raw = readFileSync(chainPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('has required top-level fields', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    expect(typeof config.version).toBe('number');
    expect(typeof config.repo).toBe('string');
    expect(Array.isArray(config.labels)).toBe(true);
    expect(Array.isArray(config.chain)).toBe(true);
  });

  it('has 30 chain entries', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    expect(config.chain.length).toBe(30);
  });

  it('entries have unique positions', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    const positions = config.chain.map((e: { position: number }) => e.position);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('entries have unique prompt IDs', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    const prompts = config.chain.map((e: { prompt: string }) => e.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('entries have valid severity values', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    const valid = ['critical', 'high', 'medium', 'low'];
    for (const entry of config.chain) {
      expect(valid).toContain(entry.severity);
    }
  });

  it('dependency references exist in the chain', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    const promptIds = new Set(config.chain.map((e: { prompt: string }) => e.prompt));
    for (const entry of config.chain) {
      for (const dep of entry.depends) {
        expect(promptIds.has(dep)).toBe(true);
      }
    }
  });

  it('wave ordering respects dependencies (dep wave <= dependent wave)', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    const waveOf = new Map<string, number>();
    for (const entry of config.chain) {
      waveOf.set(entry.prompt, entry.wave);
    }
    for (const entry of config.chain) {
      for (const dep of entry.depends) {
        expect(waveOf.get(dep)).toBeLessThanOrEqual(entry.wave);
      }
    }
  });

  it('position ordering respects dependencies (dep position < dependent position)', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    const posOf = new Map<string, number>();
    for (const entry of config.chain) {
      posOf.set(entry.prompt, entry.position);
    }
    for (const entry of config.chain) {
      for (const dep of entry.depends) {
        expect(posOf.get(dep)).toBeLessThan(entry.position);
      }
    }
  });

  it('has exactly 4 waves', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    const waves = new Set(config.chain.map((e: { wave: number }) => e.wave));
    expect(waves.size).toBe(4);
  });

  it('repo slug matches ONE4THREE', () => {
    const config = JSON.parse(readFileSync(chainPath, 'utf-8'));
    expect(config.repo).toBe('DaBigHomie/one4three-co-next-app');
  });
});
