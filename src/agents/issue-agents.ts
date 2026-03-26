/**
 * Issue Management Agents
 *
 * Real execution: creates issues, assigns Copilot, manages triage via GitHub API.
 */
import type { Agent, AgentResult } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { resolveChainPath, type ChainConfig, type ChainEntry } from './chain-types.js';
import { readFileSync } from 'node:fs';

function parseSlug(slug: string): { owner: string; repo: string } {
  const parts = slug.split('/');
  return { owner: parts[0]!, repo: parts[1]! };
}

const stalledIssueDetector: Agent = {
  id: 'issue-stalled-detector',
  name: 'Stalled Issue Detector',
  description: 'Find issues labeled automation:in-progress with no PR activity >48h',
  clusterId: 'issues',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);
    const issues = await ctx.github.listIssues(owner, repo, 'open', ['automation:in-progress']);
    const prs = await ctx.github.listPRs(owner, repo, 'open');

    const stalled: number[] = [];

    // Load chain config to check specIssue cross-references
    let chainEntries: ChainEntry[] = [];
    if (ctx.localPath) {
      const chainPath = resolveChainPath(ctx.localPath);
      if (chainPath) {
        try {
          const config = JSON.parse(readFileSync(chainPath, 'utf-8')) as ChainConfig;
          chainEntries = config.chain;
        } catch { /* no chain config — skip cross-ref */ }
      }
    }

    for (const issue of issues) {
      // Check if there's a PR linked to this issue (direct or via specIssue)
      let linkedPR = prs.find(pr =>
        pr.body?.includes(`#${issue.number}`) ?? false
      );

      // SP↔CH bridge: if no direct PR link, check if the specIssue has a linked PR
      if (!linkedPR) {
        const chainEntry = chainEntries.find(e => e.issue === issue.number);
        if (chainEntry?.specIssue) {
          linkedPR = prs.find(pr =>
            pr.body?.includes(`#${chainEntry.specIssue}`) ?? false
          );
          if (linkedPR) {
            ctx.logger.info(`CH #${issue.number} linked via SP #${chainEntry.specIssue} → PR #${linkedPR.number}`);
          }
        }
      }

      if (!linkedPR) {
        stalled.push(issue.number);
        if (!ctx.dryRun) {
          await ctx.github.addLabels(owner, repo, issue.number, ['stalled', 'needs-pr']);
          await ctx.github.addComment(owner, repo, issue.number,
            `**Stalled Issue Detected**\n\nThis issue is labeled \`automation:in-progress\` but has no linked PR.\nRe-assigning Copilot or escalating for manual intervention.\n\n*Detected by UGWTF Issue Management Agent*`
          );
        }
        ctx.logger.warn(`Issue #${issue.number} stalled — no linked PR`);
      }
    }

    return {
      agentId: this.id,
      status: stalled.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Stalled: ${stalled.length} of ${issues.length} in-progress issues`,
      artifacts: stalled.map(n => `STALLED: #${n}`),
    };
  },
};

