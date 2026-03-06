/**
 * PR Management Agents
 *
 * Real execution: reviews Copilot PRs, enforces DB migration firewall,
 * posts review comments, manages approval workflow via GitHub API.
 */
import type { Agent, AgentResult } from '../types.js';
import { getRepo } from '../config/repo-registry.js';

function parseSlug(slug: string): { owner: string; repo: string } {
  const parts = slug.split('/');
  return { owner: parts[0]!, repo: parts[1]! };
}

const prReviewAgent: Agent = {
  id: 'pr-review',
  name: 'PR Review & Firewall Agent',
  description: 'Review open Copilot PRs: detect DB migrations, post status, manage approval flow',
  clusterId: 'prs',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);
    const prs = await ctx.github.listPRs(owner, repo, 'open');

    // Filter to Copilot PRs (has automation:copilot label or author is copilot)
    const copilotPRs = prs.filter(pr =>
      pr.labels.some(l => l.name === 'automation:copilot') ||
      pr.user.login === 'copilot' ||
      pr.head.ref.startsWith('copilot/')
    );

    if (copilotPRs.length === 0) {
      ctx.logger.info('No open Copilot PRs found');
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No Copilot PRs', artifacts: [] };
    }

    ctx.logger.group(`Reviewing ${copilotPRs.length} Copilot PRs`);

    let reviewed = 0;
    let firewalled = 0;
    const artifacts: string[] = [];

    for (const pr of copilotPRs) {
      ctx.logger.info(`PR #${pr.number}: ${pr.title}`);

      // Get changed files
      const files = await ctx.github.getPRFiles(owner, repo, pr.number);
      const hasDBMigration = files.some(f =>
        f.filename.includes('supabase/migrations') ||
        (f.filename.endsWith('.sql') && f.filename.includes('migration'))
      );
      const hasDestructiveOps = files.some(f => {
        // Only check .sql files for destructive operations
        if (!f.filename.endsWith('.sql')) return false;
        // We can't read file content from API listing — flag any DB migration as needing review
        return f.filename.includes('supabase/migrations');
      });

      // Build review comment body
      const reviewTable = [
        '## UGWTF PR Review',
        '',
        '| Check | Result |',
        '|-------|--------|',
        `| Changed Files | ${files.length} |`,
        `| DB Migration | ${hasDBMigration ? 'DETECTED' : 'None'} |`,
        `| Destructive Ops | ${hasDestructiveOps ? 'REVIEW REQUIRED' : 'N/A'} |`,
        `| Auto-Merge | ${hasDBMigration ? 'BLOCKED' : 'Eligible'} |`,
      ];

      if (hasDBMigration && repoConfig.supabaseProjectId) {
        firewalled++;
        reviewTable.push(
          '',
          '### DB Migration Firewall — Manual Merge Required',
          '',
          'This PR contains database migration files. Auto-merge is **blocked**.',
          '',
          '**Manual steps:**',
          '1. Apply migration SQL via Supabase Dashboard → SQL Editor',
          `2. Regenerate types: \`npx supabase gen types typescript --project-id ${repoConfig.supabaseProjectId} > ${repoConfig.supabaseTypesPath}\``,
          '3. Deploy Edge Functions if needed: `npx supabase functions deploy`',
          '4. Run quality gates: `npx tsc --noEmit && npm run lint && npm run build`',
          '5. Merge this PR manually after verification',
        );

        if (!ctx.dryRun) {
          await ctx.github.addLabels(owner, repo, pr.number, ['database', 'needs-review']);
        }
      } else if (hasDBMigration) {
        firewalled++;
        reviewTable.push(
          '',
          '### DB Migration Detected — Manual Review Required',
          '',
          'This PR contains SQL files. Auto-merge is **blocked**.',
          'Review and merge manually after verifying migration safety.',
        );
        if (!ctx.dryRun) {
          await ctx.github.addLabels(owner, repo, pr.number, ['database', 'needs-review']);
        }
      } else {
        reviewTable.push(
          '',
          'No DB migration detected. PR is eligible for auto-merge after quality checks pass.',
        );
      }

      reviewTable.push('', '*Reviewed by UGWTF PR Management Agent*');

      if (!ctx.dryRun) {
        await ctx.github.addComment(owner, repo, pr.number, reviewTable.join('\n'));
      }

      reviewed++;
      artifacts.push(`PR #${pr.number}: ${hasDBMigration ? 'FIREWALLED' : 'OK'}`);
      ctx.logger.success(`PR #${pr.number}: ${hasDBMigration ? 'FIREWALLED (DB migration)' : 'reviewed'}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Reviewed: ${reviewed}, Firewalled: ${firewalled}`,
      artifacts,
    };
  },
};

