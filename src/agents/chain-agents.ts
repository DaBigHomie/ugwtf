/**
 * Chain Agents — Prompt Chain Lifecycle Management
 *
 * Three agents that manage the prompt-chain lifecycle:
 *   1. chain-config-loader   — Reads & validates prompt-chain.json
 *   2. chain-issue-creator   — Creates GitHub Issues from chain entries
 *   3. chain-advancer        — Finds next unresolved prompt, assigns Copilot
 */
import type { Agent, AgentContext, AgentResult } from '../types.js';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  type ChainEntry,
  type ChainConfig,
  resolveChainPath,
  validateChainConfig,
  severityToLabel,
  buildChainIssueBody,
} from './chain-types.js';

// ---------------------------------------------------------------------------
// Agent 1: Chain Config Loader
// ---------------------------------------------------------------------------

const chainConfigLoader: Agent = {
  id: 'chain-config-loader',
  name: 'Chain Config Loader',
  description: 'Reads and validates prompt-chain.json from target repo',
  clusterId: 'chain',

  shouldRun(ctx: AgentContext): boolean {
    return resolveChainPath(ctx.localPath) !== null;
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const chainPath = resolveChainPath(ctx.localPath);

    if (!chainPath) {
      return {
        agentId: 'chain-config-loader',
        status: 'skipped',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'No prompt-chain.json found',
        artifacts: [],
      };
    }

    ctx.logger.info(`Reading chain config: ${chainPath}`);

    let config: unknown;
    try {
      const raw = readFileSync(chainPath, 'utf-8');
      config = JSON.parse(raw);
    } catch (err) {
      return {
        agentId: 'chain-config-loader',
        status: 'failed',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Failed to parse chain config: ${err instanceof Error ? err.message : String(err)}`,
        artifacts: [],
      };
    }

    const errors = validateChainConfig(config);
    if (errors.length > 0) {
      ctx.logger.error(`Chain config validation failed with ${errors.length} error(s):`);
      for (const e of errors) ctx.logger.error(`  - ${e}`);

      return {
        agentId: 'chain-config-loader',
        status: 'failed',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Validation failed: ${errors.join('; ')}`,
        artifacts: [],
      };
    }

    const chain = config as ChainConfig;
    const total = chain.chain.length;
    const withIssues = chain.chain.filter(e => e.issue !== null).length;
    const waves = new Set(chain.chain.map(e => e.wave)).size;

    ctx.logger.success(`Chain config valid: ${total} prompts across ${waves} waves (${withIssues}/${total} have issues)`);

    return {
      agentId: 'chain-config-loader',
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Loaded ${total} prompts across ${waves} waves — ${withIssues}/${total} linked to issues`,
      artifacts: [chainPath],
    };
  },
};

const chainIssueCreator: Agent = {
  id: 'chain-issue-creator',
  name: 'Chain Issue Creator',
  description: 'Creates GitHub Issues for chain entries that lack issue numbers',
  clusterId: 'chain',

  shouldRun(ctx: AgentContext): boolean {
    const chainPath = resolveChainPath(ctx.localPath);
    if (!chainPath) return false;

    try {
      const config = JSON.parse(readFileSync(chainPath, 'utf-8')) as ChainConfig;
      return config.chain.some(e => e.issue === null);
    } catch {
      return false;
    }
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const chainPath = resolveChainPath(ctx.localPath);

    if (!chainPath) {
      return {
        agentId: 'chain-issue-creator',
        status: 'skipped',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'No chain config found',
        artifacts: [],
      };
    }

    const config = JSON.parse(readFileSync(chainPath, 'utf-8')) as ChainConfig;
    const parts = config.repo.split('/');
    const owner = parts[0]!;
    const repo = parts[1]!;
    const missing = config.chain.filter(e => e.issue === null);

    if (missing.length === 0) {
      ctx.logger.success('All chain entries already have issues');
      return {
        agentId: 'chain-issue-creator',
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'All entries already linked to issues',
        artifacts: [],
      };
    }

    ctx.logger.info(`Creating issues for ${missing.length} chain entries without issue numbers`);

    let created = 0;
    const errors: string[] = [];

    for (const entry of missing) {
      const chNum = String(entry.position).padStart(2, '0');
      const commitType = entry.type ?? 'feat';
      const scope = entry.scope ?? 'shop';
      const description = (entry.file.split('/').pop()?.replace('.prompt.md', '') ?? entry.prompt)
        .replace(/^\d+-/, '')               // strip leading number prefix "01-"
        .replace(/^P\d+[A-Z]?-/i, '')      // strip "P4A-" prefix
        .replace(/-/g, ' ');                // dashes to spaces
      const title = `${commitType}(${scope}): ${description} — chain ${entry.position}/${config.chain.length} [CH-${chNum}]`;
      const body = buildChainIssueBody(entry, config);
      const labels = [...config.labels, severityToLabel(entry.severity), 'chain-tracker', 'prompt-chain'];

      try {
        if (ctx.dryRun) {
          ctx.logger.info(`  [DRY RUN] Would create issue: "${title}"`);
          created++;
          continue;
        }

        const issue = await ctx.github.createIssue(owner, repo, { title, body, labels });

        // Update chain config with new issue number
        const idx = config.chain.findIndex(e => e.position === entry.position);
        if (idx !== -1) {
          config.chain[idx]!.issue = issue.number;
        }

        ctx.logger.success(`  Created #${issue.number}: ${entry.prompt} (pos ${entry.position})`);
        created++;
      } catch (err) {
        const msg = `Failed to create issue for ${entry.prompt}: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.error(`  ${msg}`);
        errors.push(msg);
      }
    }

    // Write back updated chain config with issue numbers
    if (!ctx.dryRun && created > 0) {
      writeFileSync(chainPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      ctx.logger.info(`Updated ${chainPath} with ${created} issue numbers`);
    }

    return {
      agentId: 'chain-issue-creator',
      status: errors.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Created ${created}/${missing.length} issues${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
      artifacts: ctx.dryRun ? [] : [chainPath],
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  },
};


// ---------------------------------------------------------------------------
// Agent 3: Chain Advancer
// ---------------------------------------------------------------------------

const chainAdvancer: Agent = {
  id: 'chain-advancer',
  name: 'Chain Advancer',
  description: 'Finds next unresolved chain entry and assigns Copilot to advance the chain',
  clusterId: 'chain',

  shouldRun(ctx: AgentContext): boolean {
    const chainPath = resolveChainPath(ctx.localPath);
    if (!chainPath) return false;

    try {
      const config = JSON.parse(readFileSync(chainPath, 'utf-8')) as ChainConfig;
      // Only run if there are entries with issues assigned
      return config.chain.some(e => e.issue !== null);
    } catch {
      return false;
    }
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const chainPath = resolveChainPath(ctx.localPath);

    if (!chainPath) {
      return {
        agentId: 'chain-advancer',
        status: 'skipped',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'No chain config found',
        artifacts: [],
      };
    }

    const config = JSON.parse(readFileSync(chainPath, 'utf-8')) as ChainConfig;
    const parts = config.repo.split('/');
    const owner = parts[0]!;
    const repo = parts[1]!;

    // Fetch all open issues to determine which chain entries are still open
    const openIssues = await ctx.github.listIssues(owner, repo, 'open', config.labels);
    const openIssueNumbers = new Set(openIssues.map(i => i.number));

    // SP↔CH cross-reference: if a CH issue is open but its specIssue is closed,
    // the work is done — auto-close the CH issue to unblock the chain.
    for (const entry of config.chain) {
      if (entry.issue && entry.specIssue && openIssueNumbers.has(entry.issue)) {
        try {
          const specIssue = await ctx.github.getIssue(owner, repo, entry.specIssue);
          if (specIssue.state === 'closed') {
            ctx.logger.warn(`CH #${entry.issue} open but SP #${entry.specIssue} closed — auto-closing CH issue`);
            if (!ctx.dryRun) {
              await ctx.github.addComment(owner, repo, entry.issue,
                `## Auto-Close — SP↔CH Bridge\n\nSpec issue #${entry.specIssue} is closed (work complete). ` +
                `Closing this chain-tracker issue to unblock chain advancement.\n\n` +
                `_Automated by UGWTF chain-advancer SP↔CH bridge_`
              );
              await ctx.github.closeIssue(owner, repo, entry.issue);
              await ctx.github.addLabels(owner, repo, entry.issue, ['automation:completed']);
              openIssueNumbers.delete(entry.issue);
            }
          }
        } catch {
          // specIssue may not exist or be inaccessible — skip
        }
      }
    }

    // Find the first chain entry whose issue is still open (next in sequence)
    const nextEntry = config.chain
      .sort((a, b) => a.position - b.position)
      .find(e => e.issue !== null && openIssueNumbers.has(e.issue));

    if (!nextEntry) {
      // Check if all entries have been resolved
      const withIssues = config.chain.filter(e => e.issue !== null);
      if (withIssues.length === config.chain.length) {
        ctx.logger.success('All chain entries resolved — chain complete!');
        return {
          agentId: 'chain-advancer',
          status: 'success',
          repo: ctx.repoAlias,
          duration: Date.now() - start,
          message: 'Chain complete — all entries resolved',
          artifacts: [],
        };
      }

      ctx.logger.info('No open chain issues found. Create issues first with chain-issue-creator.');
      return {
        agentId: 'chain-advancer',
        status: 'skipped',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'No open chain issues to advance',
        artifacts: [],
      };
    }

    // Check if dependencies are resolved
    const unresolvedDeps: string[] = [];
    for (const dep of nextEntry.depends) {
      const depEntry = config.chain.find(e => e.prompt === dep);
      if (depEntry?.issue && openIssueNumbers.has(depEntry.issue)) {
        unresolvedDeps.push(`${dep} (#${depEntry.issue})`);
      }
    }

    if (unresolvedDeps.length > 0) {
      ctx.logger.warn(`Next entry ${nextEntry.prompt} (#${nextEntry.issue}) has unresolved deps: ${unresolvedDeps.join(', ')}`);
      return {
        agentId: 'chain-advancer',
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Waiting on deps for ${nextEntry.prompt}: ${unresolvedDeps.join(', ')}`,
        artifacts: [],
      };
    }

    // Fix 2: Issue-level rate limiting — check active Copilot assignments
    const maxConcurrency = parseInt(ctx.extras?.['maxCopilotConcurrency'] ?? '1', 10);
    const inProgress = await ctx.github.listIssues(owner, repo, 'open', ['automation:in-progress']);
    if (inProgress.length >= maxConcurrency) {
      ctx.logger.warn(`Rate limited: ${inProgress.length}/${maxConcurrency} issues already in-progress`);
      return {
        agentId: 'chain-advancer',
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Rate limited — ${inProgress.length} in-progress (max ${maxConcurrency}). Next: ${nextEntry.prompt} (#${nextEntry.issue})`,
        artifacts: [],
      };
    }

    // Fix 4: PR quality gate — if previous chain entry has a PR, verify it has real changes
    const prevEntries = config.chain
      .filter(e => e.position < nextEntry.position && e.issue !== null && !openIssueNumbers.has(e.issue));
    if (prevEntries.length > 0) {
      const lastCompleted = prevEntries.sort((a, b) => b.position - a.position)[0]!;
      const prs = await ctx.github.listPRs(owner, repo, 'all');
      const linkedPR = prs.find(pr =>
        pr.body?.includes(`#${lastCompleted.issue}`) ||
        pr.body?.includes(`Fixes #${lastCompleted.issue}`) ||
        pr.body?.includes(`Closes #${lastCompleted.issue}`)
      );
      if (linkedPR) {
        const files = await ctx.github.getPRFiles(owner, repo, linkedPR.number);
        const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
        const nonLockFiles = files.filter(f => !f.filename.endsWith('lock.json') && !f.filename.endsWith('.lock'));
        if (nonLockFiles.length === 0 || totalAdditions < 10) {
          ctx.logger.warn(`PR #${linkedPR.number} for previous entry ${lastCompleted.prompt} appears empty (${nonLockFiles.length} files, ${totalAdditions} additions)`);
          return {
            agentId: 'chain-advancer',
            status: 'failed',
            repo: ctx.repoAlias,
            duration: Date.now() - start,
            message: `Quality gate: PR #${linkedPR.number} (${lastCompleted.prompt}) has insufficient changes — ${nonLockFiles.length} files, ${totalAdditions} additions`,
            artifacts: [`EMPTY_PR: #${linkedPR.number}`],
          };
        }
      }
    }

    // Assign Copilot to the next entry
    ctx.logger.info(`Advancing chain: assigning Copilot to ${nextEntry.prompt} (#${nextEntry.issue})`);

    if (ctx.dryRun) {
      ctx.logger.info(`[DRY RUN] Would assign Copilot to #${nextEntry.issue}`);
      return {
        agentId: 'chain-advancer',
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `[DRY RUN] Would advance to ${nextEntry.prompt} (#${nextEntry.issue})`,
        artifacts: [],
      };
    }

    try {
      // Post context comment
      const contextComment = [
        `## Chain Advancement — Position ${nextEntry.position}/${config.chain.length}`,
        '',
        `**Prompt**: \`${nextEntry.prompt}\``,
        `**File**: \`${nextEntry.file}\``,
        `**Wave**: ${nextEntry.wave} | **Severity**: ${nextEntry.severity}`,
        '',
        'This issue is the next in the prompt chain. Please read the prompt file and implement the changes.',
        '',
        '_Automated by UGWTF chain-advancer agent_',
      ].join('\n');

      await ctx.github.addComment(owner, repo, nextEntry.issue!, contextComment);
      await ctx.github.addLabels(owner, repo, nextEntry.issue!, ['automation:in-progress', 'copilot:ready']);

      // Dispatch chain-next event to copilot-full-automation.yml Phase 1
      // GHA can assign Copilot reliably (REST API from external CLI cannot)
      await ctx.github.dispatchWorkflow(owner, repo, 'chain-next', {
        issue_number: nextEntry.issue!,
      });
      ctx.logger.success(`Dispatched chain-next for ${nextEntry.prompt} (#${nextEntry.issue})`);

      return {
        agentId: 'chain-advancer',
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Advanced to position ${nextEntry.position}: ${nextEntry.prompt} (#${nextEntry.issue}) — dispatched to GHA`,
        artifacts: [],
      };
    } catch (err) {
      return {
        agentId: 'chain-advancer',
        status: 'failed',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Failed to advance chain: ${err instanceof Error ? err.message : String(err)}`,
        artifacts: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Agent 4: Chain Reset — closes orphaned PRs, resets stalled CH issues
// ---------------------------------------------------------------------------

const chainReset: Agent = {
  id: 'chain-reset',
  name: 'Chain Reset',
  description: 'Closes orphaned PRs created from wrong issues, resets stalled CH labels, unblocks chain',
  clusterId: 'chain',

  shouldRun(ctx: AgentContext): boolean {
    return ctx.extras?.['reset'] === 'true';
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const chainPath = resolveChainPath(ctx.localPath);

    if (!chainPath) {
      return {
        agentId: 'chain-reset', status: 'skipped', repo: ctx.repoAlias,
        duration: Date.now() - start, message: 'No chain config found', artifacts: [],
      };
    }

    const config = JSON.parse(readFileSync(chainPath, 'utf-8')) as ChainConfig;
    const [owner, repo] = config.repo.split('/') as [string, string];
    const artifacts: string[] = [];

    const openPRs = await ctx.github.listPRs(owner, repo, 'open');
    const chainIssueNumbers = new Set(config.chain.map(e => e.issue).filter(Boolean) as number[]);
    const specIssueNumbers = new Set(config.chain.map(e => e.specIssue).filter(Boolean) as number[]);
    const allChainNumbers = new Set([...chainIssueNumbers, ...specIssueNumbers]);

    // 1. Close orphaned Copilot draft PRs that reference any chain issue
    let closedPRs = 0;
    for (const pr of openPRs) {
      if (!pr.draft || pr.user.login.toLowerCase() !== 'copilot') continue;
      if (!pr.body) continue;

      const refsChainIssue = [...allChainNumbers].some(n =>
        pr.body!.includes(`#${n}`)
      );
      if (!refsChainIssue) continue;

      ctx.logger.warn(`Closing orphaned draft PR #${pr.number}: ${pr.title}`);
      if (!ctx.dryRun) {
        await ctx.github.addComment(owner, repo, pr.number,
          `## Chain Reset — Closing Orphaned PR\n\n` +
          `This PR was created outside the UGWTF chain pipeline.\n` +
          `Work will be re-created when chain-advancer assigns Copilot to the correct CH issue.\n\n` +
          `_Automated by UGWTF chain-reset agent_`
        );
        await ctx.github.closePR(owner, repo, pr.number);
        try { await ctx.github.deleteBranch(owner, repo, pr.head.ref); } catch { /* ok */ }
      }
      closedPRs++;
      artifacts.push(`CLOSED_PR: #${pr.number}`);
    }

    // 2. Reset ALL in-progress chain CH issues (remove blocking labels)
    let resetIssues = 0;
    for (const entry of config.chain) {
      if (!entry.issue || !chainIssueNumbers.has(entry.issue)) continue;

      try {
        const issue = await ctx.github.getIssue(owner, repo, entry.issue);
        if (issue.state !== 'open') continue;

        const hasInProgress = issue.labels.some(l => l.name === 'automation:in-progress');
        if (!hasInProgress) continue;

        ctx.logger.warn(`Resetting CH #${entry.issue} (${entry.prompt})`);
        if (!ctx.dryRun) {
          await ctx.github.removeLabel(owner, repo, entry.issue, 'automation:in-progress');
          await ctx.github.removeLabel(owner, repo, entry.issue, 'stalled');
          await ctx.github.removeLabel(owner, repo, entry.issue, 'needs-pr');
          await ctx.github.removeLabel(owner, repo, entry.issue, 'needs-review');
          await ctx.github.addComment(owner, repo, entry.issue,
            `## Chain Reset\n\nLabels cleared. Re-queued for chain-advancer assignment.\n\n` +
            `_Automated by UGWTF chain-reset agent_`
          );
        }
        resetIssues++;
        artifacts.push(`RESET: #${entry.issue} (${entry.prompt})`);
      } catch { /* issue may not exist */ }
    }

    return {
      agentId: 'chain-reset',
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Reset: ${closedPRs} orphaned PRs closed, ${resetIssues} CH issues unblocked`,
      artifacts,
    };
  },
};

export const chainAgents: Agent[] = [
  chainConfigLoader,
  chainIssueCreator,
  chainAdvancer,
  chainReset,
];
