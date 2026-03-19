/**
 * Rule: Marquee / ticker presence and animation.
 * Only reports issues if marquee/ticker elements exist but lack animation.
 */

import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches } from '../scanner.js';

export function auditMarquee(ctx: AuditRuleContext): AuditIssue[] {
  const src = ctx.adapter.resolveSrc(ctx.root);
  const marqueeCount = countMatches(src, /marquee|Marquee|ticker|Ticker/g);

  // No marquee = no issues (marquee is optional)
  if (marqueeCount === 0) return [];

  const animRefs = countMatches(src, /marquee.*animate|@keyframes.*marquee|motion\.div.*marquee/gi);
  if (animRefs === 0) {
    return [{
      id: 'MRQ-01', title: 'Marquee component not animated', severity: 'medium', category: 'functionality',
      description: `Found ${marqueeCount} marquee/ticker references but no animation (keyframes or motion)`,
      affectedFiles: [src], completionPct: 0,
    }];
  }

  return [];
}
