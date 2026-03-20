/**
 * PR Agents — Unit Tests
 *
 * Tests prReviewAgent, prBatchProcessor, prCompletionTracker
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prAgents } from './pr-agents.js';
import type { AgentContext, GitHubPR, GitHubFile } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
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
        extraLabels: [],
        localPath: '/tmp/test-repo',
        nodeVersion: '20',
        defaultBranch: 'main',
        hasE2E: false,
        e2eCommand: null,
      };
    }
    return undefined;
  }),
}));

function mockGitHub() {
  return {
    listPRs: vi.fn().mockResolvedValue([]),
    getPRFiles: vi.fn().mockResolvedValue([]),
    addLabels: vi.fn().mockResolvedValue(undefined),
    removeLabel: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    syncLabel: vi.fn(),
    listLabels: vi.fn(),
    deleteLabel: vi.fn(),
    listIssues: vi.fn(),
    createIssue: vi.fn(),
    assignIssue: vi.fn(),
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

function makePR(overrides: Partial<GitHubPR> = {}): GitHubPR {
  return {
    number: 1,
    title: 'Test PR',
    body: '',
    state: 'open',
    draft: false,
    labels: [],
    head: { ref: 'feat/test', sha: 'abc123' },
    base: { ref: 'main' },
    html_url: 'https://github.com/DaBigHomie/test-repo/pull/1',
    user: { login: 'testuser' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// prReviewAgent
// ---------------------------------------------------------------------------

const [prReviewAgent, prBatchProcessor, prCompletionTracker] = prAgents;

describe('prReviewAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id and clusterId', () => {
    expect(prReviewAgent!.id).toBe('pr-review');
    expect(prReviewAgent!.clusterId).toBe('prs');
  });

  it('returns failed when repo config not found', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await prReviewAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.message).toBe('No config');
  });

  it('succeeds with no Copilot PRs', async () => {
    const ctx = makeCtx();
    const result = await prReviewAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toBe('No Copilot PRs');
  });

  it('detects Copilot PRs by label', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 10, labels: [{ name: 'automation:copilot' }] }),
    ]);
    gh.getPRFiles.mockResolvedValue([
      { filename: 'src/index.ts', status: 'modified', additions: 5, deletions: 2 },
    ]);

    const result = await prReviewAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Reviewed: 1');
    expect(result.message).toContain('Firewalled: 0');
    expect(gh.addComment).toHaveBeenCalledOnce();
  });

  it('detects Copilot PRs by user login', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 11, user: { login: 'copilot' } }),
    ]);
    gh.getPRFiles.mockResolvedValue([]);

    const result = await prReviewAgent!.execute(ctx);
    expect(result.message).toContain('Reviewed: 1');
  });

  it('detects Copilot PRs by branch prefix', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 12, head: { ref: 'copilot/fix-123', sha: 'def' } }),
    ]);
    gh.getPRFiles.mockResolvedValue([]);

    const result = await prReviewAgent!.execute(ctx);
    expect(result.message).toContain('Reviewed: 1');
  });

  it('firewalls PRs with DB migrations (supabase/migrations)', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 20, labels: [{ name: 'automation:copilot' }] }),
    ]);
    gh.getPRFiles.mockResolvedValue([
      { filename: 'supabase/migrations/001_init.sql', status: 'added', additions: 50, deletions: 0 },
    ] satisfies GitHubFile[]);

    const result = await prReviewAgent!.execute(ctx);
    expect(result.message).toContain('Firewalled: 1');
    expect(result.artifacts).toContain('PR #20: FIREWALLED');
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 20, ['database', 'needs-review']);
  });

  it('firewalls PRs with .sql migration files', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 21, user: { login: 'copilot' } }),
    ]);
    gh.getPRFiles.mockResolvedValue([
      { filename: 'db/migration_add_users.sql', status: 'added', additions: 30, deletions: 0 },
    ] satisfies GitHubFile[]);

    const result = await prReviewAgent!.execute(ctx);
    expect(result.message).toContain('Firewalled: 1');
  });

  it('skips API calls in dryRun mode', async () => {
    const ctx = makeCtx({ dryRun: true });
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 30, labels: [{ name: 'automation:copilot' }] }),
    ]);
    gh.getPRFiles.mockResolvedValue([
      { filename: 'supabase/migrations/002.sql', status: 'added', additions: 10, deletions: 0 },
    ]);

    const result = await prReviewAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(gh.addLabels).not.toHaveBeenCalled();
    expect(gh.addComment).not.toHaveBeenCalled();
  });

  it('includes Supabase regen command in firewall comment', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 40, labels: [{ name: 'automation:copilot' }] }),
    ]);
    gh.getPRFiles.mockResolvedValue([
      { filename: 'supabase/migrations/003.sql', status: 'added', additions: 5, deletions: 0 },
    ]);

    await prReviewAgent!.execute(ctx);
    const commentBody = gh.addComment.mock.calls[0]![3] as string;
    expect(commentBody).toContain('abc123');
    expect(commentBody).toContain('Manual Merge Required');
  });
});

// ---------------------------------------------------------------------------
// prBatchProcessor
// ---------------------------------------------------------------------------

describe('prBatchProcessor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(prBatchProcessor!.id).toBe('pr-batch-process');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await prBatchProcessor!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('processes empty PR list', async () => {
    const ctx = makeCtx();
    const result = await prBatchProcessor!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Processed: 0');
    expect(result.message).toContain('Abandoned: 0');
  });

  it('labels stale draft PRs', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    // Need >5 PRs for heuristic to trigger + at least one draft
    const prs = Array.from({ length: 7 }, (_, i) =>
      makePR({ number: i + 1, draft: i === 0 }),
    );
    gh.listPRs.mockResolvedValue(prs);

    const result = await prBatchProcessor!.execute(ctx);
    expect(result.artifacts).toContain('STALE: PR #1');
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 1, ['stalled']);
    expect(gh.addComment).toHaveBeenCalled();
  });

  it('adds automation:copilot label to copilot/ branch PRs', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 5, head: { ref: 'copilot/fix-xyz', sha: 'abc' }, labels: [] }),
    ]);

    await prBatchProcessor!.execute(ctx);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 5, ['automation:copilot']);
  });

  it('skips labeling copilot/ PRs that already have the label', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({ number: 6, head: { ref: 'copilot/fix-xyz', sha: 'abc' }, labels: [{ name: 'automation:copilot' }] }),
    ]);

    await prBatchProcessor!.execute(ctx);
    expect(gh.addLabels).not.toHaveBeenCalled();
  });

  it('skips API calls in dryRun mode for stale PRs', async () => {
    const ctx = makeCtx({ dryRun: true });
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    const prs = Array.from({ length: 7 }, (_, i) =>
      makePR({ number: i + 1, draft: i === 0 }),
    );
    gh.listPRs.mockResolvedValue(prs);

    await prBatchProcessor!.execute(ctx);
    expect(gh.addLabels).not.toHaveBeenCalled();
    expect(gh.addComment).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// prCompletionTracker
// ---------------------------------------------------------------------------

describe('prCompletionTracker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(prCompletionTracker!.id).toBe('pr-completion-tracker');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await prCompletionTracker!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('handles no closed PRs', async () => {
    const ctx = makeCtx();
    const result = await prCompletionTracker!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('0 merged PRs');
  });

  it('extracts Fixes #N from PR body and updates labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({
        number: 50,
        state: 'closed',
        body: 'Fixes #10\nCloses #11',
        labels: [{ name: 'automation:copilot' }],
      }),
    ]);

    const result = await prCompletionTracker!.execute(ctx);
    expect(result.message).toContain('2 issues completed');
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 10, ['automation:completed']);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 11, ['automation:completed']);
    expect(gh.removeLabel).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 10, 'automation:in-progress');
    expect(gh.removeLabel).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 11, 'automation:in-progress');
  });

  it('extracts Resolves #N', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({
        number: 51,
        state: 'closed',
        body: 'Resolves #20',
        head: { ref: 'copilot/fix-20', sha: 'xyz' },
      }),
    ]);

    const result = await prCompletionTracker!.execute(ctx);
    expect(result.message).toContain('1 issues completed');
  });

  it('ignores non-Copilot closed PRs', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({
        number: 52,
        state: 'closed',
        body: 'Fixes #30',
        labels: [],
        head: { ref: 'feat/manual', sha: 'abc' },
        user: { login: 'someuser' },
      }),
    ]);

    const result = await prCompletionTracker!.execute(ctx);
    expect(result.message).toContain('0 issues completed');
    expect(gh.addLabels).not.toHaveBeenCalled();
  });

  it('skips API calls in dryRun mode', async () => {
    const ctx = makeCtx({ dryRun: true });
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({
        number: 53,
        state: 'closed',
        body: 'Fixes #40',
        labels: [{ name: 'automation:copilot' }],
      }),
    ]);

    await prCompletionTracker!.execute(ctx);
    expect(gh.addLabels).not.toHaveBeenCalled();
    expect(gh.removeLabel).not.toHaveBeenCalled();
  });

  it('handles errors gracefully when label operations fail', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listPRs.mockResolvedValue([
      makePR({
        number: 54,
        state: 'closed',
        body: 'Fixes #50',
        labels: [{ name: 'automation:copilot' }],
      }),
    ]);
    gh.addLabels.mockRejectedValue(new Error('Issue already closed'));

    const result = await prCompletionTracker!.execute(ctx);
    // Should not throw — error is caught
    expect(result.status).toBe('success');
  });
});
