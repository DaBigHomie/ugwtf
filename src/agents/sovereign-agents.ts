/**
 * Sovereign Orchestration Agents
 *
 * Meta-orchestration governance: enforces merge ordering,
 * validates plan compliance, and manages cross-repo coordination.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Plan Compliance Checker
// ---------------------------------------------------------------------------

const planComplianceChecker: Agent = {
  id: 'plan-compliance-checker',
  name: 'Plan Compliance Checker',
  description: 'Verify PRs align with documented deployment plans',
  clusterId: 'sovereign',
  shouldRun(ctx) {
    // Only repos with formal plans
    const planned = ['maximus'];
    return planned.includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Plan Compliance: ${ctx.repoAlias}`);

    // Check for plan document
    const planPaths = [
      'docs/20X-PLAN.md',
      'docs/planning/MAXIMUS-AI-DEPLOYMENT-PLAN.md',
      'docs/DEPLOYMENT_PLAN.md',
    ];

    let planExists = false;
    for (const p of planPaths) {
      try {
        await access(join(ctx.localPath, p));
        planExists = true;
        ctx.logger.info(`Plan document: ${p}`);
        break;
      } catch {
        // Try next
      }
    }

    if (!planExists) {
      ctx.logger.info('No deployment plan document found');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No plan doc', artifacts: [] };
    }

    // Check open PRs for sovereign alignment headers
    if (ctx.dryRun) {
      ctx.logger.info('[dry-run] Would check open PRs for plan alignment');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: 'dry-run', artifacts: [] };
    }

    try {
      const prs = await ctx.github.listPRs(ctx.repoSlug, 'open');
      const misaligned: string[] = [];

      for (const pr of prs) {
        const body = pr.body ?? '';
        if (!body.includes('Plan Phase') && !body.includes('Sovereign Alignment')) {
          misaligned.push(`PR #${pr.number}: ${pr.title} — missing Plan Phase`);
        }
      }

      ctx.logger.info(`Open PRs: ${prs.length} | Misaligned: ${misaligned.length}`);
      for (const m of misaligned.slice(0, 5)) ctx.logger.warn(`  ⚠ ${m}`);

      ctx.logger.groupEnd();

      return {
        agentId: this.id,
        status: misaligned.length > 0 ? 'failed' : 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `${misaligned.length} PRs missing plan alignment`,
        artifacts: misaligned,
      };
    } catch (err) {
      ctx.logger.warn('Failed to fetch PRs');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: Date.now() - start, message: 'PR fetch failed', artifacts: [] };
    }
  },
};

// ---------------------------------------------------------------------------
// Agent: Cross-Repo Consistency Checker
// ---------------------------------------------------------------------------

const crossRepoConsistencyChecker: Agent = {
  id: 'cross-repo-consistency',
  name: 'Cross-Repo Consistency Checker',
  description: 'Validate shared config patterns across related repos',
  clusterId: 'sovereign',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Consistency: ${ctx.repoAlias}`);

    const findings: string[] = [];

    // Check that label system is consistent (by checking for label instruction file)
    try {
      await access(join(ctx.localPath, '.github', 'instructions'));
      const content = await readFile(join(ctx.localPath, '.github', 'copilot-instructions.md'), 'utf-8');

      // Check for standard markers
      if (!content.includes('Pre-Commit') && !content.includes('pre-commit')) {
        findings.push('copilot-instructions.md missing pre-commit section');
      }

      if (!content.includes('DO') || !content.includes("DON'T")) {
        findings.push('copilot-instructions.md missing DO/DON\'T section');
      }
    } catch {
      findings.push('Missing instruction infrastructure');
    }

    ctx.logger.info(`Consistency findings: ${findings.length}`);
    for (const f of findings) ctx.logger.warn(`  ⚠ ${f}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: findings.length > 1 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: findings.length > 0 ? findings.join('; ') : 'Consistency OK',
      artifacts: findings,
    };
  },
};

export const sovereignAgents: Agent[] = [planComplianceChecker, crossRepoConsistencyChecker];
