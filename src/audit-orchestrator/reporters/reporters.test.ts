/**
 * audit-orchestrator/reporters — Unit Tests
 *
 * Covers reportJson, reportMarkdown, reportTerminal, and re-exports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditResult, PromptCluster } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCluster(overrides: Partial<PromptCluster> = {}): PromptCluster {
  return {
    id: 'C1',
    name: 'Test Cluster',
    prompts: ['ISSUE-01', 'ISSUE-02'],
    canParallelize: true,
    dependsOn: [],
    estimatedMinutes: 20,
    agentCount: 2,
    ...overrides,
  };
}

function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    totalIssues: 2,
    bySeverity: { critical: 1, high: 1, medium: 0, low: 0 },
    byCategory: { accessibility: 1, 'dark-mode': 1 },
    overallCompletion: 80,
    clusters: [makeCluster()],
    issues: [
      {
        id: 'A11Y-01',
        title: 'Low ARIA coverage',
        severity: 'critical',
        category: 'accessibility',
        description: 'Not enough aria- attributes',
        affectedFiles: ['/src'],
        completionPct: 50,
        promptId: 'prompt-1',
      },
      {
        id: 'DM-01',
        title: 'Dark mode missing',
        severity: 'high',
        category: 'dark-mode',
        description: 'No dark mode',
        affectedFiles: ['/src/app.css'],
        completionPct: 30,
      },
    ],
    timestamp: '2026-01-01T00:00:00.000Z',
    cwd: '/tmp/test-project',
    framework: 'nextjs',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// reportJson
// ---------------------------------------------------------------------------

describe('reportJson', () => {
  let writeFileSyncSpy: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    writeFileSyncSpy = vi.fn();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn()) as ReturnType<typeof vi.fn>;

    vi.doMock('node:fs', () => ({
      writeFileSync: writeFileSyncSpy,
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn(),
      readdirSync: vi.fn(),
      statSync: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('logs JSON to console when no outputPath', async () => {
    const { reportJson } = await import('./json.js');
    const result = makeResult();
    reportJson({ result });
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2));
  });

  it('logs verbose message when outputPath and verbose', async () => {
    const { reportJson } = await import('./json.js');
    const result = makeResult();
    // With writeFileSync mocked via module mock, just test that console is called
    // when verbose + outputPath
    // We'll verify by mocking fs directly
    const fsMod = await import('node:fs');
    vi.spyOn(fsMod, 'writeFileSync').mockImplementation(vi.fn());
    reportJson({ result, outputPath: '/tmp/out.json', verbose: true });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('/tmp/out.json'));
  });

  it('writes file when outputPath given', async () => {
    const { reportJson } = await import('./json.js');
    const result = makeResult();
    const fsMod = await import('node:fs');
    const spy = vi.spyOn(fsMod, 'writeFileSync').mockImplementation(vi.fn());
    reportJson({ result, outputPath: '/tmp/out.json' });
    expect(spy).toHaveBeenCalledWith('/tmp/out.json', JSON.stringify(result, null, 2));
  });

  it('does not log verbose message when outputPath but verbose=false', async () => {
    const { reportJson } = await import('./json.js');
    const result = makeResult();
    const fsMod = await import('node:fs');
    vi.spyOn(fsMod, 'writeFileSync').mockImplementation(vi.fn());
    consoleLogSpy.mockClear();
    reportJson({ result, outputPath: '/tmp/out.json', verbose: false });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// reportMarkdown
// ---------------------------------------------------------------------------

describe('reportMarkdown', () => {
  let consoleLogSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn()) as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs markdown to console when no outputPath', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult();
    reportMarkdown({ result });
    const calls = consoleLogSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('# Audit Results');
    expect(calls).toContain('Generated');
    expect(calls).toContain('Total Issues');
    expect(calls).toContain('Overall Completion');
  });

  it('includes severity counts in markdown output', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult();
    reportMarkdown({ result });
    const calls = consoleLogSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Critical');
    expect(calls).toContain('High');
  });

  it('includes issues table in markdown output', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult();
    reportMarkdown({ result });
    const calls = consoleLogSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('| ID | Severity | Title');
    expect(calls).toContain('A11Y-01');
    expect(calls).toContain('DM-01');
  });

  it('sorts issues by severity in output', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult();
    reportMarkdown({ result });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    const critIdx = output.indexOf('A11Y-01');
    const highIdx = output.indexOf('DM-01');
    expect(critIdx).toBeLessThan(highIdx);
  });

  it('includes cluster execution plan', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult();
    reportMarkdown({ result });
    const calls = consoleLogSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Cluster Execution Plan');
    expect(calls).toContain('Test Cluster');
    expect(calls).toContain('parallel');
  });

  it('includes deps info for clusters with dependencies', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult({
      clusters: [makeCluster({ dependsOn: ['other-cluster'] })],
    });
    reportMarkdown({ result });
    const calls = consoleLogSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('depends: other-cluster');
  });

  it('writes file when outputPath given', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult();
    const fsMod = await import('node:fs');
    const spy = vi.spyOn(fsMod, 'writeFileSync').mockImplementation(vi.fn());
    reportMarkdown({ result, outputPath: '/tmp/report.md' });
    expect(spy).toHaveBeenCalledWith('/tmp/report.md', expect.stringContaining('# Audit Results'));
  });

  it('logs verbose message when outputPath and verbose', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult();
    const fsMod = await import('node:fs');
    vi.spyOn(fsMod, 'writeFileSync').mockImplementation(vi.fn());
    reportMarkdown({ result, outputPath: '/tmp/report.md', verbose: true });
    const calls = consoleLogSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('/tmp/report.md');
  });

  it('includes byCategory in output', async () => {
    const { reportMarkdown } = await import('./markdown.js');
    const result = makeResult();
    reportMarkdown({ result });
    const calls = consoleLogSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Issues by Category');
    expect(calls).toContain('accessibility');
  });
});

// ---------------------------------------------------------------------------
// reportTerminal
// ---------------------------------------------------------------------------

describe('reportTerminal', () => {
  let consoleLogSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn()) as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs header with framework and date', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult();
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('SITE AUDIT');
    expect(output).toContain('nextjs');
    expect(output).toContain('2026-01-01');
  });

  it('outputs overall completion percentage', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult();
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('80%');
    expect(output).toContain('Total Issues: 2');
  });

  it('outputs severity breakdown', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult();
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Critical: 1');
    expect(output).toContain('High: 1');
  });

  it('outputs category breakdown with bar chart', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult();
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Issues by Category');
    expect(output).toContain('accessibility');
    expect(output).toContain('dark-mode');
  });

  it('outputs issue list with severity icons', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult();
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('A11Y-01');
    expect(output).toContain('DM-01');
    expect(output).toContain('🔴');
    expect(output).toContain('🟠');
  });

  it('outputs verbose issue details when verbose=true', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult();
    reportTerminal({ result, verbose: true });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Not enough aria- attributes');
    expect(output).toContain('/src');
  });

  it('outputs cluster execution plan', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult();
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Cluster Execution Plan');
    expect(output).toContain('Test Cluster');
    expect(output).toContain('parallel');
  });

  it('outputs parallel execution map when clusters exist', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult();
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('PARALLEL EXECUTION MAP');
    expect(output).toContain('Total:');
  });

  it('handles sequential cluster correctly', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult({
      clusters: [makeCluster({ canParallelize: false })],
    });
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('sequential');
  });

  it('handles empty clusters (no parallel map)', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult({ clusters: [] });
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('SITE AUDIT');
    // No parallel map printed when clusters empty
    expect(output).not.toContain('PARALLEL EXECUTION MAP');
  });

  it('uses medium/low severity icons correctly', async () => {
    const { reportTerminal } = await import('./terminal.js');
    const result = makeResult({
      issues: [
        {
          id: 'X-01',
          title: 'Medium issue',
          severity: 'medium',
          category: 'design',
          description: 'desc',
          affectedFiles: [],
          completionPct: 50,
        },
        {
          id: 'X-02',
          title: 'Low issue',
          severity: 'low',
          category: 'design',
          description: 'desc',
          affectedFiles: [],
          completionPct: 80,
        },
      ],
    });
    reportTerminal({ result, verbose: false });
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('🟡');
    expect(output).toContain('🟢');
  });
});

// ---------------------------------------------------------------------------
// reporters/index re-exports
// ---------------------------------------------------------------------------

describe('reporters/index', () => {
  it('re-exports all three reporters', async () => {
    const reporters = await import('./index.js');
    expect(typeof reporters.reportJson).toBe('function');
    expect(typeof reporters.reportMarkdown).toBe('function');
    expect(typeof reporters.reportTerminal).toBe('function');
  });
});
