/**
 * Rule: Button consistency — shared component, variants, CTA patterns.
 * Returns issues only for gaps actually found.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches } from '../scanner.js';

export function auditButtonConsistency(ctx: AuditRuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const src = ctx.adapter.resolveSrc(ctx.root);

  const buttonPaths = [
    join(ctx.adapter.resolveComponents(ctx.root), 'button.tsx'),
    join(ctx.adapter.resolveComponents(ctx.root), 'Button.tsx'),
    join(src, 'shared', 'ui', 'button.tsx'),
    join(src, 'components', 'ui', 'button.tsx'),
  ];
  const buttonFile = buttonPaths.find((p) => existsSync(p));

  if (!buttonFile) {
    issues.push({
      id: 'BTN-01', title: 'No shared Button component', severity: 'high', category: 'design',
      description: 'No shared button.tsx found in components/ui or shared/ui',
      affectedFiles: [], completionPct: 0,
    });
    return issues;
  }

  const variantCount = countMatches(buttonFile, /variant|default|destructive|outline|secondary|ghost|link/g);
  if (variantCount < 5) {
    issues.push({
      id: 'BTN-02', title: 'Button component lacks variant system', severity: 'medium', category: 'design',
      description: `Button component has ${variantCount} variant-related references (target: 5+)`,
      affectedFiles: [buttonFile], completionPct: Math.min(100, Math.round((variantCount / 5) * 100)),
    });
  }

  const ctaRefs = countMatches(src, /ButtonProps|cva|buttonVariants/g);
  if (ctaRefs === 0) {
    issues.push({
      id: 'BTN-03', title: 'No CTA pattern system', severity: 'low', category: 'design',
      description: 'No ButtonProps, cva, or buttonVariants references found — buttons may be inconsistent',
      affectedFiles: [src], completionPct: 0,
    });
  }

  return issues;
}
