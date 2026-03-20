/**
 * Rule: Test ID coverage — measures data-testid density.
 * Only reports an issue if coverage is below the target of 50.
 */

import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches } from '../scanner.js';

export function auditTestIds(ctx: AuditRuleContext): AuditIssue[] {
  const srcDir = ctx.adapter.resolveSrc(ctx.root);
  const testIdCount = countMatches(srcDir, /data-testid=/g);

  if (testIdCount < 50) {
    return [{
      id: 'TID-01', title: `Low test ID coverage (${testIdCount} found)`,
      severity: testIdCount < 10 ? 'high' : 'medium', category: 'accessibility',
      description: `Found ${testIdCount} data-testid attributes (target: 50+ for reliable E2E testing)`,
      affectedFiles: [srcDir], completionPct: Math.min(100, Math.round((testIdCount / 50) * 100)),
    }];
  }

  return [];
}
