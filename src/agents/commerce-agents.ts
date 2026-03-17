/**
 * Commerce & Revenue Agents
 *
 * E-commerce feature validation, Stripe integration checks,
 * and checkout funnel health.
 */
import type { Agent, AgentResult } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: E-commerce Feature Validator
// ---------------------------------------------------------------------------

const ecommerceFeatureValidator: Agent = {
  id: 'ecommerce-feature-validator',
  name: 'E-commerce Feature Validator',
  description: 'Check for presence of cart, checkout, product, and order components',
  clusterId: 'commerce',
  shouldRun(ctx) {
    // Only repos that have e-commerce features
    const ecomRepos = ['damieus', 'ffs', '043'];
    return ecomRepos.includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`E-commerce Features: ${ctx.repoAlias}`);

    const featurePaths = [
      { label: 'Cart', patterns: ['components/cart', 'features/cart'] },
      { label: 'Checkout', patterns: ['components/checkout', 'features/checkout', 'pages/Checkout'] },
      { label: 'Products', patterns: ['components/products', 'features/shop', 'entities/product'] },
    ];

    const found: string[] = [];
    const missingFeatures: string[] = [];

    for (const feature of featurePaths) {
      let featureFound = false;

      for (const pattern of feature.patterns) {
        try {
          const srcPath = join(ctx.localPath, 'src', pattern);
          await access(srcPath);
          featureFound = true;
          break;
        } catch {
          // Try next pattern
        }
      }

      if (featureFound) {
        found.push(feature.label);
      } else {
        missingFeatures.push(feature.label);
      }
    }

    // Check for Stripe integration
    let hasStripe = false;
    try {
      const pkg = JSON.parse(await readFile(join(ctx.localPath, 'package.json'), 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      hasStripe = '@stripe/stripe-js' in allDeps || '@stripe/react-stripe-js' in allDeps || 'stripe' in allDeps;
    } catch {
      // No package.json
    }

    if (hasStripe) found.push('Stripe');
    else missingFeatures.push('Stripe');

    ctx.logger.info(`E-commerce: ${found.length} found, ${missingFeatures.length} missing`);
    for (const f of found) ctx.logger.info(`  ✅ ${f}`);
    for (const m of missingFeatures) ctx.logger.warn(`  ❌ ${m}`);

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: found.length >= 3 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Features: ${found.join(', ')} | Missing: ${missingFeatures.join(', ') || 'none'}`,
      artifacts: missingFeatures.map(m => `missing:${m}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Payment Config Checker
// ---------------------------------------------------------------------------

const paymentConfigChecker: Agent = {
  id: 'payment-config-checker',
  name: 'Payment Config Checker',
  description: 'Verify Stripe env vars and webhook configuration',
  clusterId: 'commerce',
  shouldRun(ctx) {
    const ecomRepos = ['damieus', 'ffs', '043', 'maximus'];
    return ecomRepos.includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Payment Config: ${ctx.repoAlias}`);

    const findings: string[] = [];

    // Check for env files with Stripe vars
    const envFiles = ['.env', '.env.local', '.env.example'];
    let hasStripeKey = false;

    for (const envFile of envFiles) {
      try {
        const content = await readFile(join(ctx.localPath, envFile), 'utf-8');
        if (/STRIPE/i.test(content)) {
          hasStripeKey = true;

          // Check for live keys in env files that get committed
          if (envFile !== '.env.local' && /sk_live_/i.test(content)) {
            findings.push(`CRITICAL: Live Stripe key in ${envFile}`);
            ctx.logger.error(`  🔑 Live Stripe key in ${envFile}!`);
          }
        }
      } catch {
        // File doesn't exist
      }
    }

    if (!hasStripeKey) {
      findings.push('No Stripe env vars found');
      ctx.logger.warn('No Stripe environment variables configured');
    }

    // Check .gitignore includes .env.local
    try {
      const gitignore = await readFile(join(ctx.localPath, '.gitignore'), 'utf-8');
      if (!gitignore.includes('.env.local')) {
        findings.push('.env.local not in .gitignore');
      }
    } catch {
      findings.push('No .gitignore');
    }

    ctx.logger.info(`Payment config issues: ${findings.length}`);
    ctx.logger.groupEnd();

    const hasBlocker = findings.some(f => f.includes('CRITICAL'));

    return {
      agentId: this.id,
      status: hasBlocker ? 'failed' : findings.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: findings.length > 0 ? findings.join('; ') : 'Payment config OK',
      artifacts: findings,
    };
  },
};

export const commerceAgents: Agent[] = [ecommerceFeatureValidator, paymentConfigChecker];
