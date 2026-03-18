/**
 * Email & Notification Agents
 *
 * Validates email integration configuration,
 * template presence, and notification handler setup.
 */
import type { Agent, AgentResult, AgentFinding } from '../types.js';
import { readFile, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Email Integration Checker
// ---------------------------------------------------------------------------

const emailIntegrationChecker: Agent = {
  id: 'email-integration-checker',
  name: 'Email Integration Checker',
  description: 'Check for email service configuration (Resend, SendGrid, etc.)',
  clusterId: 'email',
  shouldRun(ctx) {
    const emailRepos = ['maximus', '043'];
    return emailRepos.includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Email Integration: ${ctx.repoAlias}`);

    const findings: string[] = [];

    try {
      const pkg = JSON.parse(await readFile(join(ctx.localPath, 'package.json'), 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      const emailPackages = ['resend', '@sendgrid/mail', 'nodemailer', '@react-email/components'];
      const found = emailPackages.filter(p => p in allDeps);

      if (found.length === 0) {
        findings.push('No email package installed');
      } else {
        ctx.logger.info(`Email packages: ${found.join(', ')}`);
      }
    } catch {
      findings.push('Cannot read package.json');
    }

    // Check for email templates directory
    const templateDirs = ['src/emails', 'emails', 'src/features/email', 'src/shared/email'];
    let hasTemplates = false;

    for (const dir of templateDirs) {
      try {
        await access(join(ctx.localPath, dir));
        hasTemplates = true;
        ctx.logger.info(`Email templates: ${dir}`);
        break;
      } catch {
        // Try next
      }
    }

    if (!hasTemplates) {
      findings.push('No email templates directory');
    }

    ctx.logger.info(`Issues: ${findings.length}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: findings.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: findings.length > 0 ? findings.join('; ') : 'Email integration OK',
      artifacts: findings,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Email Template Validator
// ---------------------------------------------------------------------------

const emailTemplateValidator: Agent = {
  id: 'email-template-validator',
  name: 'Email Template Validator',
  description: 'Validate React Email template files exist and export properly',
  clusterId: 'email',
  shouldRun(ctx) {
    return ['maximus', '043'].includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Email Templates: ${ctx.repoAlias}`);

    const findings: AgentFinding[] = [];
    const templateDirs = ['src/emails', 'emails', 'src/features/email/templates'];
    let templateCount = 0;

    for (const dir of templateDirs) {
      try {
        const entries = await readdir(join(ctx.localPath, dir));
        const templates = entries.filter(f => /\.(tsx|jsx)$/.test(f));
        templateCount += templates.length;

        for (const tpl of templates) {
          const content = await readFile(join(ctx.localPath, dir, tpl), 'utf-8');
          if (!/export\s+(default|const|function)/.test(content)) {
            findings.push({
              severity: 'warning',
              message: `Template missing export: ${dir}/${tpl}`,
              file: `${dir}/${tpl}`,
              suggestion: 'Add a default or named export',
            });
          }
        }
      } catch {
        // dir doesn't exist — skip
      }
    }

    if (templateCount === 0) {
      findings.push({
        severity: 'info',
        message: 'No email templates found',
        suggestion: 'Create React Email templates in src/emails/',
      });
    }

    ctx.logger.info(`Templates: ${templateCount} | Issues: ${findings.length}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: findings.some(f => f.severity === 'error') ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${templateCount} templates, ${findings.length} issues`,
      artifacts: findings.map(f => f.message),
      findings,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Email Webhook Checker
// ---------------------------------------------------------------------------

const emailWebhookChecker: Agent = {
  id: 'email-webhook-checker',
  name: 'Email Webhook Checker',
  description: 'Check for email webhook handler routes (e.g., /api/webhooks/resend)',
  clusterId: 'email',
  shouldRun(ctx) {
    return ['maximus', '043'].includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Email Webhooks: ${ctx.repoAlias}`);

    const findings: AgentFinding[] = [];
    const webhookPaths = [
      'src/app/api/webhooks/resend/route.ts',
      'src/pages/api/webhooks/resend.ts',
      'supabase/functions/email-webhook/index.ts',
    ];

    let found = false;
    for (const wh of webhookPaths) {
      try {
        await access(join(ctx.localPath, wh));
        found = true;
        ctx.logger.info(`Webhook handler: ${wh}`);
      } catch {
        // Not found
      }
    }

    if (!found) {
      findings.push({
        severity: 'info',
        message: 'No email webhook handler found',
        suggestion: 'Create webhook handler at src/app/api/webhooks/resend/route.ts',
      });
    }

    ctx.logger.info(`Webhook found: ${found}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: found ? 'Webhook handler present' : 'No webhook handler',
      artifacts: findings.map(f => f.message),
      findings,
    };
  },
};

export const emailAgents: Agent[] = [emailIntegrationChecker, emailTemplateValidator, emailWebhookChecker];
