/**
 * Email & Notification Agents
 *
 * Validates email integration configuration,
 * template presence, and notification handler setup.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, access } from 'node:fs/promises';
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

export const emailAgents: Agent[] = [emailIntegrationChecker];
