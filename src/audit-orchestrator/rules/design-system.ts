/**
 * Rule: Design system — CSS custom properties, hardcoded colors, tokens, animation constants.
 * Returns issues only for gaps actually found.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches } from '../scanner.js';

export function auditDesignSystem(ctx: AuditRuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const srcDir = ctx.adapter.resolveSrc(ctx.root);
  const globalsCss = ctx.adapter.resolveStylesheet(ctx.root);

  let customProps = 0;
  if (existsSync(globalsCss)) {
    const css = readFileSync(globalsCss, 'utf-8');
    customProps = (css.match(/--[\w-]+:/g) ?? []).length;
  }

  if (customProps < 10) {
    issues.push({
      id: 'DS-01', title: `Low CSS custom property usage (${customProps} found)`,
      severity: customProps < 3 ? 'critical' : 'high', category: 'design',
      description: `Found ${customProps} CSS custom properties in stylesheet (target: 10+)`,
      affectedFiles: [globalsCss], completionPct: Math.min(100, Math.round((customProps / 10) * 100)),
    });
  }

  const hardcodedHex = countMatches(srcDir, /#[0-9a-fA-F]{3,8}(?![\w-])/g, /\.tsx$/);
  if (hardcodedHex > 20) {
    issues.push({
      id: 'DS-02', title: `Excessive hardcoded color values (${hardcodedHex} found)`,
      severity: hardcodedHex > 50 ? 'high' : 'medium', category: 'design',
      description: `Found ${hardcodedHex} hardcoded hex color values in .tsx files (target: <20)`,
      affectedFiles: [srcDir], completionPct: 0,
    });
  }

  const tokenPaths = [
    join(ctx.root, 'src', 'shared', 'config', 'design-system.ts'),
    join(ctx.root, 'src', 'shared', 'config', 'design-tokens.ts'),
    join(ctx.root, 'lib', 'design-system.ts'),
    join(ctx.root, 'src', 'lib', 'design-system.ts'),
  ];
  if (!tokenPaths.some((p) => existsSync(p))) {
    issues.push({
      id: 'DS-03', title: 'No design tokens file', severity: 'medium', category: 'design',
      description: 'No design-system.ts or design-tokens.ts file found in shared/config or lib',
      affectedFiles: [], completionPct: 0,
    });
  }

  const animImports = countMatches(srcDir, /from ['"]@?\/?(?:lib|shared)\/animations/g);
  if (animImports === 0) {
    const framerRefs = countMatches(srcDir, /framer-motion|motion\./g);
    if (framerRefs > 0) {
      issues.push({
        id: 'DS-04', title: 'No centralized animation imports', severity: 'low', category: 'design',
        description: `Found ${framerRefs} Framer Motion references but no imports from a shared animations module`,
        affectedFiles: [srcDir], completionPct: 0,
      });
    }
  }

  return issues;
}