const copilotAssignmentAgent: Agent = {
  id: 'issue-copilot-assign',
  name: 'Copilot Assignment Agent',
  description: 'Find issues labeled agent:copilot without Copilot assigned, and assign them',
  clusterId: 'issues',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);

    // Fix 2: Issue-level rate limiting — check how many are already in-progress
    const maxConcurrency = parseInt(ctx.extras?.['maxCopilotConcurrency'] ?? '1', 10);
    const inProgressIssues = await ctx.github.listIssues(owner, repo, 'open', ['automation:in-progress']);
    if (inProgressIssues.length >= maxConcurrency) {
      ctx.logger.warn(`Rate limited: ${inProgressIssues.length}/${maxConcurrency} Copilot issues already in-progress`);
      return {
        agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start,
        message: `Rate limited — ${inProgressIssues.length} in-progress (max ${maxConcurrency})`,
        artifacts: inProgressIssues.map(i => `IN-PROGRESS: #${i.number}`),
      };
    }

    const issues = await ctx.github.listIssues(owner, repo, 'open', ['agent:copilot']);

    let assigned = 0;
    const errors: string[] = [];
    const slotsAvailable = maxConcurrency - inProgressIssues.length;

    for (const issue of issues) {
      if (assigned >= slotsAvailable) {
        ctx.logger.info(`Rate limit reached — assigned ${assigned}, stopping`);
        break;
      }

      const hasCopilot = issue.assignees.some(a => a.login.toLowerCase() === 'copilot');
      if (hasCopilot) continue;

      // Skip if already has automation:in-progress label
      if (issue.labels.some(l => l.name === 'automation:in-progress')) continue;

      if (ctx.dryRun) {
        ctx.logger.info(`[DRY RUN] Would assign Copilot to #${issue.number}`);
        assigned++;
        continue;
      }

      try {
        // Fix 1: Use assignCopilot (forces fetch transport)
        await ctx.github.assignCopilot(owner, repo, issue.number);
        await ctx.github.addLabels(owner, repo, issue.number, ['automation:in-progress']);

        // Fix 3: Verify assignment took effect
        const updated = await ctx.github.getIssue(owner, repo, issue.number);
        const verified = updated.assignees.some(a => a.login.toLowerCase() === 'copilot');
        if (!verified) {
          ctx.logger.error(`Assignment verification FAILED for #${issue.number} — Copilot not in assignees`);
          errors.push(`#${issue.number}: Assignment verification failed`);
          continue;
        }

        assigned++;
        ctx.logger.success(`Assigned + verified Copilot on #${issue.number}: ${issue.title}`);
      } catch (err) {
        errors.push(`#${issue.number}: ${err}`);
        ctx.logger.error(`Failed to assign #${issue.number}: ${err}`);
      }
    }

    return {
      agentId: this.id,
      status: errors.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Assigned: ${assigned}, Errors: ${errors.length}`,
      artifacts: errors,
    };
  },
};

const issueTriageAgent: Agent = {
  id: 'issue-triage',
  name: 'Issue Triage Agent',
  description: 'Auto-label unlabeled issues based on title/body keywords',
  clusterId: 'issues',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);
    const issues = await ctx.github.listIssues(owner, repo);

    // Keyword → label mapping
    const rules: Array<{ pattern: RegExp; labels: string[] }> = [
      { pattern: /\b(supabase|migration|database|schema|sql)\b/i, labels: ['database'] },
      { pattern: /\b(security|vulnerability|cve|audit)\b/i, labels: ['security'] },
      { pattern: /\b(bug|broken|crash|error|fix)\b/i, labels: ['bug'] },
      { pattern: /\b(feature|enhancement|add|new|implement)\b/i, labels: ['enhancement'] },
      { pattern: /\b(doc|readme|documentation|guide|instructions)\b/i, labels: ['documentation'] },
      { pattern: /\b(deps?|dependency|dependencies|upgrade|update)\b/i, labels: ['dependencies'] },
      { pattern: /\b(ci|cd|workflow|deploy|infra)\b/i, labels: ['infrastructure'] },
    ];

    let triaged = 0;

    for (const issue of issues) {
      // Skip already-labeled issues (more than default labels)
      const hasCustomLabels = issue.labels.some(l =>
        !['good first issue', 'help wanted'].includes(l.name)
      );
      if (hasCustomLabels) continue;

      const text = `${issue.title} ${issue.body ?? ''}`;
      const labelsToAdd = new Set<string>();

      for (const rule of rules) {
        if (rule.pattern.test(text)) {
          for (const label of rule.labels) labelsToAdd.add(label);
        }
      }

      if (labelsToAdd.size > 0) {
        if (!ctx.dryRun) {
          await ctx.github.addLabels(owner, repo, issue.number, [...labelsToAdd]);
        }
        triaged++;
        ctx.logger.success(`#${issue.number}: +${[...labelsToAdd].join(', ')}`);
      }
    }

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Triaged: ${triaged} of ${issues.length} issues`,
      artifacts: [],
    };
  },
};

export const issueAgents: Agent[] = [stalledIssueDetector, copilotAssignmentAgent, issueTriageAgent];
