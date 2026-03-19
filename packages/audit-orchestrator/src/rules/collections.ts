/**
 * Rule: Collections — feature dir, route, thumbnails, search/filter.
 * Only reports issues if the project has shop/collection features.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches } from '../scanner.js';

export function auditCollections(ctx: AuditRuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const src = ctx.adapter.resolveSrc(ctx.root);

  const featurePaths = [
    join(src, 'features', 'collections'),
    join(src, 'features', 'shop'),
  ];
  const hasShopFeature = featurePaths.some((p) => existsSync(p));

  const routePaths = [
    join(src, 'app', 'collections'),
    join(src, 'app', 'shop'),
    join(src, 'pages', 'Shop.tsx'),
  ];
  const hasShopRoute = routePaths.some((p) => existsSync(p));

  // Skip entirely if no shop/collection features
  if (!hasShopFeature && !hasShopRoute) return [];

  if (!hasShopFeature) {
    issues.push({
      id: 'COL-01', title: 'Shop route exists but no feature directory', severity: 'high', category: 'functionality',
      description: 'Shop/collection route found but no corresponding feature directory',
      affectedFiles: routePaths.filter((p) => existsSync(p)), completionPct: 0,
    });
  }

  if (!hasShopRoute) {
    issues.push({
      id: 'COL-02', title: 'Shop feature exists but no route', severity: 'high', category: 'functionality',
      description: 'Shop/collection feature directory found but no corresponding route',
      affectedFiles: featurePaths.filter((p) => existsSync(p)), completionPct: 0,
    });
  }

  const imageRefs = countMatches(src, /collection.*image|collection.*thumbnail|CollectionCard/gi);
  if (hasShopFeature && imageRefs === 0) {
    issues.push({
      id: 'COL-03', title: 'No collection image/thumbnail references', severity: 'medium', category: 'content',
      description: 'Collection feature exists but no collection image or thumbnail references found',
      affectedFiles: featurePaths.filter((p) => existsSync(p)), completionPct: 0,
    });
  }

  const filterRefs = countMatches(src, /searchParams|useSearchParams|FilterBar/g);
  if (hasShopFeature && filterRefs === 0) {
    issues.push({
      id: 'COL-04', title: 'No search/filter functionality', severity: 'medium', category: 'functionality',
      description: 'Shop feature exists but no searchParams, useSearchParams, or FilterBar references',
      affectedFiles: featurePaths.filter((p) => existsSync(p)), completionPct: 0,
    });
  }

  return issues;
}