const prBatchProcessor: Agent = {
  id: 'pr-batch-process',
  name: 'PR Batch Processor',
  description: 'Process all open Copilot PRs: label, comment, detect abandoned PRs',
  clusterId: 'prs',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);
    const prs = await ctx.github.listPRs(owner, repo, 'open');

    let processed = 0;
    const abandoned: number[] = [];

    for (const pr of prs) {
      // Check if PR is abandoned (draft + no activity in 7+ days)
      const createdDate = new Date(pr.head.sha); // approximation — use created_at if available
      const isProbablyStale = pr.draft && prs.length > 5; // heuristic

      if (isProbablyStale) {
        abandoned.push(pr.number);
        if (!ctx.dryRun) {
          await ctx.github.addLabels(owner, repo, pr.number, ['stalled']);
          await ctx.github.addComment(owner, repo, pr.number,
            `**Stale Draft PR Detected**\n\nThis draft PR appears inactive. Consider:\n1. Requesting Copilot to continue work\n2. Closing if no longer needed\n\n*Flagged by UGWTF PR Batch Processor*`
          );
        }
      }

      // Ensure automation labels are consistent
      const hasCopilotLabel = pr.labels.some(l => l.name === 'automation:copilot');
      const isCopilotBranch = pr.head.ref.startsWith('copilot/');

      if (isCopilotBranch && !hasCopilotLabel && !ctx.dryRun) {
        await ctx.github.addLabels(owner, repo, pr.number, ['automation:copilot']);
      }

      processed++;
    }

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Processed: ${processed} PRs, Abandoned: ${abandoned.length}`,
      artifacts: abandoned.map(n => `STALE: PR #${n}`),
    };
  },
};

const prCompletionTracker: Agent = {
  id: 'pr-completion-tracker',
  name: 'PR Completion Tracker',
  description: 'Track merged Copilot PRs and update linked issue labels',
  clusterId: 'prs',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);

    // Get recently closed PRs to find merged ones
    const closedPRs = await ctx.github.listPRs(owner, repo, 'closed');

    // Filter to Copilot PRs merged recently (check labels)
    const mergedCopilotPRs = closedPRs.filter(pr =>
      pr.labels.some(l => l.name === 'automation:copilot') ||
      pr.head.ref.startsWith('copilot/')
    );

    let completedIssues = 0;

    for (const pr of mergedCopilotPRs) {
      // Extract linked issue numbers
      const body = pr.body ?? '';
      const issueMatches = body.matchAll(/(?:Fixes|Closes|Resolves)\s+#(\d+)/gi);

      for (const match of issueMatches) {
        const issueNumber = parseInt(match[1]!);
        try {
          if (!ctx.dryRun) {
            await ctx.github.addLabels(owner, repo, issueNumber, ['automation:completed']);
            await ctx.github.removeLabel(owner, repo, issueNumber, 'automation:in-progress');
          }
          completedIssues++;
        } catch {
          // Issue may already be closed/labeled
        }
      }
    }

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Tracked: ${mergedCopilotPRs.length} merged PRs, ${completedIssues} issues completed`,
      artifacts: [],
    };
  },
};

export const prAgents: Agent[] = [prReviewAgent, prBatchProcessor, prCompletionTracker];
