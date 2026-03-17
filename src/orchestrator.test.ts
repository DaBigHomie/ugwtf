import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing orchestrate
vi.mock('./clients/github.js', () => ({
  createGitHubClient: vi.fn(() => ({
    getRateLimit: vi.fn().mockResolvedValue({ limit: 5000, remaining: 4999, reset: 0 }),
    listLabels: vi.fn().mockResolvedValue([]),
    createLabel: vi.fn().mockResolvedValue(undefined),
    updateLabel: vi.fn().mockResolvedValue(undefined),
    deleteLabel: vi.fn().mockResolvedValue(undefined),
    listIssues: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn().mockResolvedValue({ number: 1 }),
    updateIssue: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    addAssignees: vi.fn().mockResolvedValue(undefined),
    listPullRequests: vi.fn().mockResolvedValue([]),
    getPullRequestFiles: vi.fn().mockResolvedValue([]),
    listWorkflowRuns: vi.fn().mockResolvedValue([]),
    getRepoContent: vi.fn().mockResolvedValue(undefined),
    createOrUpdateFile: vi.fn().mockResolvedValue(undefined),
    searchCode: vi.fn().mockResolvedValue([]),
    graphql: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('./swarm/executor.js', () => ({
  executeSwarm: vi.fn().mockResolvedValue({
    mode: 'sequential',
    startedAt: 0,
    completedAt: 1,
    results: [],
    summary: { totalAgents: 0, succeeded: 0, failed: 0, skipped: 0, duration: 1 },
  }),
}));

import { orchestrate } from './orchestrator.js';
import type { OrchestratorOptions } from './types.js';

describe('orchestrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result for unknown command', async () => {
    const options: OrchestratorOptions = {
      command: 'deploy', // valid command
      repos: [],
      clusters: [],
      dryRun: true,
      verbose: false,
      concurrency: 1,
    };
    const result = await orchestrate(options);
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('handles dry run mode', async () => {
    const options: OrchestratorOptions = {
      command: 'labels',
      repos: ['damieus'],
      clusters: [],
      dryRun: true,
      verbose: false,
      concurrency: 1,
    };
    const result = await orchestrate(options);
    expect(result).toBeDefined();
  });

  it('uses explicit clusters when provided', async () => {
    const { executeSwarm } = await import('./swarm/executor.js');
    const options: OrchestratorOptions = {
      command: 'deploy',
      repos: [],
      clusters: ['labels'],
      dryRun: true,
      verbose: false,
      concurrency: 1,
    };
    await orchestrate(options);
    // executeSwarm should be called with the explicit 'labels' cluster
    expect(executeSwarm).toHaveBeenCalledTimes(1);
    const config = (executeSwarm as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(config.clusters).toEqual(['labels']);
  });

  it('sets parallel mode when concurrency > 1', async () => {
    const { executeSwarm } = await import('./swarm/executor.js');
    const options: OrchestratorOptions = {
      command: 'audit',
      repos: [],
      clusters: [],
      dryRun: true,
      verbose: false,
      concurrency: 5,
    };
    await orchestrate(options);
    const config = (executeSwarm as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(config.mode).toBe('parallel');
    expect(config.concurrency).toBe(5);
  });

  it('sets sequential mode when concurrency is 1', async () => {
    const { executeSwarm } = await import('./swarm/executor.js');
    const options: OrchestratorOptions = {
      command: 'labels',
      repos: [],
      clusters: [],
      dryRun: true,
      verbose: false,
      concurrency: 1,
    };
    await orchestrate(options);
    const config = (executeSwarm as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(config.mode).toBe('sequential');
  });
});
