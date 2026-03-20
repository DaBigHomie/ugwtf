/**
 * Rules index — registry, runner, issue aggregation, and cluster builder.
 *
 * Each rule dynamically returns AuditIssue[] based on what it actually finds
 * in the target repo. No hardcoded issue catalog.
 */

import type { AuditIssue, AuditCategory, AuditRuleContext, AuditResult, PromptCluster } from '../types.js';
import { auditDarkModeContrast } from './dark-mode-contrast.js';
import { auditTestIds } from './test-ids.js';
import { auditAccessibility } from './accessibility.js';
import { auditDesignSystem } from './design-system.js';
import { auditMobileResponsiveness } from './mobile-responsive.js';
import { auditSupabaseIntegration } from './supabase-integration.js';
import { auditCheckoutFlow } from './checkout-flow.js';
import { auditCollections } from './collections.js';
import { auditMarquee } from './marquee.js';
import { auditButtonConsistency } from './button-consistency.js';

export const RULES = {
  'dark-mode-contrast': auditDarkModeContrast,
  'test-ids': auditTestIds,
  'accessibility': auditAccessibility,
  'design-system': auditDesignSystem,
  'mobile-responsive': auditMobileResponsiveness,
  'supabase-integration': auditSupabaseIntegration,
  'checkout-flow': auditCheckoutFlow,
  'collections': auditCollections,
  'marquee': auditMarquee,
  'button-consistency': auditButtonConsistency,
} as const;

export type RuleName = keyof typeof RULES;

/** Run every rule and collect their findings. */
export function runAllRules(ctx: AuditRuleContext): Record<RuleName, AuditIssue[]> {
  const results = {} as Record<RuleName, AuditIssue[]>;
  for (const [name, fn] of Object.entries(RULES)) {
    results[name as RuleName] = fn(ctx);
  }
  return results;
}

/** Flatten all rule findings into a single issue list. */
export function buildIssueCatalog(ctx: AuditRuleContext): AuditIssue[] {
  return Object.values(runAllRules(ctx)).flat();
}

/** Human-readable names for issue categories. */
const CATEGORY_NAMES: Record<string, string> = {
  'dark-mode': 'Dark Mode & Contrast',
  accessibility: 'Accessibility',
  design: 'Design System',
  mobile: 'Mobile & Responsive',
  checkout: 'Checkout Flow',
  collections: 'Collections & Shop',
  marquee: 'Marquee & Animation',
  testing: 'Testing',
  integration: 'Integration',
  functionality: 'Functionality',
};

/** Build clusters by grouping issues on their category. */
export function buildClusters(issues: AuditIssue[]): PromptCluster[] {
  const grouped = new Map<AuditCategory, AuditIssue[]>();
  for (const issue of issues) {
    const list = grouped.get(issue.category) ?? [];
    list.push(issue);
    grouped.set(issue.category, list);
  }

  const clusters: PromptCluster[] = [];
  let idx = 1;
  for (const [category, categoryIssues] of grouped) {
    clusters.push({
      id: `C${idx}`,
      name: CATEGORY_NAMES[category] ?? category,
      prompts: categoryIssues.map((i) => i.id),
      canParallelize: true,
      dependsOn: [],
      estimatedMinutes: categoryIssues.length * 10,
      agentCount: Math.min(categoryIssues.length, 5),
    });
    idx++;
  }
  return clusters;
}

/** Severity weights used to compute overall health score. */
const SEVERITY_WEIGHT: Record<string, number> = { critical: 10, high: 5, medium: 2, low: 1 };

export function buildAuditResult(ctx: AuditRuleContext, clusterFilter?: string): AuditResult {
  let issues = buildIssueCatalog(ctx);
  let clusters = buildClusters(issues);

  if (clusterFilter) {
    const cluster = clusters.find(
      (c) => c.id === clusterFilter || c.name.toLowerCase().includes(clusterFilter.toLowerCase()),
    );
    if (cluster) {
      const ids = new Set(cluster.prompts);
      issues = issues.filter((i) => ids.has(i.id));
      clusters = buildClusters(issues);
    }
  }

  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCategory: Record<string, number> = {};
  for (const issue of issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
    byCategory[issue.category] = (byCategory[issue.category] ?? 0) + 1;
  }

  // Health score: start at 100, subtract weighted penalty per issue (floor 0)
  const penalty = issues.reduce((sum, i) => sum + (SEVERITY_WEIGHT[i.severity] ?? 1), 0);
  const overallCompletion = Math.max(0, 100 - penalty);

  return {
    totalIssues: issues.length,
    bySeverity,
    byCategory,
    overallCompletion,
    clusters,
    issues,
    timestamp: new Date().toISOString(),
    cwd: ctx.root,
    framework: ctx.adapter.framework,
  };
}
