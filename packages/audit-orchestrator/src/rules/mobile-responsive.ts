/**
 * Rule: Mobile responsiveness — responsive classes, mobile menu, touch targets.
 * Returns issues only for gaps actually found.
 */

import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches, findFiles } from '../scanner.js';

export function auditMobileResponsiveness(ctx: AuditRuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const srcDir = ctx.adapter.resolveSrc(ctx.root);

  const mdClasses = countMatches(srcDir, /\bmd:/g);
  const lgClasses = countMatches(srcDir, /\blg:/g);
  const smClasses = countMatches(srcDir, /\bsm:/g);
  const totalResponsive = mdClasses + lgClasses + smClasses;

  if (totalResponsive < 20) {
    issues.push({
      id: 'MOB-01', title: `Low responsive class usage (${totalResponsive} found)`,
      severity: totalResponsive < 5 ? 'critical' : 'high', category: 'mobile',
      description: `Found sm:${smClasses} md:${mdClasses} lg:${lgClasses} responsive classes (target: 20+ total)`,
      affectedFiles: [srcDir], completionPct: Math.min(100, Math.round((totalResponsive / 20) * 100)),
    });
  }

  const mobileMenuFiles = findFiles(srcDir, /mobile.*menu|menu.*mobile|hamburger/i);
  const mobileMenuRefs = countMatches(srcDir, /MobileMenu|mobile-menu|HamburgerMenu/g);
  if (mobileMenuFiles.length === 0 && mobileMenuRefs === 0) {
    issues.push({
      id: 'MOB-02', title: 'No mobile menu component detected', severity: 'high', category: 'mobile',
      description: 'No mobile menu, hamburger menu files or references found',
      affectedFiles: [srcDir], completionPct: 0,
    });
  }

  const touchTargets = countMatches(srcDir, /min-h-\[44px\]|min-w-\[44px\]|h-11|w-11|p-3/g);
  if (touchTargets < 5) {
    issues.push({
      id: 'MOB-03', title: `Low touch target coverage (${touchTargets} found)`, severity: 'medium', category: 'mobile',
      description: `Found ${touchTargets} explicit touch target sizing patterns (target: 5+)`,
      affectedFiles: [srcDir], completionPct: Math.min(100, Math.round((touchTargets / 5) * 100)),
    });
  }

  return issues;
}
