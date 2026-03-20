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
import { join, basename, relative } from 'node:path';
import { scanAllPrompts, validatePrompt, type ParsedPrompt } from '../prompt/index.js';
import { writeFile } from '../utils/fs.js';
import { getRepo } from '../config/repo-registry.js';

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
      // Fix 1: Use assignCopilot (forces fetch transport instead of gh CLI)
      await ctx.github.assignCopilot(owner, repo, nextEntry.issue!);
      await ctx.github.addLabels(owner, repo, nextEntry.issue!, ['automation:in-progress']);

      // Fix 3: Verify assignment took effect
      const updatedIssue = await ctx.github.getIssue(owner, repo, nextEntry.issue!);
      const verified = updatedIssue.assignees.some(a => a.login === 'copilot');
      if (!verified) {
        ctx.logger.error(`Assignment verification FAILED for #${nextEntry.issue} — Copilot not in assignees`);
        return {
          agentId: 'chain-advancer',
          status: 'failed',
          repo: ctx.repoAlias,
          duration: Date.now() - start,
          message: `Copilot assignment verified=false for #${nextEntry.issue}. REST API may have silently failed.`,
          artifacts: [`UNVERIFIED: #${nextEntry.issue}`],
        };
      }

      ctx.logger.success(`Advanced + verified chain to ${nextEntry.prompt} (#${nextEntry.issue})`);

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
// Agent 4: Chain Generator
// ---------------------------------------------------------------------------

/**
 * Derive a short prompt ID from a filename.
 * e.g. "01-supabase-client-setup.prompt.md" → "FI-01"
 * Falls back to numeric prefix or sequential index.
 */
function derivePromptId(fileName: string, index: number): string {
  const numMatch = fileName.match(/^(\d+)/);
  const num = numMatch ? numMatch[1]!.padStart(2, '0') : String(index + 1).padStart(2, '0');
  return `FI-${num}`;
}

/**
 * Map priority string to chain severity.
 */
function priorityToSeverity(priority: string | null): ChainEntry['severity'] {
  if (!priority) return 'medium';
  const n = parseInt(priority.replace(/^P/i, ''));
  if (n <= 0) return 'critical';
  if (n === 1) return 'high';
  if (n === 2) return 'medium';
  return 'low';
}

/**
 * Resolve dependency references to prompt IDs.
 * Handles: #N gap numbers (mapped by position), FI-XX IDs, filename refs.
 */
function resolveDeps(
  deps: string[],
  promptMap: Map<string, string>,     // fileName (no ext) → promptId
  gapToId: Map<string, string>,       // "#N" → promptId  (gap number = file prefix number)
): string[] {
  const resolved = new Set<string>();
  const unresolved: string[] = [];
  const knownIds = new Set(promptMap.values());

  for (const dep of deps) {
    let matched = false;

    // Direct prompt ID (FI-01 style)
    if (/^[A-Z]+-\d+$/.test(dep)) {
      if (knownIds.has(dep)) {
        resolved.add(dep);
        matched = true;
      }
    }

    // Gap number (#20 → look up which prompt has prefix 20)
    if (!matched && dep.startsWith('#')) {
      const id = gapToId.get(dep);
      if (id) {
        resolved.add(id);
        matched = true;
      }
    }

    // Filename ref (01-supabase-client-setup)
    if (!matched) {
      const id = promptMap.get(dep);
      if (id) {
        resolved.add(id);
        matched = true;
      }
    }

    if (!matched) {
      unresolved.push(dep);
    }
  }

  if (unresolved.length > 0) {
    console.warn(
      `[chain-agents] Dependency references could not be resolved and were skipped. Please verify dependency references: ${unresolved.join(', ')}`,
    );
  }

  return [...resolved];
}

/**
 * Kahn's algorithm: topological sort with cycle detection.
 * Returns sorted prompt IDs and computed wave assignments.
 */
