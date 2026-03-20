/**
 * Fix Agents — Unit Tests
 *
 * Tests fixLabelAgent, fixWorkflowAgent, fixTypesAgent, fixConfigAgent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fixAgents } from './fix-agents.js';
import type { AgentContext } from '../types.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../config/repo-registry.js', () => ({
  getRepo: vi.fn((alias: string) => {
    if (alias === 'test-repo') {
      return {
        alias: 'test-repo',
        slug: 'DaBigHomie/test-repo',
        framework: 'vite-react',
        supabaseProjectId: 'abc123',
        supabaseTypesPath: 'src/integrations/supabase/types.ts',
        extraLabels: [{ name: 'custom-label', color: 'ff0000', description: 'Custom' }],
        localPath: '/tmp/test-repo',
        nodeVersion: '20',
        defaultBranch: 'main',
      };
    }
    if (alias === 'no-supabase') {
      return {
        alias: 'no-supabase',
        slug: 'DaBigHomie/no-supabase',
        framework: 'next',
        supabaseProjectId: undefined,
        supabaseTypesPath: undefined,
        extraLabels: [],
        localPath: '/tmp/no-supabase',
        nodeVersion: '20',
        defaultBranch: 'main',
      };
    }
    return undefined;
  }),
  UNIVERSAL_LABELS: [
    { name: 'priority:p0', color: 'b60205', description: 'Critical' },
    { name: 'bug', color: 'ee0701', description: 'Bug report' },
  ],
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ mtimeMs: 1000 }),
  readdirSync: vi.fn().mockReturnValue([]),
}));

vi.mock('../utils/fs.js', () => ({
  repoPath: vi.fn((_repo: unknown, ...segments: string[]) =>
    `/tmp/test-repo/${segments.join('/')}`
  ),
}));

vi.mock('../utils/common.js', () => ({
  parseSlug: vi.fn((slug: string) => {
    const [owner, repo] = slug.split('/');
    return { owner, repo };
  }),
}));

function mockGitHub() {
  return {
    listLabels: vi.fn().mockResolvedValue([]),
    syncLabel: vi.fn().mockResolvedValue(undefined),
    deleteLabel: vi.fn().mockResolvedValue(undefined),
    addLabels: vi.fn(),
    addComment: vi.fn(),
    assignIssue: vi.fn(),
    removeLabel: vi.fn(),
    listIssues: vi.fn(),
    listPRs: vi.fn(),
    createIssue: vi.fn(),
    getPRFiles: vi.fn(),
    listWorkflowRuns: vi.fn(),
    getFileContents: vi.fn(),
    listBranches: vi.fn(),
    getRateLimit: vi.fn(),
  };
}

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    repoAlias: 'test-repo',
    repoSlug: 'DaBigHomie/test-repo',
    localPath: '/tmp/test-repo',
    dryRun: false,
    extras: {},
    github: mockGitHub() as unknown as AgentContext['github'],
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

const [fixLabelAgent, fixWorkflowAgent, fixTypesAgent, fixConfigAgent] = fixAgents;

// ---------------------------------------------------------------------------
// fixLabelAgent
// ---------------------------------------------------------------------------

describe('fixLabelAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id and clusterId', () => {
    expect(fixLabelAgent!.id).toBe('fix-labels');
    expect(fixLabelAgent!.clusterId).toBe('fix');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await fixLabelAgent!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('syncs all expected labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([]);

    const result = await fixLabelAgent!.execute(ctx);
    // 2 universal + 1 extra = 3
    expect(gh.syncLabel).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('success');
  });

  it('removes orphan labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'priority:p0', color: 'b60205', description: 'Critical' },
      { name: 'orphan-label', color: '000000', description: 'Should be removed' },
    ]);

    const result = await fixLabelAgent!.execute(ctx);
    expect(gh.deleteLabel).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 'orphan-label');
    expect(result.artifacts).toContain('Removed: orphan-label');
  });

  it('does not remove expected labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'priority:p0', color: 'b60205', description: 'Critical' },
      { name: 'bug', color: 'ee0701', description: 'Bug report' },
      { name: 'custom-label', color: 'ff0000', description: 'Custom' },
    ]);

    await fixLabelAgent!.execute(ctx);
    expect(gh.deleteLabel).not.toHaveBeenCalled();
  });

  it('uses dryRun mode correctly', async () => {
    const ctx = makeCtx({ dryRun: true });
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'orphan-label', color: '000000', description: 'Orphan' },
    ]);

    const result = await fixLabelAgent!.execute(ctx);
    expect(gh.syncLabel).not.toHaveBeenCalled();
    expect(gh.deleteLabel).not.toHaveBeenCalled();
    expect(result.artifacts.some(a => a.includes('DRY'))).toBe(true);
  });

  it('reports errors when API fails', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockRejectedValue(new Error('API error'));

    const result = await fixLabelAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Cannot fetch labels');
  });
});

// ---------------------------------------------------------------------------
// fixWorkflowAgent
// ---------------------------------------------------------------------------

describe('fixWorkflowAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(fixWorkflowAgent!.id).toBe('fix-workflows');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await fixWorkflowAgent!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('reports all present when files exist', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);

    const ctx = makeCtx();
    const result = await fixWorkflowAgent!.execute(ctx);
    expect(result.message).toContain('4/4');
    expect(result.artifacts.length).toBe(0);
  });

  it('reports missing workflow files', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockImplementation((path: unknown) => {
      return !(path as string).includes('ci.yml');
    });

    const ctx = makeCtx();
    const result = await fixWorkflowAgent!.execute(ctx);
    expect(result.artifacts).toContain('Missing: ci.yml');
  });
});

// ---------------------------------------------------------------------------
// fixTypesAgent
// ---------------------------------------------------------------------------

describe('fixTypesAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(fixTypesAgent!.id).toBe('fix-types');
  });

  it('returns skipped when no supabase project', async () => {
    const ctx = makeCtx({ repoAlias: 'no-supabase' });
    const result = await fixTypesAgent!.execute(ctx);
    expect(result.status).toBe('skipped');
  });

  it('returns failed when types file missing', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);

    const ctx = makeCtx();
    const result = await fixTypesAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('not found');
  });

  it('reports fresh types when no migrations are newer', async () => {
    const { existsSync, statSync, readdirSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ mtimeMs: 2000 } as ReturnType<typeof statSync>);
    vi.mocked(readdirSync).mockReturnValue(['20250101_init.sql'] as unknown as ReturnType<typeof readdirSync>);

    const ctx = makeCtx();
    const result = await fixTypesAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('fresh');
  });

  it('reports stale types when migration is newer', async () => {
    const { existsSync, statSync, readdirSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);

    let callCount = 0;
    vi.mocked(statSync).mockImplementation(() => {
      callCount++;
      // First call = types file (older), second call = migration (newer)
      return { mtimeMs: callCount === 1 ? 1000 : 5000 } as ReturnType<typeof statSync>;
    });
    vi.mocked(readdirSync).mockReturnValue(['20250101_init.sql'] as unknown as ReturnType<typeof readdirSync>);

    const ctx = makeCtx();
    const result = await fixTypesAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('STALE');
    expect(result.message).toContain('abc123'); // supabaseProjectId
  });

  it('ignores .skip migration files', async () => {
    const { existsSync, statSync, readdirSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ mtimeMs: 2000 } as ReturnType<typeof statSync>);
    vi.mocked(readdirSync).mockReturnValue(['20250101_init.skip'] as unknown as ReturnType<typeof readdirSync>);

    const ctx = makeCtx();
    const result = await fixTypesAgent!.execute(ctx);
    expect(result.status).toBe('success');
  });

  it('shouldRun returns false when no supabaseProjectId', () => {
    const ctx = makeCtx({ repoAlias: 'no-supabase' });
    expect(fixTypesAgent!.shouldRun!(ctx)).toBe(false);
  });

  it('shouldRun returns true when supabaseProjectId present', () => {
    const ctx = makeCtx(); // test-repo has supabaseProjectId
    expect(fixTypesAgent!.shouldRun!(ctx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fixConfigAgent
// ---------------------------------------------------------------------------

describe('fixConfigAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(fixConfigAgent!.id).toBe('fix-config');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await fixConfigAgent!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('reports success when all configs exist', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);

    const ctx = makeCtx();
    const result = await fixConfigAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('All configs present');
  });

  it('reports missing tsconfig.json', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockImplementation((path: unknown) => {
      return !(path as string).includes('tsconfig.json');
    });

    const ctx = makeCtx();
    const result = await fixConfigAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.artifacts).toContain('Missing: tsconfig.json');
  });

  it('reports missing eslint config when no variant exists', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockImplementation((path: unknown) => {
      const p = path as string;
      // All required configs present, but no eslint variant
      return !p.includes('eslint') && !p.includes('.eslintrc');
    });

    const ctx = makeCtx();
    const result = await fixConfigAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.artifacts.some(a => a.includes('eslint'))).toBe(true);
  });

  it('accepts any eslint variant', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockImplementation((path: unknown) => {
      const p = path as string;
      // Only eslint.config.mjs exists among eslint variants
      if (p.includes('eslint.config.mjs')) return true;
      if (p.includes('eslint') || p.includes('.eslintrc')) return false;
      return true; // other required configs exist
    });

    const ctx = makeCtx();
    const result = await fixConfigAgent!.execute(ctx);
    expect(result.status).toBe('success');
  });
});
