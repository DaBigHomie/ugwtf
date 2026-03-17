import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Agent, AgentContext, Cluster, SwarmConfig, GitHubClient, Logger } from '../types.js';

// ---------------------------------------------------------------------------
// We can't easily unit-test executeSwarm without importing the real clusters,
// which pull in 35+ agent files with side-effects. Instead we test the
// internal helpers by importing them indirectly through executeSwarm behavior
// with fully mocked clusters.
// ---------------------------------------------------------------------------

// Mock clusters/index so we don't load real agent files
vi.mock('../clusters/index.js', () => {
  const mockAgent: Agent = {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent',
    clusterId: 'test-cluster',
    shouldRun: () => true,
    execute: vi.fn().mockResolvedValue({
      agentId: 'test-agent',
      status: 'success',
      repo: 'damieus',
      duration: 10,
      message: 'ok',
      artifacts: [],
    }),
  };

  const mockSkipAgent: Agent = {
    id: 'skip-agent',
    name: 'Skip Agent',
    description: 'Agent that skips',
    clusterId: 'skip-cluster',
    shouldRun: () => false,
    execute: vi.fn(),
  };

  const mockFailAgent: Agent = {
    id: 'fail-agent',
    name: 'Fail Agent',
    description: 'Agent that fails',
    clusterId: 'fail-cluster',
    shouldRun: () => true,
    execute: vi.fn().mockRejectedValue(new Error('boom')),
  };

  const clusters: Cluster[] = [
    {
      id: 'test-cluster',
      name: 'Test Cluster',
      description: 'A test cluster',
      dependsOn: [],
      agents: [mockAgent],
    },
    {
      id: 'skip-cluster',
      name: 'Skip Cluster',
      description: 'Cluster with skip agent',
      dependsOn: [],
      agents: [mockSkipAgent],
    },
    {
      id: 'fail-cluster',
      name: 'Fail Cluster',
      description: 'Cluster with fail agent',
      dependsOn: [],
      agents: [mockFailAgent],
    },
  ];

  return {
    CLUSTERS: clusters,
    getClusters: (ids: string[]) => clusters.filter(c => ids.includes(c.id)),
    clusterExecutionOrder: (cls: Cluster[]) => [cls],
  };
});

// Mock repo-registry so we don't depend on real repo paths
vi.mock('../config/repo-registry.js', () => ({
  getRepo: (alias: string) => ({
    slug: `DaBigHomie/${alias}`,
    alias,
    localPath: '/tmp/test-repo',
    framework: 'react-vite',
    owner: 'DaBigHomie',
  }),
  allAliases: () => ['damieus', 'ffs'],
}));

import { executeSwarm } from './executor.js';

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
    group: vi.fn(),
    groupEnd: vi.fn(),
  };
}

function createMockGitHub(): GitHubClient {
  return {
    getRateLimit: vi.fn().mockResolvedValue({ limit: 5000, remaining: 4999, reset: 0 }),
    listLabels: vi.fn().mockResolvedValue([]),
    syncLabel: vi.fn(),
    deleteLabel: vi.fn(),
    listIssues: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn().mockResolvedValue({ number: 1, title: '', body: '', state: 'open', labels: [], assignees: [], html_url: '', created_at: '', updated_at: '' }),
    addComment: vi.fn(),
    addLabels: vi.fn(),
    removeLabel: vi.fn(),
    assignIssue: vi.fn(),
    listPRs: vi.fn().mockResolvedValue([]),
    getPRFiles: vi.fn().mockResolvedValue([]),
    listWorkflowRuns: vi.fn().mockResolvedValue([]),
    getFileContents: vi.fn().mockResolvedValue(''),
    listBranches: vi.fn().mockResolvedValue([]),
  };
}

describe('executeSwarm', () => {
  let logger: Logger;
  let github: GitHubClient;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    github = createMockGitHub();
  });

  it('runs in sequential mode', async () => {
    const config: SwarmConfig = {
      mode: 'sequential',
      concurrency: 1,
      repos: ['damieus'],
      clusters: ['test-cluster'],
      dryRun: true,
    };
    const result = await executeSwarm(config, github, logger);
    expect(result.mode).toBe('sequential');
    expect(result.results.length).toBe(1);
    expect(result.summary.succeeded).toBeGreaterThanOrEqual(1);
  });

  it('runs in parallel mode', async () => {
    const config: SwarmConfig = {
      mode: 'parallel',
      concurrency: 2,
      repos: ['damieus', 'ffs'],
      clusters: ['test-cluster'],
      dryRun: true,
    };
    const result = await executeSwarm(config, github, logger);
    expect(result.mode).toBe('parallel');
    expect(result.results.length).toBe(2);
  });

  it('runs in fan-out mode', async () => {
    const config: SwarmConfig = {
      mode: 'fan-out',
      concurrency: 2,
      repos: ['damieus'],
      clusters: ['test-cluster'],
      dryRun: true,
    };
    const result = await executeSwarm(config, github, logger);
    expect(result.mode).toBe('fan-out');
    expect(result.results.length).toBe(1);
  });

  it('uses all aliases when repos is empty', async () => {
    const config: SwarmConfig = {
      mode: 'sequential',
      concurrency: 1,
      repos: [],
      clusters: ['test-cluster'],
      dryRun: true,
    };
    const result = await executeSwarm(config, github, logger);
    // allAliases returns ['damieus', 'ffs'] → 2 repos
    expect(result.results.length).toBe(2);
  });

  it('records skipped agents', async () => {
    const config: SwarmConfig = {
      mode: 'sequential',
      concurrency: 1,
      repos: ['damieus'],
      clusters: ['skip-cluster'],
      dryRun: true,
    };
    const result = await executeSwarm(config, github, logger);
    expect(result.summary.skipped).toBeGreaterThanOrEqual(1);
  });

  it('records failed agents without crashing', async () => {
    const config: SwarmConfig = {
      mode: 'sequential',
      concurrency: 1,
      repos: ['damieus'],
      clusters: ['fail-cluster'],
      dryRun: true,
    };
    const result = await executeSwarm(config, github, logger);
    expect(result.summary.failed).toBeGreaterThanOrEqual(1);
  });

  it('summary totals are correct', async () => {
    const config: SwarmConfig = {
      mode: 'sequential',
      concurrency: 1,
      repos: ['damieus'],
      clusters: ['test-cluster', 'skip-cluster', 'fail-cluster'],
      dryRun: true,
    };
    const result = await executeSwarm(config, github, logger);
    const { totalAgents, succeeded, failed, skipped } = result.summary;
    expect(totalAgents).toBe(succeeded + failed + skipped);
    expect(totalAgents).toBe(3);
  });

  it('populates duration', async () => {
    const config: SwarmConfig = {
      mode: 'sequential',
      concurrency: 1,
      repos: ['damieus'],
      clusters: ['test-cluster'],
      dryRun: true,
    };
    const result = await executeSwarm(config, github, logger);
    expect(result.summary.duration).toBeGreaterThanOrEqual(0);
    expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt);
  });
});
