/**
 * Rule: Checkout flow — page, cart feature, Stripe, components, shipping.
 * Only reports issues if the project has e-commerce indicators.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches } from '../scanner.js';

export function auditCheckoutFlow(ctx: AuditRuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const src = ctx.adapter.resolveSrc(ctx.root);

  // Skip if no e-commerce indicators
  const ecommerceRefs = countMatches(src, /checkout|addToCart|CartProvider|useCart|Stripe/g);
  if (ecommerceRefs < 3) return [];

  // Checkout page
  const checkoutPaths = [
    join(src, 'app', 'checkout', 'page.tsx'),
    join(src, 'pages', 'Checkout.tsx'),
    join(src, 'pages', 'UnifiedCheckout.tsx'),
  ];
  if (!checkoutPaths.some((p) => existsSync(p))) {
    issues.push({
      id: 'CKO-01', title: 'No checkout page found', severity: 'high', category: 'functionality',
      description: 'E-commerce references found but no checkout page at expected paths',
      affectedFiles: [], completionPct: 0,
    });
  }

  // Cart feature
  const cartPaths = [
    join(src, 'features', 'cart'),
    join(src, 'features', 'checkout'),
    join(src, 'hooks', 'useCheckout.ts'),
  ];
  if (!cartPaths.some((p) => existsSync(p))) {
    issues.push({
      id: 'CKO-02', title: 'No cart/checkout feature directory', severity: 'high', category: 'functionality',
      description: 'No cart or checkout feature directory found',
      affectedFiles: [], completionPct: 0,
    });
  }

  // Stripe integration
  const stripeImports = countMatches(src, /@stripe\/|loadStripe/g);
  if (stripeImports === 0) {
    issues.push({
      id: 'CKO-03', title: 'No Stripe payment integration', severity: 'medium', category: 'integration',
      description: 'No @stripe/ or loadStripe references found despite e-commerce features',
      affectedFiles: [src], completionPct: 0,
    });
  }

  // Shipping method
  const shippingRefs = countMatches(src, /ShippingMethod|shippingMethod|shipping.*method/g);
  if (shippingRefs === 0) {
    issues.push({
      id: 'CKO-04', title: 'No shipping method implementation', severity: 'medium', category: 'functionality',
      description: 'No ShippingMethod or shippingMethod references found',
      affectedFiles: [src], completionPct: 0,
    });
  }

  return issues;
}