function toposort(
  ids: string[],
  depGraph: Map<string, string[]>,
): { sorted: string[]; waves: Map<string, number> } {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();  // dep → dependents

  for (const id of ids) {
    inDegree.set(id, 0);
    adjList.set(id, []);
  }

  for (const id of ids) {
    const deps = depGraph.get(id) ?? [];
    inDegree.set(id, deps.length);
    for (const dep of deps) {
      adjList.get(dep)?.push(id);
    }
  }

  // BFS
  const queue: string[] = [];
  const waves = new Map<string, number>();

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      waves.set(id, 1);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    const currentWave = waves.get(current)!;

    for (const dependent of adjList.get(current) ?? []) {
      const newDeg = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, newDeg);

      // Wave = max(wave of all deps) + 1
      const existingWave = waves.get(dependent) ?? 0;
      waves.set(dependent, Math.max(existingWave, currentWave + 1));

      if (newDeg === 0) {
        queue.push(dependent);
      }
    }
  }

  if (sorted.length !== ids.length) {
    const missing = ids.filter(id => !sorted.includes(id));
    throw new Error(`Cycle detected in dependency graph! Involved prompts: ${missing.join(', ')}`);
  }

  return { sorted, waves };
}

const chainGenerator: Agent = {
  id: 'chain-generator',
  name: 'Chain Generator',
  description: 'Scan prompts, parse dependencies, toposort, and generate prompt-chain.json',
  clusterId: 'generate-chain',
  shouldRun() { return true; },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'Repo not found', artifacts: [] };
    }

    const localPath = ctx.localPath;
    ctx.logger.group(`Generating chain config for ${ctx.repoAlias}`);

    // 1. Scan all prompts (optionally scoped by --path)
    const allPrompts = await scanAllPrompts(localPath);
    let prompts = allPrompts;

    if (ctx.extras.path) {
      const target = join(localPath, ctx.extras.path);
      // Support both folder and single-file --path
      if (target.endsWith('.prompt.md') || target.endsWith('.md')) {
        prompts = allPrompts.filter(p => p.filePath === target);
      } else {
        prompts = allPrompts.filter(p => p.filePath.startsWith(target));
      }
      if (prompts.length === 0) {
        ctx.logger.warn(`No prompts found in --path ${ctx.extras.path} (${allPrompts.length} total in repo)`);
        ctx.logger.groupEnd();
        return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: `No prompts in ${ctx.extras.path}`, artifacts: [] };
      }
      ctx.logger.info(`Scoped to ${prompts.length} prompts from --path ${ctx.extras.path} (${allPrompts.length} total in repo)`);
    } else if (allPrompts.length === 0) {
      ctx.logger.warn('No prompts found — cannot generate chain');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No prompts found', artifacts: [] };
    } else {
      ctx.logger.info(`Found ${allPrompts.length} prompts to chain`);
    }

    // 1b. Quality scoring — warn on low-scoring prompts
    const scores = prompts.map(p => validatePrompt(p));
    const avgScore = Math.round(scores.reduce((s, r) => s + r.percent, 0) / scores.length);
    const lowScoring = scores.filter(r => r.percent < 50);

    ctx.logger.info(`Prompt quality: avg ${avgScore}% (${lowScoring.length} below 50%)`);
    for (const r of lowScoring) {
      ctx.logger.warn(`  Low score: ${r.percent}% — ${r.prompt.fileName}`);
    }

    // 2. Sort prompts by filename for stable ordering
    const sorted = [...prompts].sort((a, b) => a.fileName.localeCompare(b.fileName));

    // 3. Build ID maps
    const promptMap = new Map<string, string>();   // fileName stem → prompt ID
    const gapToId = new Map<string, string>();     // "#N" → prompt ID (gap number = file prefix)
    const idToPrompt = new Map<string, ParsedPrompt>();

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]!;
      const id = derivePromptId(p.fileName, i);
      const stem = basename(p.fileName, '.prompt.md');
      promptMap.set(stem, id);
      idToPrompt.set(id, p);

      // Map gap numbers: file prefix "01" → "#1", "02" → "#2", etc.
      const numMatch = stem.match(/^(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1]!, 10);
        gapToId.set(`#${num}`, id);
      }
    }

    // 4. Resolve dependencies
    const depGraph = new Map<string, string[]>();
    const ids: string[] = [];

    for (const [id, p] of idToPrompt) {
      ids.push(id);
      const resolved = resolveDeps(p.depends, promptMap, gapToId);
      depGraph.set(id, resolved);
    }

    // 5. Toposort + wave assignment
    let topoResult: { sorted: string[]; waves: Map<string, number> };
    try {
      topoResult = toposort(ids, depGraph);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error(msg);
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: Date.now() - start, message: msg, artifacts: [] };
    }

    // 6. Build chain entries
    const chainEntries: ChainEntry[] = topoResult.sorted.map((id, i) => {
      const p = idToPrompt.get(id)!;
      const deps = depGraph.get(id) ?? [];
      return {
        position: i + 1,
        prompt: id,
        file: relative(localPath, p.filePath),
        wave: topoResult.waves.get(id) ?? 1,
        severity: priorityToSeverity(p.priority),
        depends: deps,
        issue: null,
      };
    });

    const totalWaves = new Set(chainEntries.map(e => e.wave)).size;

    // 7. Build config
    const config: ChainConfig = {
      version: 3,
      description: `Auto-generated chain for ${ctx.repoAlias} — ${chainEntries.length} prompts across ${totalWaves} waves`,
      repo: repoConfig.slug,
      labels: ['automation:copilot', 'agent:copilot', 'enhancement'],
      chain: chainEntries,
    };

    // 8. Write to scripts/prompt-chain.json
    const outputPath = join(localPath, 'scripts', CHAIN_CONFIG_FILENAME);

    if (ctx.dryRun) {
      ctx.logger.info('[DRY RUN] Would write chain config:');
      ctx.logger.info(`  Path: ${outputPath}`);
      ctx.logger.info(`  Entries: ${chainEntries.length}`);
      ctx.logger.info(`  Waves: ${totalWaves}`);
      for (const e of chainEntries) {
        const deps = e.depends.length > 0 ? ` → depends: [${e.depends.join(', ')}]` : '';
        ctx.logger.info(`  ${e.position}. ${e.prompt} (wave ${e.wave}, ${e.severity})${deps}`);
      }
      ctx.logger.groupEnd();
      return {
        agentId: this.id,
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `[DRY RUN] Would generate ${chainEntries.length} entries across ${totalWaves} waves`,
        artifacts: [],
      };
    }

    // Check if existing config has issues assigned (safety check)
    if (existsSync(outputPath)) {
      try {
        const existing = JSON.parse(readFileSync(outputPath, 'utf-8')) as ChainConfig;
        const hasIssues = existing.chain?.some(e => e.issue !== null);
        if (hasIssues) {
          ctx.logger.warn('Existing chain config has issues assigned — overwriting (old issues preserved in GitHub)');
        }
      } catch {
        // Existing file is malformed, overwrite is fine
      }
    }

    const result = writeFile(outputPath, JSON.stringify(config, null, 2) + '\n');
    ctx.logger.success(`${result.action === 'created' ? 'Created' : 'Updated'} ${outputPath}`);

    // Print summary
    ctx.logger.info('');
    ctx.logger.info(`Chain: ${chainEntries.length} prompts across ${totalWaves} waves`);
    for (const e of chainEntries) {
      const deps = e.depends.length > 0 ? ` → [${e.depends.join(', ')}]` : '';
      ctx.logger.info(`  ${e.position}. ${e.prompt} (W${e.wave} ${e.severity})${deps}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Generated ${chainEntries.length} entries across ${totalWaves} waves → ${outputPath}`,
      artifacts: [outputPath],
    };
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

export const chainGeneratorAgents: Agent[] = [
  chainGenerator,
];
