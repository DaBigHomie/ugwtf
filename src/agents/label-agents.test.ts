/**
 * Label Agents — Unit Tests
 *
 * Tests syncLabelsAgent and auditLabelsAgent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { labelAgents } from './label-agents.js';
import type { AgentContext } from '../types.js';

vi.mock('../config/repo-registry.js', () => ({
  getRepo: vi.fn((alias: string) => {
    if (alias === 'test-repo') {
      return {
        alias: 'test-repo',
        slug: 'DaBigHomie/test-repo',
        framework: 'vite-react',
        supabaseProjectId: 'abc123',
        extraLabels: [{ name: 'custom-label', color: 'ff0000', description: 'Custom' }],
        localPath: '/tmp/test-repo',
        nodeVersion: '20',
        defaultBranch: 'main',
      };
    }
    return undefined;
  }),
  UNIVERSAL_LABELS: [
    { name: 'priority:p0', color: 'b60205', description: 'Critical' },
    { name: 'priority:p1', color: 'd93f0b', description: 'High' },
    { name: 'bug', color: 'ee0701', description: 'Bug report' },
  ],
}));

function mockGitHub() {
  return {
    listLabels: vi.fn().mockResolvedValue([]),
    syncLabel: vi.fn().mockResolvedValue(undefined),
    deleteLabel: vi.fn(),
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

const [syncLabelsAgent, auditLabelsAgent] = labelAgents;

// ---------------------------------------------------------------------------
// syncLabelsAgent
// ---------------------------------------------------------------------------

describe('syncLabelsAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id and clusterId', () => {
    expect(syncLabelsAgent!.id).toBe('label-sync');
    expect(syncLabelsAgent!.clusterId).toBe('labels');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await syncLabelsAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('not found');
  });

  it('creates new labels when none exist', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([]);

    const result = await syncLabelsAgent!.execute(ctx);
    // 3 universal + 1 extra = 4 labels synced
    expect(gh.syncLabel).toHaveBeenCalledTimes(4);
    expect(result.status).toBe('success');
    expect(result.message).toContain('created');
  });

  it('reports updated when labels already exist', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'priority:p0', color: 'b60205', description: 'Critical' },
      { name: 'bug', color: 'ee0701', description: 'Bug report' },
    ]);

    const result = await syncLabelsAgent!.execute(ctx);
    expect(result.status).toBe('success');
    // 2 already exist → updated, 2 new → created
    expect(result.message).toMatch(/2 created.*2 updated|2 updated.*2 created/);
  });

  it('reports errors when syncLabel throws', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([]);
    gh.syncLabel.mockRejectedValue(new Error('API error'));

    const result = await syncLabelsAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('errors');
  });

  it('includes extraLabels in sync', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([]);

    await syncLabelsAgent!.execute(ctx);
    const syncedNames = gh.syncLabel.mock.calls.map((c: unknown[]) => (c[2] as { name: string }).name);
    expect(syncedNames).toContain('custom-label');
  });

  it('records synced label names in artifacts', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([]);

    const result = await syncLabelsAgent!.execute(ctx);
    expect(result.artifacts).toContain('priority:p0');
    expect(result.artifacts).toContain('priority:p1');
    expect(result.artifacts).toContain('bug');
    expect(result.artifacts).toContain('custom-label');
  });
});

// ---------------------------------------------------------------------------
// auditLabelsAgent
// ---------------------------------------------------------------------------

describe('auditLabelsAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(auditLabelsAgent!.id).toBe('label-audit');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await auditLabelsAgent!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('reports success when all labels present and correct', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'priority:p0', color: 'b60205', description: 'Critical' },
      { name: 'priority:p1', color: 'd93f0b', description: 'High' },
      { name: 'bug', color: 'ee0701', description: 'Bug report' },
      { name: 'custom-label', color: 'ff0000', description: 'Custom' },
    ]);

    const result = await auditLabelsAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Missing: 0');
    expect(result.message).toContain('Drifted: 0');
  });

  it('detects missing labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'priority:p0', color: 'b60205', description: 'Critical' },
    ]);

    const result = await auditLabelsAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.artifacts).toContain('MISSING: priority:p1');
    expect(result.artifacts).toContain('MISSING: bug');
    expect(result.artifacts).toContain('MISSING: custom-label');
  });

  it('detects drifted labels (wrong color)', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'priority:p0', color: '000000', description: 'Critical' },
      { name: 'priority:p1', color: 'd93f0b', description: 'High' },
      { name: 'bug', color: 'ee0701', description: 'Bug report' },
      { name: 'custom-label', color: 'ff0000', description: 'Custom' },
    ]);

    const result = await auditLabelsAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.artifacts).toContain('DRIFTED: priority:p0');
  });

  it('detects drifted labels (wrong description)', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'priority:p0', color: 'b60205', description: 'Changed description' },
      { name: 'priority:p1', color: 'd93f0b', description: 'High' },
      { name: 'bug', color: 'ee0701', description: 'Bug report' },
      { name: 'custom-label', color: 'ff0000', description: 'Custom' },
    ]);

    const result = await auditLabelsAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.artifacts).toContain('DRIFTED: priority:p0');
  });

  it('reports extra labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([
      { name: 'priority:p0', color: 'b60205', description: 'Critical' },
      { name: 'priority:p1', color: 'd93f0b', description: 'High' },
      { name: 'bug', color: 'ee0701', description: 'Bug report' },
      { name: 'custom-label', color: 'ff0000', description: 'Custom' },
      { name: 'random-label', color: 'ffffff', description: 'Not expected' },
    ]);

    const result = await auditLabelsAgent!.execute(ctx);
    expect(result.status).toBe('success'); // Extra labels don't cause failure
    expect(result.artifacts).toContain('EXTRA: random-label');
    expect(result.message).toContain('Extra: 1');
  });

  it('returns failed when API call fails', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockRejectedValue(new Error('API error'));

    const result = await auditLabelsAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Cannot fetch labels');
  });
});
