/**
 * Audit Agents — Unit Tests
 *
 * Tests fullAuditAgent and scoreboardAgent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditAgents } from './audit-agents.js';
import type { AgentContext, GitHubIssue, GitHubPR } from '../types.js';

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
        extraLabels: [],
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
    { name: 'priority:p1', color: 'd93f0b', description: 'High' },
    { name: 'bug', color: 'ee0701', description: 'Bug report' },
  ],
  allAliases: vi.fn(() => ['test-repo']),
}));

vi.mock('../utils/fs.js', () => ({
  writeFile: vi.fn(),
}));

function mockGitHub() {
  return {
    listLabels: vi.fn().mockResolvedValue([
      { name: 'priority:p0', color: 'b60205', description: 'Critical' },
      { name: 'priority:p1', color: 'd93f0b', description: 'High' },
      { name: 'bug', color: 'ee0701', description: 'Bug report' },
    ]),
    syncLabel: vi.fn(),
    deleteLabel: vi.fn(),
    addLabels: vi.fn(),
    addComment: vi.fn(),
    assignIssue: vi.fn(),
    removeLabel: vi.fn(),
    listIssues: vi.fn().mockResolvedValue([]),
    listPRs: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn(),
    getPRFiles: vi.fn(),
    listWorkflowRuns: vi.fn().mockResolvedValue([]),
    getFileContents: vi.fn().mockResolvedValue('content'),
    listBranches: vi.fn().mockResolvedValue([{ name: 'main' }]),
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

const [fullAuditAgent, scoreboardAgent] = auditAgents;

// ---------------------------------------------------------------------------
// fullAuditAgent
// ---------------------------------------------------------------------------

describe('fullAuditAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id and clusterId', () => {
    expect(fullAuditAgent!.id).toBe('audit-full');
    expect(fullAuditAgent!.clusterId).toBe('audit');
  });

  it('passes when all domains are healthy', async () => {
    const ctx = makeCtx();
    const result = await fullAuditAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Score:');
    // With all labels present, all workflows present, no issues, no PRs, 1 branch → high score
    expect(result.message).toMatch(/Score: \d+%/);
  });

  it('returns failed when no config found', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await fullAuditAgent!.execute(ctx);
    // All domains will score 0 → overall 0 → failed
    expect(result.status).toBe('failed');
  });

  it('generates markdown report in artifacts', async () => {
    const ctx = makeCtx();
    const result = await fullAuditAgent!.execute(ctx);
    expect(result.artifacts.length).toBe(1);
    const report = result.artifacts[0]!;
    expect(report).toContain('# Audit Report');
    expect(report).toContain('Overall Score');
    expect(report).toContain('| Domain | Score | Findings |');
    expect(report).toContain('Labels');
    expect(report).toContain('Workflows');
    expect(report).toContain('Issues');
    expect(report).toContain('PRs');
    expect(report).toContain('Branches');
  });

  it('detects missing labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockResolvedValue([]); // No labels exist

    const result = await fullAuditAgent!.execute(ctx);
    const report = result.artifacts[0]!;
    expect(report).toContain('Missing label');
  });

  it('detects missing workflows', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.getFileContents.mockRejectedValue(new Error('Not found'));

    const result = await fullAuditAgent!.execute(ctx);
    const report = result.artifacts[0]!;
    expect(report).toContain('Missing required workflow');
  });

  it('checks for supabase-migration-automation workflow when supabase configured', async () => {
    const ctx = makeCtx(); // test-repo has supabaseProjectId: 'abc123'
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;

    await fullAuditAgent!.execute(ctx);
    const filePaths = gh.getFileContents.mock.calls.map((c: unknown[]) => c[2]);
    expect(filePaths).toContain('.github/workflows/supabase-migration-automation.yml');
  });

  it('detects unlabeled issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      { number: 1, title: 'Test', body: '', state: 'open', labels: [], assignees: [], html_url: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]);

    const result = await fullAuditAgent!.execute(ctx);
    const report = result.artifacts[0]!;
    expect(report).toContain('unlabeled');
  });

  it('detects draft PRs', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      { number: 1, title: 'WIP', body: '', state: 'open', draft: true, labels: [], head: { ref: 'feat/test', sha: 'a' }, base: { ref: 'main' }, html_url: '', user: { login: 'dev' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]);

    const result = await fullAuditAgent!.execute(ctx);
    const report = result.artifacts[0]!;
    expect(report).toContain('draft');
  });

  it('detects noisy copilot branches', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listBranches.mockResolvedValue([
      { name: 'main' },
      { name: 'copilot/fix-1' },
      { name: 'copilot/fix-2' },
      { name: 'copilot/fix-3' },
      { name: 'copilot/fix-4' },
      { name: 'copilot/fix-5' },
    ]);

    const result = await fullAuditAgent!.execute(ctx);
    const report = result.artifacts[0]!;
    expect(report).toContain('copilot/*');
  });

  it('detects failed workflow runs', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listWorkflowRuns.mockResolvedValue([
      { id: 1, conclusion: 'failure', status: 'completed', name: 'CI' },
    ]);

    const result = await fullAuditAgent!.execute(ctx);
    const report = result.artifacts[0]!;
    expect(report).toContain('failed workflow');
  });

  it('overall score >= 50 yields success, < 50 yields failed', async () => {
    // Healthy repo → score should be high
    const ctx = makeCtx();
    const result = await fullAuditAgent!.execute(ctx);
    expect(result.status).toBe('success');

    // Broken repo → all domains fail
    const ctx2 = makeCtx({ repoAlias: 'nonexistent' });
    const result2 = await fullAuditAgent!.execute(ctx2);
    expect(result2.status).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// scoreboardAgent
// ---------------------------------------------------------------------------

describe('scoreboardAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(scoreboardAgent!.id).toBe('audit-scoreboard');
  });

  it('generates scoreboard for all repos', async () => {
    const ctx = makeCtx();
    const result = await scoreboardAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Scoreboard');

    const scoreboard = JSON.parse(result.artifacts[0]!);
    expect(scoreboard.repos).toHaveProperty('test-repo');
    expect(scoreboard.summary.total).toBeGreaterThanOrEqual(1);
  });

  it('writes SCOREBOARD.json when not dryRun', async () => {
    const { writeFile } = await import('../utils/fs.js');
    const ctx = makeCtx({ dryRun: false });
    await scoreboardAgent!.execute(ctx);
    expect(writeFile).toHaveBeenCalled();
  });

  it('does not write file in dryRun mode', async () => {
    const { writeFile } = await import('../utils/fs.js');
    const ctx = makeCtx({ dryRun: true });
    await scoreboardAgent!.execute(ctx);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('handles audit failures for individual repos gracefully', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listLabels.mockRejectedValue(new Error('API down'));
    gh.listIssues.mockRejectedValue(new Error('API down'));
    gh.listPRs.mockRejectedValue(new Error('API down'));
    gh.listBranches.mockRejectedValue(new Error('API down'));
    gh.getFileContents.mockRejectedValue(new Error('API down'));
    gh.listWorkflowRuns.mockRejectedValue(new Error('API down'));

    const result = await scoreboardAgent!.execute(ctx);
    expect(result.status).toBe('success');
    const scoreboard = JSON.parse(result.artifacts[0]!);
    expect(scoreboard.repos['test-repo']!.score).toBe(0);
  });
});
