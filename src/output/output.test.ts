import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SwarmResult } from '../types.js';

// We need to mock process.cwd() so reports go to our test dir, not the real CWD.
// Instead, we test the modules by invoking them and checking the real .ugwtf dir.
// For isolation, we'll use dynamic imports after setting up env.

const TEST_DIR = join(import.meta.dirname, '../../.test-tmp-output');

function makeSwarmResult(overrides: Partial<SwarmResult> = {}): SwarmResult {
  return {
    mode: 'parallel',
    startedAt: Date.now() - 500,
    completedAt: Date.now(),
    results: [
      {
        repo: 'damieus',
        clusterResults: [
          {
            clusterId: 'labels',
            status: 'success',
            duration: 120,
            agentResults: [
              {
                agentId: 'sync-labels',
                status: 'success',
                repo: 'damieus',
                duration: 100,
                message: 'Synced 23 labels',
                artifacts: [],
              },
              {
                agentId: 'audit-labels',
                status: 'failed',
                repo: 'damieus',
                duration: 20,
                message: '2 drifted labels',
                artifacts: ['drifted: bug'],
                error: 'Label drift detected',
              },
            ],
          },
        ],
      },
    ],
    summary: {
      totalAgents: 2,
      succeeded: 1,
      failed: 1,
      skipped: 0,
      duration: 500,
    },
    ...overrides,
  };
}

describe('output/json-reporter', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    // Cleanup any reports written to real .ugwtf in CWD
    const ugwtf = join(process.cwd(), '.ugwtf', 'reports');
    // Only clean up test-generated files (guarded by timestamp pattern)
  });

  it('writes a JSON report and returns the filepath', async () => {
    const { writeJsonReport } = await import('./json-reporter.js');
    const result = makeSwarmResult();
    const filepath = await writeJsonReport(result, 'audit');
    expect(existsSync(filepath)).toBe(true);
    expect(filepath).toContain('audit-');
    expect(filepath).toMatch(/\.json$/);

    const content = JSON.parse(readFileSync(filepath, 'utf-8'));
    expect(content.command).toBe('audit');
    expect(content.summary.totalAgents).toBe(2);
    expect(content.results).toHaveLength(1);
    expect(content.results[0].repo).toBe('damieus');
  });
});

describe('output/markdown-reporter', () => {
  it('writes a Markdown report with summary table', async () => {
    const { writeMarkdownReport } = await import('./markdown-reporter.js');
    const result = makeSwarmResult();
    const filepath = await writeMarkdownReport(result, 'validate');
    expect(existsSync(filepath)).toBe(true);
    expect(filepath).toMatch(/\.md$/);

    const md = readFileSync(filepath, 'utf-8');
    expect(md).toContain('# UGWTF Report: `validate`');
    expect(md).toContain('| Total Agents | 2 |');
    expect(md).toContain('| Succeeded | 1 |');
    expect(md).toContain('## damieus');
    expect(md).toContain('sync-labels');
    expect(md).toContain('Label drift detected');
  });
});

describe('output/persist', () => {
  it('writes and reads last-run data', async () => {
    const { persistLastRun, readLastRun } = await import('./persist.js');
    const result = makeSwarmResult();
    const filepath = await persistLastRun(result, 'deploy');
    expect(existsSync(filepath)).toBe(true);

    const data = readLastRun();
    expect(data).not.toBeNull();
    expect(data!.command).toBe('deploy');
    expect(data!.summary.totalAgents).toBe(2);
    expect(data!.summary.failed).toBe(1);
    expect(data!.repos).toEqual(['damieus']);
    expect(data!.failedAgents).toHaveLength(1);
    expect(data!.failedAgents[0]!.agentId).toBe('audit-labels');
  });
});
