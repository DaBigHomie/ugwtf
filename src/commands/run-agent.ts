/**
 * `ugwtf run <agent-id>` — Execute a single agent against repos.
 *
 * Usage:
 *   ugwtf run <agent-id> [repos...] [--dry-run] [--verbose]
 *
 * Example:
 *   ugwtf run label-sync damieus ffs
 *   ugwtf run quality-check --dry-run
 */
import { CLUSTERS } from '../clusters/index.js';
import { getRepo, allAliases } from '../config/repo-registry.js';
import { createGitHubClient } from '../clients/github.js';
import { createLogger } from '../utils/logger.js';
import type { Agent, AgentContext } from '../types.js';

export interface RunAgentOptions {
  agentId: string;
  repos: string[];
  dryRun: boolean;
  verbose: boolean;
}

/** Parse sub-arguments for the run command. */
export function parseRunAgentArgs(args: string[]): RunAgentOptions | null {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
  Usage: ugwtf run <agent-id> [repos...] [--dry-run] [--verbose]

  Execute a single agent against one or more repos.
  If no repos are specified, runs against all repos.

  Example:
    ugwtf run label-sync damieus ffs
    ugwtf run quality-check --dry-run --verbose
`);
    return null;
  }

  const agentId = args[0]!;
  const repos: string[] = [];
  let dryRun = false;
  let verbose = false;
  const knownAliases = new Set(allAliases());

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--verbose' || arg === '-v') verbose = true;
    else if (arg && knownAliases.has(arg)) repos.push(arg);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return { agentId, repos, dryRun, verbose };
}

/** Find an agent by ID across all clusters. */
export function findAgent(agentId: string): Agent | undefined {
  for (const cluster of CLUSTERS) {
    const agent = cluster.agents.find(a => a.id === agentId);
    if (agent) return agent;
  }
  return undefined;
}

/** Execute a single agent against repos. */
export async function runAgentCommand(options: RunAgentOptions): Promise<void> {
  const agent = findAgent(options.agentId);
  if (!agent) {
    const allIds = CLUSTERS.flatMap(c => c.agents.map(a => a.id));
    console.error(`Agent not found: ${options.agentId}`);
    console.error(`Available agents (${allIds.length}): ${allIds.slice(0, 10).join(', ')}...`);
    process.exit(1);
  }

  const logger = createLogger(options.verbose);
  const github = createGitHubClient(logger, options.dryRun);
  const repos = options.repos.length > 0 ? options.repos : allAliases();

  logger.info(`Running agent: ${agent.name} (${agent.id})`);
  logger.info(`Repos: ${repos.join(', ')}`);
  if (options.dryRun) logger.warn('DRY RUN MODE');
  logger.info('');

  let failed = 0;

  for (const repoAlias of repos) {
    const repoConfig = getRepo(repoAlias);
    if (!repoConfig) {
      logger.warn(`  ○ ${repoAlias}: no config — skipping`);
      continue;
    }

    const ctx: AgentContext = {
      repoAlias,
      repoSlug: repoConfig.slug,
      github,
      localPath: repoConfig.localPath ?? process.cwd(),
      dryRun: options.dryRun,
      logger,
      extras: {},
    };

    if (!agent.shouldRun(ctx)) {
      logger.info(`  ○ ${repoAlias}: skipped (shouldRun=false)`);
      continue;
    }

    try {
      const result = await agent.execute(ctx);
      const icon = result.status === 'success' ? '✓' : '✗';
      logger.info(`  ${icon} ${repoAlias}: ${result.message} (${result.duration}ms)`);
      if (result.status === 'failed') failed++;
    } catch (err) {
      logger.error(`  ✗ ${repoAlias}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}
