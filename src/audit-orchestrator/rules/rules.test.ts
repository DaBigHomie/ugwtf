/**
 * audit-orchestrator/rules — Unit Tests
 *
 * Covers buildAuditResult, runAllRules, buildClusters, buildIssueCatalog
 * and the individual rule functions via a mock filesystem.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditRuleContext, FrameworkAdapter } from '../types.js';

// ---------------------------------------------------------------------------
// Minimal adapter for testing rules
// ---------------------------------------------------------------------------

function makeAdapter(root: string, framework: 'nextjs' | 'vite-react' = 'nextjs'): FrameworkAdapter {
  return {
    framework,
    resolveStylesheet: () => `${root}/src/app/globals.css`,
    resolveConfig: () => `${root}/tailwind.config.ts`,
    resolveLayout: () => `${root}/src/app/layout.tsx`,
    resolvePages: () => `${root}/src/app`,
    resolveComponents: () => `${root}/src/shared/ui`,
    resolveSrc: () => `${root}/src`,
    detectFramework: () => true,
  };
}

function makeCtx(root = '/tmp/test-project', framework: 'nextjs' | 'vite-react' = 'nextjs'): AuditRuleContext {
  return { root, adapter: makeAdapter(root, framework) };
}

// ---------------------------------------------------------------------------
// rules/index — buildAuditResult, buildClusters, runAllRules, buildIssueCatalog
// ---------------------------------------------------------------------------

describe('rules/index — buildAuditResult', () => {
  // Rules read from filesystem; /tmp/test-project has no source files so
  // countMatches returns 0 and existsSync returns false → every rule returns
  // issues (which is fine — we're testing the aggregation logic).

  it('returns a valid AuditResult shape', async () => {
    const { buildAuditResult } = await import('./index.js');
    const result = buildAuditResult(makeCtx());
    expect(result).toMatchObject({
      totalIssues: expect.any(Number),
      bySeverity: expect.any(Object),
      byCategory: expect.any(Object),
      overallCompletion: expect.any(Number),
      clusters: expect.any(Array),
      issues: expect.any(Array),
      timestamp: expect.any(String),
      cwd: '/tmp/test-project',
      framework: 'nextjs',
    });
  });

  it('bySeverity sums match totalIssues', async () => {
    const { buildAuditResult } = await import('./index.js');
    const result = buildAuditResult(makeCtx());
    const severitySum = Object.values(result.bySeverity).reduce((a, b) => a + b, 0);
    expect(severitySum).toBe(result.totalIssues);
  });

  it('overallCompletion is clamped to [0, 100]', async () => {
    const { buildAuditResult } = await import('./index.js');
    const result = buildAuditResult(makeCtx());
    expect(result.overallCompletion).toBeGreaterThanOrEqual(0);
    expect(result.overallCompletion).toBeLessThanOrEqual(100);
  });

  it('clusters contain all issue IDs', async () => {
    const { buildAuditResult } = await import('./index.js');
    const result = buildAuditResult(makeCtx());
    const clusterPromptIds = result.clusters.flatMap((c) => c.prompts);
    for (const issue of result.issues) {
      expect(clusterPromptIds).toContain(issue.id);
    }
  });

  it('filters by cluster when clusterFilter matches cluster id', async () => {
    const { buildAuditResult } = await import('./index.js');
    const fullResult = buildAuditResult(makeCtx());
    if (fullResult.clusters.length === 0) return;
    const firstCluster = fullResult.clusters[0]!;
    const filtered = buildAuditResult(makeCtx(), firstCluster.id);
    // All issues in filtered result must be in the first cluster's prompts
    for (const issue of filtered.issues) {
      expect(firstCluster.prompts).toContain(issue.id);
    }
  });

  it('filters by cluster when clusterFilter matches cluster name', async () => {
    const { buildAuditResult } = await import('./index.js');
    const fullResult = buildAuditResult(makeCtx());
    if (fullResult.clusters.length === 0) return;
    const firstCluster = fullResult.clusters[0]!;
    const nameFragment = firstCluster.name.slice(0, 5).toLowerCase();
    const filtered = buildAuditResult(makeCtx(), nameFragment);
    for (const issue of filtered.issues) {
      expect(firstCluster.prompts).toContain(issue.id);
    }
  });

  it('returns all issues when clusterFilter does not match any cluster', async () => {
    const { buildAuditResult } = await import('./index.js');
    const fullResult = buildAuditResult(makeCtx());
    const filtered = buildAuditResult(makeCtx(), 'nonexistent-cluster-xyz');
    expect(filtered.totalIssues).toBe(fullResult.totalIssues);
  });

  it('timestamp is a valid ISO string', async () => {
    const { buildAuditResult } = await import('./index.js');
    const result = buildAuditResult(makeCtx());
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

describe('rules/index — buildClusters', () => {
  it('returns empty array for empty issues', async () => {
    const { buildClusters } = await import('./index.js');
    expect(buildClusters([])).toEqual([]);
  });

  it('groups issues by category into clusters', async () => {
    const { buildClusters } = await import('./index.js');
    const issues = [
      { id: 'A-01', title: 'A', severity: 'high' as const, category: 'accessibility' as const, description: '', affectedFiles: [], completionPct: 0 },
      { id: 'A-02', title: 'B', severity: 'medium' as const, category: 'accessibility' as const, description: '', affectedFiles: [], completionPct: 0 },
      { id: 'DM-01', title: 'C', severity: 'low' as const, category: 'dark-mode' as const, description: '', affectedFiles: [], completionPct: 0 },
    ];
    const clusters = buildClusters(issues);
    expect(clusters.length).toBe(2);
    const accessibilityCluster = clusters.find((c) => c.prompts.includes('A-01'));
    expect(accessibilityCluster?.prompts).toContain('A-02');
    expect(accessibilityCluster?.agentCount).toBe(2);
  });

  it('sets estimatedMinutes to issues × 10', async () => {
    const { buildClusters } = await import('./index.js');
    const issues = [
      { id: 'X-01', title: 'X', severity: 'low' as const, category: 'design' as const, description: '', affectedFiles: [], completionPct: 0 },
      { id: 'X-02', title: 'Y', severity: 'low' as const, category: 'design' as const, description: '', affectedFiles: [], completionPct: 0 },
      { id: 'X-03', title: 'Z', severity: 'low' as const, category: 'design' as const, description: '', affectedFiles: [], completionPct: 0 },
    ];
    const [cluster] = buildClusters(issues);
    expect(cluster!.estimatedMinutes).toBe(30);
  });

  it('caps agentCount at 5', async () => {
    const { buildClusters } = await import('./index.js');
    const issues = Array.from({ length: 10 }, (_, i) => ({
      id: `X-0${i}`,
      title: `Issue ${i}`,
      severity: 'low' as const,
      category: 'design' as const,
      description: '',
      affectedFiles: [],
      completionPct: 0,
    }));
    const [cluster] = buildClusters(issues);
    expect(cluster!.agentCount).toBe(5);
  });

  it('assigns sequential cluster IDs C1, C2, ...', async () => {
    const { buildClusters } = await import('./index.js');
    const issues = [
      { id: 'A-01', title: 'A', severity: 'high' as const, category: 'accessibility' as const, description: '', affectedFiles: [], completionPct: 0 },
      { id: 'DM-01', title: 'B', severity: 'medium' as const, category: 'dark-mode' as const, description: '', affectedFiles: [], completionPct: 0 },
      { id: 'L-01', title: 'C', severity: 'low' as const, category: 'layout' as const, description: '', affectedFiles: [], completionPct: 0 },
    ];
    const clusters = buildClusters(issues);
    expect(clusters.map((c) => c.id)).toEqual(['C1', 'C2', 'C3']);
  });

  it('uses CATEGORY_NAMES for known categories', async () => {
    const { buildClusters } = await import('./index.js');
    const issues = [
      { id: 'A-01', title: 'A', severity: 'high' as const, category: 'accessibility' as const, description: '', affectedFiles: [], completionPct: 0 },
    ];
    const [cluster] = buildClusters(issues);
    expect(cluster!.name).toBe('Accessibility');
  });

  it('falls back to category string for unknown categories', async () => {
    const { buildClusters } = await import('./index.js');
    // 'layout' and 'content' are in CATEGORY_NAMES; 'design' is also there.
    // Use a category that maps through the fallback. 'layout' → 'layout' is not a key tested here.
    // We'll use a category that's not in CATEGORY_NAMES at all via type assertion.
    const issues = [
      { id: 'X-01', title: 'X', severity: 'low' as const, category: 'unknown-cat' as 'accessibility', description: '', affectedFiles: [], completionPct: 0 },
    ];
    const [cluster] = buildClusters(issues);
    expect(cluster!.name).toBe('unknown-cat');
  });

  it('sets canParallelize=true and dependsOn=[] for all clusters', async () => {
    const { buildClusters } = await import('./index.js');
    const issues = [
      { id: 'A-01', title: 'A', severity: 'high' as const, category: 'accessibility' as const, description: '', affectedFiles: [], completionPct: 0 },
    ];
    const [cluster] = buildClusters(issues);
    expect(cluster!.canParallelize).toBe(true);
    expect(cluster!.dependsOn).toEqual([]);
  });
});

describe('rules/index — runAllRules', () => {
  it('returns an entry for each registered rule', async () => {
    const { runAllRules, RULES } = await import('./index.js');
    const results = runAllRules(makeCtx());
    const ruleNames = Object.keys(RULES);
    for (const name of ruleNames) {
      expect(results).toHaveProperty(name);
      expect(Array.isArray(results[name as keyof typeof results])).toBe(true);
    }
  });
});

describe('rules/index — buildIssueCatalog', () => {
  it('returns a flat array of all rule issues', async () => {
    const { buildIssueCatalog } = await import('./index.js');
    const catalog = buildIssueCatalog(makeCtx());
    expect(Array.isArray(catalog)).toBe(true);
    // Every issue has the required fields
    for (const issue of catalog) {
      expect(issue).toHaveProperty('id');
      expect(issue).toHaveProperty('title');
      expect(issue).toHaveProperty('severity');
    }
  });
});

// ---------------------------------------------------------------------------
// Individual rules — smoke tests (real filesystem misses = issues returned)
// ---------------------------------------------------------------------------

describe('auditTestIds', () => {
  it('returns an issue when no data-testid attrs found', async () => {
    const { auditTestIds } = await import('./test-ids.js');
    const issues = auditTestIds(makeCtx());
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.id).toBe('TID-01');
  });

  it('severity is high when count < 10', async () => {
    const { auditTestIds } = await import('./test-ids.js');
    const issues = auditTestIds(makeCtx());
    // /tmp/test-project/src doesn't exist → 0 matches → high severity
    expect(issues[0]!.severity).toBe('high');
  });
});

describe('auditMarquee', () => {
  it('returns no issues when no marquee references found', async () => {
    const { auditMarquee } = await import('./marquee.js');
    const issues = auditMarquee(makeCtx());
    // No marquee in /tmp/test-project → 0 → no issues
    expect(issues).toEqual([]);
  });
});

describe('auditAccessibility', () => {
  it('returns issues when src has no aria attrs', async () => {
    const { auditAccessibility } = await import('./accessibility.js');
    const issues = auditAccessibility(makeCtx());
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('A11Y-01'); // low ARIA count
  });

  it('returns focus-trap issue when no focus trap found', async () => {
    const { auditAccessibility } = await import('./accessibility.js');
    const issues = auditAccessibility(makeCtx());
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('A11Y-03');
  });
});
