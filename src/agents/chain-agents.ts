/**
 * Chain Agents — Prompt Chain Management
 *
 * Three agents that manage the prompt-chain lifecycle:
 *   1. chain-config-loader   — Reads & validates prompt-chain.json from repo
 *   2. chain-issue-creator   — Creates GitHub Issues from chain entries
 *   3. chain-advancer        — Finds next unresolved prompt, assigns Copilot
 */
import type { Agent, AgentContext, AgentResult } from '../types.js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Chain Schema Types
// ---------------------------------------------------------------------------

interface ChainEntry {
  position: number;
  prompt: string;
  file: string;
  wave: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  depends: string[];
  issue: number | null;
}

interface ChainConfig {
  version: number;
  description: string;
  repo: string;
  labels: string[];
  chain: ChainEntry[];
}

// ---------------------------------------------------------------------------
// Chain Config Path Convention
// ---------------------------------------------------------------------------

const CHAIN_CONFIG_FILENAME = 'prompt-chain.json';

/**
 * Resolve the chain config path for a repo.
 * Looks in: scripts/prompt-chain.json (default)
 */
function resolveChainPath(localPath: string): string | null {
  const candidates = [
    join(localPath, 'scripts', CHAIN_CONFIG_FILENAME),
    join(localPath, CHAIN_CONFIG_FILENAME),
    join(localPath, '.github', CHAIN_CONFIG_FILENAME),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Validate chain config structure.
 * Returns list of validation errors (empty = valid).
 */
function validateChainConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return ['Chain config is not a valid object'];
  }

  const c = config as Record<string, unknown>;

  if (typeof c.version !== 'number') errors.push('Missing or invalid "version" (must be number)');
  if (typeof c.repo !== 'string') errors.push('Missing or invalid "repo" (must be string)');
  if (!Array.isArray(c.labels)) errors.push('Missing or invalid "labels" (must be array)');
  if (!Array.isArray(c.chain)) {
    errors.push('Missing or invalid "chain" (must be array)');
    return errors;
  }

  const positions = new Set<number>();
  const prompts = new Set<string>();

  for (let i = 0; i < (c.chain as unknown[]).length; i++) {
    const entry = (c.chain as unknown[])[i] as Record<string, unknown>;
    const prefix = `chain[${i}]`;

    if (typeof entry.position !== 'number') errors.push(`${prefix}: missing position`);
    if (typeof entry.prompt !== 'string') errors.push(`${prefix}: missing prompt ID`);
    if (typeof entry.file !== 'string') errors.push(`${prefix}: missing file path`);
    if (typeof entry.wave !== 'number') errors.push(`${prefix}: missing wave`);

    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (!validSeverities.includes(entry.severity as string)) {
      errors.push(`${prefix}: invalid severity "${String(entry.severity)}"`);
    }

    if (!Array.isArray(entry.depends)) errors.push(`${prefix}: depends must be array`);

    if (typeof entry.position === 'number') {
      if (positions.has(entry.position)) errors.push(`${prefix}: duplicate position ${entry.position}`);
      positions.add(entry.position);
    }
    if (typeof entry.prompt === 'string') {
      if (prompts.has(entry.prompt)) errors.push(`${prefix}: duplicate prompt "${entry.prompt}"`);
      prompts.add(entry.prompt);
    }
  }

  // Validate dependency references
  for (const entry of c.chain as Array<Record<string, unknown>>) {
    if (Array.isArray(entry.depends)) {
      for (const dep of entry.depends as string[]) {
        if (!prompts.has(dep)) {
          errors.push(`${String(entry.prompt)}: depends on unknown prompt "${dep}"`);
        }
      }
    }
  }

  return errors;
}

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

// ---------------------------------------------------------------------------
// Agent 2: Chain Issue Creator
// ---------------------------------------------------------------------------

/**
 * Severity → priority label mapping
 */
function severityToLabel(severity: string): string {
  switch (severity) {
    case 'critical': return 'priority:p0';
    case 'high':     return 'priority:p1';
    case 'medium':   return 'priority:p2';
    case 'low':      return 'priority:p3';
    default:         return 'priority:p2';
  }
}

/**
 * Build issue body from chain entry
 */
function buildChainIssueBody(entry: ChainEntry, config: ChainConfig): string {
  const deps = entry.depends.length > 0
    ? entry.depends.map(d => {
        const depEntry = config.chain.find(e => e.prompt === d);
        return depEntry?.issue ? `- #${depEntry.issue} (${d})` : `- ${d} (no issue yet)`;
      }).join('\n')
    : '_None_';

  return [
    `## Prompt Chain — Position ${entry.position} / ${config.chain.length}`,
    '',
    `**Prompt**: \`${entry.prompt}\``,
    `**File**: \`${entry.file}\``,
    `**Wave**: ${entry.wave} | **Severity**: ${entry.severity}`,
    '',
    '### Dependencies',
    deps,
    '',
    '### Instructions',
    `Read the prompt file at \`${entry.file}\` and implement all changes described.`,
    '',
    '### Chain Context',
    `This is position ${entry.position} of ${config.chain.length} in the prompt chain.`,
    entry.position < config.chain.length
      ? `After this is complete, the next prompt in the chain will be activated.`
      : `This is the **final** prompt in the chain.`,
    '',
    '---',
    `_Auto-generated by UGWTF chain agent v2.0_`,
  ].join('\n');
}

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
      const title = `[Chain ${entry.position}/${config.chain.length}] ${entry.prompt}: ${entry.file.split('/').pop()?.replace('.prompt.md', '') ?? entry.prompt}`;
      const body = buildChainIssueBody(entry, config);
      const labels = [...config.labels, severityToLabel(entry.severity)];

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
      await ctx.github.assignIssue(owner, repo, nextEntry.issue!, ['copilot']);
      await ctx.github.addLabels(owner, repo, nextEntry.issue!, ['automation:in-progress']);

      ctx.logger.success(`Advanced chain to ${nextEntry.prompt} (#${nextEntry.issue})`);

      return {
        agentId: 'chain-advancer',
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Advanced to position ${nextEntry.position}: ${nextEntry.prompt} (#${nextEntry.issue})`,
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
// Export
// ---------------------------------------------------------------------------

export const chainAgents: Agent[] = [
  chainConfigLoader,
  chainIssueCreator,
  chainAdvancer,
];
