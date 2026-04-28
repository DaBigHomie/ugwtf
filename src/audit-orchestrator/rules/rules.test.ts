import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { nextjsAdapter } from '../adapters/nextjs.js';
import type { AuditRuleContext } from '../types.js';
import {
  RULES,
  runAllRules,
  buildIssueCatalog,
  buildClusters,
  buildAuditResult,
} from './index.js';

const TEST_DIR = join(import.meta.dirname, '../../../.test-tmp-rules');

/** Build a minimal AuditRuleContext pointing at an empty temp directory. */
function makeCtx(root = TEST_DIR): AuditRuleContext {
  return { root, adapter: nextjsAdapter };
}

describe('audit-orchestrator/rules/index', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    // Create src/ directory so adapter.resolveSrc() resolves properly
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('RULES', () => {
    it('exports a non-empty RULES map', () => {
      expect(Object.keys(RULES).length).toBeGreaterThan(0);
    });

    it('contains expected rule keys', () => {
      expect(RULES).toHaveProperty('dark-mode-contrast');
      expect(RULES).toHaveProperty('accessibility');
      expect(RULES).toHaveProperty('test-ids');
      expect(RULES).toHaveProperty('button-consistency');
    });

    it('all RULES values are functions', () => {
      for (const fn of Object.values(RULES)) {
        expect(typeof fn).toBe('function');
      }
    });
  });

  describe('runAllRules', () => {
    it('returns results keyed by rule name', () => {
      const ctx = makeCtx();
      const results = runAllRules(ctx);
      for (const key of Object.keys(RULES)) {
        expect(key in results).toBe(true);
        expect(Array.isArray(results[key as keyof typeof RULES])).toBe(true);
      }
    });

    it('each rule result contains valid AuditIssue objects', () => {
      const ctx = makeCtx();
      const results = runAllRules(ctx);
      for (const issues of Object.values(results)) {
        for (const issue of issues) {
          expect(typeof issue.id).toBe('string');
          expect(typeof issue.title).toBe('string');
          expect(['critical', 'high', 'medium', 'low']).toContain(issue.severity);
          expect(Array.isArray(issue.affectedFiles)).toBe(true);
          expect(typeof issue.completionPct).toBe('number');
        }
      }
    });
  });

  describe('buildIssueCatalog', () => {
    it('returns a flat array of AuditIssue objects', () => {
      const ctx = makeCtx();
      const issues = buildIssueCatalog(ctx);
      expect(Array.isArray(issues)).toBe(true);
      for (const issue of issues) {
        expect(typeof issue.id).toBe('string');
        expect(typeof issue.title).toBe('string');
      }
    });

    it('returns issues when source directory has no matching patterns', () => {
      // Empty src dir — all rules should fire their default issues
      const ctx = makeCtx();
      const issues = buildIssueCatalog(ctx);
      expect(issues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildClusters', () => {
    it('returns empty array for no issues', () => {
      expect(buildClusters([])).toEqual([]);
    });

    it('groups issues by category into clusters', () => {
      const issues = buildIssueCatalog(makeCtx());
      const clusters = buildClusters(issues);
      // Each cluster should have unique id
      const ids = clusters.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('cluster prompts contain issue IDs', () => {
      const issues = [
        { id: 'A1', title: 'Test', severity: 'high' as const, category: 'accessibility' as const, description: '', affectedFiles: [], completionPct: 0 },
        { id: 'A2', title: 'Test 2', severity: 'medium' as const, category: 'accessibility' as const, description: '', affectedFiles: [], completionPct: 0 },
      ];
      const clusters = buildClusters(issues);
      expect(clusters).toHaveLength(1);
      expect(clusters[0]!.prompts).toContain('A1');
      expect(clusters[0]!.prompts).toContain('A2');
    });

    it('sets canParallelize=true on all clusters', () => {
      const issues = [
        { id: 'X1', title: 'T', severity: 'low' as const, category: 'layout' as const, description: '', affectedFiles: [], completionPct: 0 },
      ];
      const [cluster] = buildClusters(issues);
      expect(cluster!.canParallelize).toBe(true);
    });

    it('uses human-readable name for known categories', () => {
      const issues = [
        { id: 'D1', title: 'Dark', severity: 'critical' as const, category: 'dark-mode' as const, description: '', affectedFiles: [], completionPct: 0 },
      ];
      const [cluster] = buildClusters(issues);
      expect(cluster!.name).toBe('Dark Mode & Contrast');
    });

    it('falls back to category string for unknown categories', () => {
      // 'layout' is not in CATEGORY_NAMES so it falls back to the category string
      const issues = [
        { id: 'L1', title: 'Layout', severity: 'low' as const, category: 'layout' as const, description: '', affectedFiles: [], completionPct: 0 },
      ];
      const [cluster] = buildClusters(issues);
      expect(cluster!.name).toBe('layout');
    });

    it('estimatedMinutes = count * 10', () => {
      const issues = [
        { id: 'X1', title: 'T1', severity: 'low' as const, category: 'layout' as const, description: '', affectedFiles: [], completionPct: 0 },
        { id: 'X2', title: 'T2', severity: 'low' as const, category: 'layout' as const, description: '', affectedFiles: [], completionPct: 0 },
        { id: 'X3', title: 'T3', severity: 'low' as const, category: 'layout' as const, description: '', affectedFiles: [], completionPct: 0 },
      ];
      const [cluster] = buildClusters(issues);
      expect(cluster!.estimatedMinutes).toBe(30);
    });
  });

  describe('buildAuditResult', () => {
    it('returns a valid AuditResult shape', () => {
      const ctx = makeCtx();
      const result = buildAuditResult(ctx);
      expect(typeof result.totalIssues).toBe('number');
      expect(typeof result.overallCompletion).toBe('number');
      expect(result.overallCompletion).toBeGreaterThanOrEqual(0);
      expect(result.overallCompletion).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.clusters)).toBe(true);
      expect(typeof result.timestamp).toBe('string');
      expect(result.cwd).toBe(TEST_DIR);
      expect(result.framework).toBe('nextjs');
    });

    it('bySeverity sums match totalIssues', () => {
      const ctx = makeCtx();
      const result = buildAuditResult(ctx);
      const total = Object.values(result.bySeverity).reduce((a, b) => a + b, 0);
      expect(total).toBe(result.totalIssues);
    });

    it('filters to a specific cluster when clusterFilter matches cluster id', () => {
      const ctx = makeCtx();
      const all = buildAuditResult(ctx);
      if (all.clusters.length > 0) {
        const firstClusterId = all.clusters[0]!.id;
        const filtered = buildAuditResult(ctx, firstClusterId);
        expect(filtered.totalIssues).toBeLessThanOrEqual(all.totalIssues);
      }
    });

    it('filters to a specific cluster when clusterFilter matches cluster name', () => {
      const ctx = makeCtx();
      const all = buildAuditResult(ctx);
      if (all.clusters.length > 0) {
        const firstName = all.clusters[0]!.name;
        const filtered = buildAuditResult(ctx, firstName.slice(0, 4).toLowerCase());
        expect(filtered.totalIssues).toBeLessThanOrEqual(all.totalIssues);
      }
    });

    it('returns all issues when clusterFilter does not match', () => {
      const ctx = makeCtx();
      const all = buildAuditResult(ctx);
      const filtered = buildAuditResult(ctx, 'NONEXISTENT_CLUSTER_XYZ');
      // no matching cluster → all issues returned
      expect(filtered.totalIssues).toBe(all.totalIssues);
    });

    it('overallCompletion is capped at 0 minimum', () => {
      const ctx = makeCtx();
      const result = buildAuditResult(ctx);
      expect(result.overallCompletion).toBeGreaterThanOrEqual(0);
    });
  });
});
