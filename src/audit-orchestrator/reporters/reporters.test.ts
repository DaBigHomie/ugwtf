import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditResult } from '../types.js';

const TEST_DIR = join(import.meta.dirname, '../../../.test-tmp-reporters');

/** Minimal valid AuditResult for testing reporters. */
function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    totalIssues: 2,
    bySeverity: { critical: 0, high: 1, medium: 1, low: 0 },
    byCategory: { accessibility: 1, 'dark-mode': 1 },
    overallCompletion: 85,
    clusters: [
      {
        id: 'C1',
        name: 'Accessibility',
        prompts: ['A11Y-01', 'A11Y-02'],
        canParallelize: true,
        dependsOn: [],
        estimatedMinutes: 20,
        agentCount: 2,
      },
      {
        id: 'C2',
        name: 'Dark Mode',
        prompts: ['DM-01'],
        canParallelize: false,
        dependsOn: ['C1'],
        estimatedMinutes: 10,
        agentCount: 1,
      },
    ],
    issues: [
      {
        id: 'A11Y-01',
        title: 'Low ARIA coverage',
        severity: 'high',
        category: 'accessibility',
        description: 'Not enough aria- attributes',
        affectedFiles: ['/src'],
        completionPct: 50,
        promptId: 'prompt-001',
      },
      {
        id: 'DM-01',
        title: 'Dark mode missing',
        severity: 'medium',
        category: 'dark-mode',
        description: 'Dark mode not implemented',
        affectedFiles: ['/src/styles'],
        completionPct: 0,
      },
    ],
    timestamp: '2026-01-01T00:00:00.000Z',
    cwd: '/repo',
    framework: 'nextjs',
    ...overrides,
  };
}

describe('audit-orchestrator/reporters', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('reportJson', () => {
    it('writes JSON to outputPath when provided', async () => {
      const { reportJson } = await import('./json.js');
      const outputPath = join(TEST_DIR, 'result.json');
      const result = makeResult();
      reportJson({ result, outputPath });
      const written = JSON.parse(readFileSync(outputPath, 'utf-8'));
      expect(written.totalIssues).toBe(2);
      expect(written.framework).toBe('nextjs');
    });

    it('logs JSON to console when no outputPath', async () => {
      const { reportJson } = await import('./json.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = makeResult();
      reportJson({ result });
      expect(spy).toHaveBeenCalledOnce();
      const logged = JSON.parse(spy.mock.calls[0]![0] as string);
      expect(logged.totalIssues).toBe(2);
    });

    it('logs verbose message when verbose=true and outputPath given', async () => {
      const { reportJson } = await import('./json.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const outputPath = join(TEST_DIR, 'verbose.json');
      reportJson({ result: makeResult(), outputPath, verbose: true });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('JSON written to'));
    });
  });

  describe('reportMarkdown', () => {
    it('writes markdown to outputPath when provided', async () => {
      const { reportMarkdown } = await import('./markdown.js');
      const outputPath = join(TEST_DIR, 'result.md');
      reportMarkdown({ result: makeResult(), outputPath });
      const md = readFileSync(outputPath, 'utf-8');
      expect(md).toContain('# Audit Results');
      expect(md).toContain('nextjs');
      expect(md).toContain('A11Y-01');
    });

    it('logs markdown to console when no outputPath', async () => {
      const { reportMarkdown } = await import('./markdown.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      reportMarkdown({ result: makeResult() });
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0]![0]).toContain('# Audit Results');
    });

    it('includes severity icons for issues', async () => {
      const { reportMarkdown } = await import('./markdown.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = makeResult({
        issues: [
          { id: 'C1', title: 'Critical', severity: 'critical', category: 'accessibility', description: '', affectedFiles: [], completionPct: 0 },
          { id: 'L1', title: 'Low', severity: 'low', category: 'dark-mode', description: '', affectedFiles: [], completionPct: 0 },
          { id: 'M1', title: 'Medium', severity: 'medium', category: 'accessibility', description: '', affectedFiles: [], completionPct: 0 },
        ],
      });
      reportMarkdown({ result });
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('🔴');
      expect(output).toContain('🟢');
      expect(output).toContain('🟡');
    });

    it('includes cluster execution plan', async () => {
      const { reportMarkdown } = await import('./markdown.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      reportMarkdown({ result: makeResult() });
      const output = spy.mock.calls[0]![0] as string;
      expect(output).toContain('## Cluster Execution Plan');
      expect(output).toContain('Accessibility');
      expect(output).toContain('no deps');
      expect(output).toContain('depends: C1');
    });

    it('logs verbose message when verbose=true and outputPath given', async () => {
      const { reportMarkdown } = await import('./markdown.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const outputPath = join(TEST_DIR, 'verbose.md');
      reportMarkdown({ result: makeResult(), outputPath, verbose: true });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Markdown written to'));
    });
  });

  describe('reportTerminal', () => {
    it('logs structured output to console', async () => {
      const { reportTerminal } = await import('./terminal.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      reportTerminal({ result: makeResult() });
      const allOutput = spy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('SITE AUDIT');
      expect(allOutput).toContain('Overall Completion: 85%');
      expect(allOutput).toContain('A11Y-01');
    });

    it('outputs verbose description and files when verbose=true', async () => {
      const { reportTerminal } = await import('./terminal.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      reportTerminal({ result: makeResult(), verbose: true });
      const allOutput = spy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Not enough aria- attributes');
      expect(allOutput).toContain('/src');
    });

    it('renders parallel execution map with clusters', async () => {
      const { reportTerminal } = await import('./terminal.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      reportTerminal({ result: makeResult() });
      const allOutput = spy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('PARALLEL EXECUTION MAP');
    });

    it('renders severity icons for each severity level', async () => {
      const { reportTerminal } = await import('./terminal.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = makeResult({
        issues: [
          { id: 'C1', title: 'Crit', severity: 'critical', category: 'accessibility', description: '', affectedFiles: [], completionPct: 0 },
          { id: 'H1', title: 'High', severity: 'high', category: 'dark-mode', description: '', affectedFiles: [], completionPct: 0 },
          { id: 'M1', title: 'Med', severity: 'medium', category: 'accessibility', description: '', affectedFiles: [], completionPct: 0 },
          { id: 'L1', title: 'Low', severity: 'low', category: 'dark-mode', description: '', affectedFiles: [], completionPct: 0 },
        ],
        clusters: [],
      });
      reportTerminal({ result });
      const allOutput = spy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('🔴');
      expect(allOutput).toContain('🟠');
      expect(allOutput).toContain('🟡');
      expect(allOutput).toContain('🟢');
    });

    it('handles empty clusters list gracefully', async () => {
      const { reportTerminal } = await import('./terminal.js');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      reportTerminal({ result: makeResult({ clusters: [], issues: [] }) });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('reporters/index re-exports', () => {
    it('re-exports reportJson, reportMarkdown, reportTerminal', async () => {
      const reporters = await import('./index.js');
      expect(typeof reporters.reportJson).toBe('function');
      expect(typeof reporters.reportMarkdown).toBe('function');
      expect(typeof reporters.reportTerminal).toBe('function');
    });
  });
});
