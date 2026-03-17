/**
 * Integration Agents
 *
 * Validate external API integrations, webhook configs,
 * and third-party service health.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: API Integration Scanner
// ---------------------------------------------------------------------------

const apiIntegrationScanner: Agent = {
  id: 'api-integration-scanner',
  name: 'API Integration Scanner',
  description: 'Detect and catalog external API integrations',
  clusterId: 'integration',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`API Integrations: ${ctx.repoAlias}`);

    const pkgPath = join(ctx.localPath, 'package.json');
    const integrations: string[] = [];

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      const apiLibs: Record<string, string> = {
        '@supabase/supabase-js': 'Supabase',
        stripe: 'Stripe',
        '@stripe/stripe-js': 'Stripe.js',
        resend: 'Resend (Email)',
        '@sendgrid/mail': 'SendGrid (Email)',
        '@vercel/analytics': 'Vercel Analytics',
        '@vercel/speed-insights': 'Vercel Speed Insights',
        '@sentry/nextjs': 'Sentry',
        '@sentry/react': 'Sentry',
        'google-auth-library': 'Google Auth',
        '@google-analytics/data': 'Google Analytics',
        openai: 'OpenAI',
        '@anthropic-ai/sdk': 'Anthropic',
        axios: 'Axios (HTTP)',
        'node-fetch': 'node-fetch (HTTP)',
      };

      for (const [dep, label] of Object.entries(apiLibs)) {
        if (allDeps[dep]) {
          integrations.push(`${label} (${allDeps[dep]})`);
        }
      }
    } catch {
      ctx.logger.warn('Could not read package.json');
    }

    // Check for env vars that suggest integrations
    for (const envFile of ['.env', '.env.local', '.env.example']) {
      const envPath = join(ctx.localPath, envFile);
      try {
        const content = await readFile(envPath, 'utf-8');
        if (/OPENAI|ANTHROPIC|GOOGLE_API/i.test(content)) {
          integrations.push(`AI API (from ${envFile})`);
        }
      } catch {
        // no env file
      }
    }

    ctx.logger.info(`Integrations: ${integrations.length}`);
    for (const i of integrations) ctx.logger.info(`  ${i}`);

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: integrations.join(', ') || 'No integrations detected',
      artifacts: integrations,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Webhook Config Validator
// ---------------------------------------------------------------------------

const webhookConfigValidator: Agent = {
  id: 'webhook-config-validator',
  name: 'Webhook Config Validator',
  description: 'Verify webhook endpoint configuration and security',
  clusterId: 'integration',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Webhook Config: ${ctx.repoAlias}`);

    const findings: string[] = [];

    // Check for webhook route handlers
    const apiDirs = [
      join(ctx.localPath, 'src', 'app', 'api'),
      join(ctx.localPath, 'app', 'api'),
      join(ctx.localPath, 'supabase', 'functions'),
    ];

    for (const apiDir of apiDirs) {
      const s = await stat(apiDir).catch(() => null);
      if (s?.isDirectory()) {
        const rel = apiDir.replace(ctx.localPath + '/', '');
        findings.push(`✅ API directory found: ${rel}`);

        // Check for webhook-related dirs
        const webhookDirs = ['webhooks', 'webhook', 'stripe'];
        for (const wd of webhookDirs) {
          const whDir = join(apiDir, wd);
          if ((await stat(whDir).catch(() => null))?.isDirectory()) {
            findings.push(`✅ Webhook handler: ${rel}/${wd}`);
          }
        }
      }
    }

    if (findings.length === 0) {
      findings.push('⚠ No API routes or webhook handlers detected');
    }

    ctx.logger.info(findings.join('\n  '));
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${findings.length} integration endpoints`,
      artifacts: findings,
    };
  },
};

export const integrationAgents: Agent[] = [apiIntegrationScanner, webhookConfigValidator];
