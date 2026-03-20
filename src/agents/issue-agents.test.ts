/**
 * Issue Agents — Unit Tests
 *
 * Tests stalledIssueDetector, copilotAssignmentAgent, issueTriageAgent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { issueAgents } from './issue-agents.js';
import type { AgentContext, GitHubIssue, GitHubPR } from '../types.js';

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
        extraLabels: [],
        localPath: '/tmp/test-repo',
        nodeVersion: '20',
        defaultBranch: 'main',
      };
    }
    return undefined;
  }),
}));

function mockGitHub() {
  return {
    listIssues: vi.fn().mockResolvedValue([]),
    listPRs: vi.fn().mockResolvedValue([]),
    addLabels: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    assignIssue: vi.fn().mockResolvedValue(undefined),
    assignCopilot: vi.fn().mockResolvedValue(undefined),
    getIssue: vi.fn().mockResolvedValue({ number: 0, title: '', body: '', state: 'open', labels: [], assignees: [{ login: 'copilot' }], html_url: '', created_at: '', updated_at: '' }),
    removeLabel: vi.fn(),
    syncLabel: vi.fn(),
    listLabels: vi.fn(),
    deleteLabel: vi.fn(),
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

function makeIssue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    number: 1,
    title: 'Test issue',
    body: '',
    state: 'open',
    labels: [],
    assignees: [],
    html_url: 'https://github.com/DaBigHomie/test-repo/issues/1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makePR(overrides: Partial<GitHubPR> = {}): GitHubPR {
  return {
    number: 100,
    title: 'Test PR',
    body: '',
    state: 'open',
    draft: false,
    labels: [],
    head: { ref: 'feat/test', sha: 'abc123' },
    base: { ref: 'main' },
    html_url: 'https://github.com/DaBigHomie/test-repo/pull/100',
    user: { login: 'testuser' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// stalledIssueDetector
// ---------------------------------------------------------------------------

const [stalledIssueDetector, copilotAssignmentAgent, issueTriageAgent] = issueAgents;

describe('stalledIssueDetector', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id and clusterId', () => {
    expect(stalledIssueDetector!.id).toBe('issue-stalled-detector');
    expect(stalledIssueDetector!.clusterId).toBe('issues');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await stalledIssueDetector!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('succeeds when no in-progress issues', async () => {
    const ctx = makeCtx();
    const result = await stalledIssueDetector!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Stalled: 0');
  });

  it('marks issues as stalled when no linked PR', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 5, labels: [{ name: 'automation:in-progress' }] }),
    ]);
    gh.listPRs.mockResolvedValue([]);

    const result = await stalledIssueDetector!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.artifacts).toContain('STALLED: #5');
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 5, ['stalled', 'needs-pr']);
    expect(gh.addComment).toHaveBeenCalled();
  });

  it('does not mark stalled when PR references the issue', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 6, labels: [{ name: 'automation:in-progress' }] }),
    ]);
    gh.listPRs.mockResolvedValue([
      makePR({ number: 100, body: 'Fixes #6' }),
    ]);

    const result = await stalledIssueDetector!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Stalled: 0');
    expect(gh.addLabels).not.toHaveBeenCalled();
  });

  it('skips API calls in dryRun mode', async () => {
    const ctx = makeCtx({ dryRun: true });
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 7, labels: [{ name: 'automation:in-progress' }] }),
    ]);
    gh.listPRs.mockResolvedValue([]);

    const result = await stalledIssueDetector!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(gh.addLabels).not.toHaveBeenCalled();
    expect(gh.addComment).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// copilotAssignmentAgent
// ---------------------------------------------------------------------------

describe('copilotAssignmentAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(copilotAssignmentAgent!.id).toBe('issue-copilot-assign');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await copilotAssignmentAgent!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('succeeds with no agent:copilot issues', async () => {
    const ctx = makeCtx();
    const result = await copilotAssignmentAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Assigned: 0');
  });

  it('assigns Copilot to unassigned issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    // First call: in-progress check → no in-progress issues
    gh.listIssues.mockResolvedValueOnce([]);
    // Second call: agent:copilot issues → one unassigned issue
    gh.listIssues.mockResolvedValueOnce([
      makeIssue({ number: 10, labels: [{ name: 'agent:copilot' }] }),
    ]);

    const result = await copilotAssignmentAgent!.execute(ctx);
    expect(result.message).toContain('Assigned: 1');
    expect(gh.assignCopilot).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 10);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 10, ['automation:in-progress']);
  });

  it('skips issues already assigned to Copilot', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    // First call: in-progress check → no in-progress issues
    gh.listIssues.mockResolvedValueOnce([]);
    // Second call: agent:copilot issues → already-assigned issue
    gh.listIssues.mockResolvedValueOnce([
      makeIssue({
        number: 11,
        labels: [{ name: 'agent:copilot' }],
        assignees: [{ login: 'copilot' }],
      }),
    ]);

    const result = await copilotAssignmentAgent!.execute(ctx);
    expect(result.message).toContain('Assigned: 0');
    expect(gh.assignCopilot).not.toHaveBeenCalled();
  });

  it('skips issues already in-progress', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    // First call: in-progress check → no currently-in-progress issues (slot available)
    gh.listIssues.mockResolvedValueOnce([]);
    // Second call: agent:copilot issues → issue that already has in-progress label
    gh.listIssues.mockResolvedValueOnce([
      makeIssue({
        number: 12,
        labels: [{ name: 'agent:copilot' }, { name: 'automation:in-progress' }],
      }),
    ]);

    const result = await copilotAssignmentAgent!.execute(ctx);
    expect(result.message).toContain('Assigned: 0');
    expect(gh.assignCopilot).not.toHaveBeenCalled();
  });

  it('uses dryRun mode correctly', async () => {
    const ctx = makeCtx({ dryRun: true });
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    // First call: in-progress check → no in-progress issues
    gh.listIssues.mockResolvedValueOnce([]);
    // Second call: agent:copilot issues → one unassigned issue
    gh.listIssues.mockResolvedValueOnce([
      makeIssue({ number: 13, labels: [{ name: 'agent:copilot' }] }),
    ]);

    const result = await copilotAssignmentAgent!.execute(ctx);
    expect(result.message).toContain('Assigned: 1');
    expect(gh.assignCopilot).not.toHaveBeenCalled();
    expect(gh.addLabels).not.toHaveBeenCalled();
  });

  it('reports errors when assignment fails', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    // First call: in-progress check → no in-progress issues
    gh.listIssues.mockResolvedValueOnce([]);
    // Second call: agent:copilot issues → one unassigned issue
    gh.listIssues.mockResolvedValueOnce([
      makeIssue({ number: 14, labels: [{ name: 'agent:copilot' }] }),
    ]);
    gh.assignCopilot.mockRejectedValue(new Error('Permission denied'));

    const result = await copilotAssignmentAgent!.execute(ctx);
    expect(result.status).toBe('failed');
    expect(result.artifacts.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// issueTriageAgent
// ---------------------------------------------------------------------------

describe('issueTriageAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has correct id', () => {
    expect(issueTriageAgent!.id).toBe('issue-triage');
  });

  it('returns failed when no config', async () => {
    const ctx = makeCtx({ repoAlias: 'nonexistent' });
    const result = await issueTriageAgent!.execute(ctx);
    expect(result.status).toBe('failed');
  });

  it('succeeds with no issues', async () => {
    const ctx = makeCtx();
    const result = await issueTriageAgent!.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.message).toContain('Triaged: 0');
  });

  it('labels database issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 20, title: 'Supabase migration schema issue' }),
    ]);

    const result = await issueTriageAgent!.execute(ctx);
    expect(result.message).toContain('Triaged: 1');
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 20, ['database']);
  });

  it('labels security issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 21, title: 'CVE-2024-1234 vulnerability found' }),
    ]);

    await issueTriageAgent!.execute(ctx);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 21, ['security']);
  });

  it('labels bug issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 22, title: 'App crash on login page' }),
    ]);

    await issueTriageAgent!.execute(ctx);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 22, ['bug']);
  });

  it('labels enhancement issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 23, title: 'Add new feature for dark mode' }),
    ]);

    await issueTriageAgent!.execute(ctx);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 23, ['enhancement']);
  });

  it('labels documentation issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 24, title: 'README documentation missing' }),
    ]);

    await issueTriageAgent!.execute(ctx);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 24, ['documentation']);
  });

  it('labels dependency issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 25, title: 'Update dependencies to latest' }),
    ]);

    await issueTriageAgent!.execute(ctx);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 25, ['dependencies']);
  });

  it('labels infrastructure issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 26, title: 'CI workflow pipeline setup' }),
    ]);

    await issueTriageAgent!.execute(ctx);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 26, ['infrastructure']);
  });

  it('applies multiple matching labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 27, title: 'Bug: database migration crashes' }),
    ]);

    await issueTriageAgent!.execute(ctx);
    const callArgs = gh.addLabels.mock.calls[0]!;
    const labels = callArgs[3] as string[];
    expect(labels).toContain('database');
    expect(labels).toContain('bug');
  });

  it('skips already-labeled issues', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({
        number: 28,
        title: 'Fix database error',
        labels: [{ name: 'bug' }],
      }),
    ]);

    const result = await issueTriageAgent!.execute(ctx);
    expect(result.message).toContain('Triaged: 0');
    expect(gh.addLabels).not.toHaveBeenCalled();
  });

  it('does not skip issues with only default labels', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({
        number: 29,
        title: 'Fix database error',
        labels: [{ name: 'good first issue' }],
      }),
    ]);

    const result = await issueTriageAgent!.execute(ctx);
    expect(result.message).toContain('Triaged: 1');
  });

  it('matches keywords in body too', async () => {
    const ctx = makeCtx();
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 30, title: 'Some issue', body: 'The SQL schema migration is outdated' }),
    ]);

    await issueTriageAgent!.execute(ctx);
    expect(gh.addLabels).toHaveBeenCalledWith('DaBigHomie', 'test-repo', 30, ['database']);
  });

  it('skips API calls in dryRun mode', async () => {
    const ctx = makeCtx({ dryRun: true });
    const gh = ctx.github as unknown as ReturnType<typeof mockGitHub>;
    gh.listIssues.mockResolvedValue([
      makeIssue({ number: 31, title: 'App crash in production' }),
    ]);

    const result = await issueTriageAgent!.execute(ctx);
    expect(result.message).toContain('Triaged: 1');
    expect(gh.addLabels).not.toHaveBeenCalled();
  });
});
