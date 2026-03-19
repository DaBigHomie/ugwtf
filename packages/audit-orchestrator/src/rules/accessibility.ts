/**
 * Rule: Accessibility — ARIA coverage, skip-to-content, focus traps, alt text.
 * Returns issues only for gaps actually found.
 */

import { existsSync } from 'node:fs';
import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches, fileContains } from '../scanner.js';

export function auditAccessibility(ctx: AuditRuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const srcDir = ctx.adapter.resolveSrc(ctx.root);

  const ariaCount = countMatches(srcDir, /aria-/g);
  if (ariaCount < 30) {
    issues.push({
      id: 'A11Y-01', title: `Low ARIA attribute coverage (${ariaCount} found)`,
      severity: ariaCount < 10 ? 'critical' : 'high', category: 'accessibility',
      description: `Found ${ariaCount} aria- attributes across source files (target: 30+)`,
      affectedFiles: [srcDir], completionPct: Math.min(100, Math.round((ariaCount / 30) * 100)),
    });
  }

  const layoutFile = ctx.adapter.resolveLayout(ctx.root);
  if (existsSync(layoutFile) && !fileContains(layoutFile, ['skip-to', 'Skip to'])) {
    issues.push({
      id: 'A11Y-02', title: 'Missing skip-to-content link', severity: 'high', category: 'accessibility',
      description: 'Layout file exists but has no skip-to-content link for keyboard navigation',
      affectedFiles: [layoutFile], completionPct: 0,
    });
  }

  const focusTrap = countMatches(srcDir, /focus-trap|FocusTrap|useFocusTrap/g);
  if (focusTrap === 0) {
    issues.push({
      id: 'A11Y-03', title: 'No focus trap implementation', severity: 'medium', category: 'accessibility',
      description: 'No focus-trap, FocusTrap, or useFocusTrap references found',
      affectedFiles: [srcDir], completionPct: 0,
    });
  }

  const altCount = countMatches(srcDir, /alt=/g);
  if (altCount < 10) {
    issues.push({
      id: 'A11Y-04', title: `Low alt text coverage (${altCount} found)`,
      severity: altCount < 3 ? 'high' : 'medium', category: 'accessibility',
      description: `Found ${altCount} alt= attributes across source files (target: 10+)`,
      affectedFiles: [srcDir], completionPct: Math.min(100, Math.round((altCount / 10) * 100)),
    });
  }

  return issues;
}
