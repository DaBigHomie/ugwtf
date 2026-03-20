/**
 * Rule: Dark mode contrast validation.
 * Checks CSS custom properties, dark: prefixed classes, and darkMode config.
 * Returns issues only for gaps actually found.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches } from '../scanner.js';

export function auditDarkModeContrast(ctx: AuditRuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const srcDir = ctx.adapter.resolveSrc(ctx.root);
  const globalsCss = ctx.adapter.resolveStylesheet(ctx.root);
  const tailwindConfig = ctx.adapter.resolveConfig(ctx.root);

  let hasDarkSelectors = false;
  let hasThemeVars = false;
  let hasSurfaceVars = false;

  if (existsSync(globalsCss)) {
    const css = readFileSync(globalsCss, 'utf-8');
    hasDarkSelectors = css.includes('.dark') || css.includes('[data-theme="dark"]') || css.includes('@media (prefers-color-scheme: dark)');
    hasThemeVars = /--heading-color|--eyebrow-color|--body-muted|--text-primary/.test(css);
    hasSurfaceVars = /--card-bg|--section-bg|--surface/.test(css);
  }

  if (!hasDarkSelectors) {
    issues.push({
      id: 'DM-01', title: 'No dark mode CSS selectors', severity: 'critical', category: 'dark-mode',
      description: 'No .dark, [data-theme="dark"], or prefers-color-scheme selectors found in stylesheet',
      affectedFiles: [globalsCss], completionPct: 0,
    });
  }

  if (!hasThemeVars) {
    issues.push({
      id: 'DM-02', title: 'No CSS theme variables for color modes', severity: 'critical', category: 'dark-mode',
      description: 'Expected --heading-color, --eyebrow-color, --body-muted, or --text-primary not found',
      affectedFiles: [globalsCss], completionPct: 0,
    });
  }

  if (hasDarkSelectors && !hasSurfaceVars) {
    issues.push({
      id: 'DM-03', title: 'Missing dark mode surface variables', severity: 'high', category: 'dark-mode',
      description: 'Dark mode selectors exist but no --card-bg, --section-bg, or --surface variables',
      affectedFiles: [globalsCss], completionPct: 0,
    });
  }

  const darkClasses = countMatches(srcDir, /dark:/g);
  if (hasDarkSelectors && darkClasses < 50) {
    issues.push({
      id: 'DM-04', title: `Low dark: utility class usage (${darkClasses} found)`,
      severity: darkClasses < 10 ? 'high' : 'medium', category: 'dark-mode',
      description: `Only ${darkClasses} dark: variant classes found in source files (target: 50+)`,
      affectedFiles: [srcDir], completionPct: Math.min(100, Math.round((darkClasses / 50) * 100)),
    });
  }

  if (existsSync(tailwindConfig)) {
    const tw = readFileSync(tailwindConfig, 'utf-8');
    if (!tw.includes('darkMode')) {
      issues.push({
        id: 'DM-05', title: 'Tailwind darkMode not configured', severity: 'medium', category: 'dark-mode',
        description: 'No darkMode property found in Tailwind config file',
        affectedFiles: [tailwindConfig], completionPct: 0,
      });
    }
  }

  return issues;
}
