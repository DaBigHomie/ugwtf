/**
 * Cleanup Agent — Full chain state reset
 *
 * One agent that:
 *   1. Closes orphaned draft Copilot PRs referencing chain issues
 *   2. Removes ALL automation labels from open chain issues
 *   3. Dispatches chain-next for the first open chain issue
 */
import type { Agent, AgentContext, AgentResult } from '../types.js';
import { readFileSync } from 'node:fs';
import { type ChainConfig, resolveChainPath } from './chain-types.js';

const LABELS_TO_REMOVE = [
  'automation:in-progress',
  'automation:copilot',
  'automation:completed',
  'copilot:ready',
  'stalled',
  'needs-pr',
  'needs-review',
  'prompt-chain',
  'enhancement',
];

const cleanupAgent: Agent = {
  id: 'cleanup',
  name: 'Chain Cleanup',
  description: 'Reset chain state: close orphan PRs, strip labels, dispatch next',
  clusterId: 'cleanup',

  shouldRun(ctx: AgentContext): boolean {
    return !!resolveChainPath(ctx.localPath, ctx.repoAlias);
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const chainPath = resolveChainPath(ctx.localPath, ctx.repoAlias);

    if (!chainPath) {
      return {
        agentId: 'cleanup', status: 'skipped', repo: ctx.repoAlias,
        duration: Date.now() - start, message: 'No chain config', artifacts: [],
      };
    }

    const config = JSON.parse(readFileSync(chainPath, 'utf-8')) as ChainConfig;
    const [owner, repo] = config.repo.split('/') as [string, string];
    const artifacts: string[] = [];

    const chainIssueNums = new Set(
      config.chain.map(e => e.issue).filter((n): n is number => n !== null && n !== undefined)
    );
    const specIssueNums = new Set(
      config.chain.map(e => e.specIssue).filter((n): n is number => n !== null && n !== undefined)
    );
    const allNums = new Set([...chainIssueNums, ...specIssueNums]);

    // Step 1: Close orphaned draft Copilot PRs
    let closedPRs = 0;
    const openPRs = await ctx.github.listPRs(owner, repo, 'open');
    for (const pr of openPRs) {
      if (!pr.draft || pr.user.login.toLowerCase() !== 'copilot') continue;
      const refsChain = pr.body && [...allNums].some(n => pr.body!.includes(`#${n}`));
      if (!refsChain) continue;

      ctx.logger.warn(`Closing orphan PR #${pr.number}`);
      if (!ctx.dryRun) {
        await ctx.github.closePR(owner, repo, pr.number);
        try { await ctx.github.deleteBranch(owner, repo, pr.head.ref); } catch { /* ok */ }
      }
      closedPRs++;
      artifacts.push(`closed-pr:#${pr.number}`);
    }

    // Step 2: Strip automation labels from ALL open chain issues
    let resetCount = 0;
    for (const issueNum of chainIssueNums) {
      try {
        const issue = await ctx.github.getIssue(owner, repo, issueNum);
        if (issue.state !== 'open') continue;

        const toRemove = issue.labels
          .map(l => l.name)
          .filter(name => LABELS_TO_REMOVE.includes(name));
        if (toRemove.length === 0) continue;

        ctx.logger.warn(`Stripping ${toRemove.length} labels from #${issueNum}`);
        if (!ctx.dryRun) {
          for (const label of toRemove) {
            await ctx.github.removeLabel(owner, repo, issueNum, label);
          }
        }
        resetCount++;
        artifacts.push(`reset:#${issueNum}`);
      } catch { /* issue may not exist */ }
    }

    // Step 3: Assign Copilot to first open chain issue
    let dispatched = '';
    const sorted = [...config.chain].sort((a, b) => a.position - b.position);
    for (const entry of sorted) {
      if (!entry.issue) continue;
      try {
        const issue = await ctx.github.getIssue(owner, repo, entry.issue);
        if (issue.state !== 'open') continue;

        ctx.logger.info(`Assigning Copilot to ${entry.prompt} (#${entry.issue})`);
        if (!ctx.dryRun) {
          await ctx.github.addLabels(owner, repo, entry.issue, ['automation:in-progress']);
          await ctx.github.assignCopilot(owner, repo, entry.issue);
        }
        dispatched = `#${entry.issue}`;
        artifacts.push(`assigned:${dispatched}`);
        break;
      } catch { /* skip */ }
    }

    return {
      agentId: 'cleanup',
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Cleanup: ${closedPRs} PRs closed, ${resetCount} issues reset, assigned ${dispatched || 'none'}`,
      artifacts,
    };
  },
};

export const cleanupAgents: Agent[] = [cleanupAgent];
