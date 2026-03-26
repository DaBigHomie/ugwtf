/**
 * Orchestrator
 *
 * Top-level coordinator that maps user commands to swarm execution.
 * Parses OrchestratorOptions, resolves repos/clusters, and runs the swarm.
 */
import type { OrchestratorOptions, SwarmConfig, SwarmResult, Logger } from './types.js';
import { createGitHubClient } from './clients/github.js';
import { createLogger } from './utils/logger.js';
import { executeSwarm } from './swarm/executor.js';
import { writeJsonReport } from './output/json-reporter.js';
import { writeMarkdownReport } from './output/markdown-reporter.js';
import { persistLastRun } from './output/persist.js';
import { collectFindings, formatFindingsTable } from './output/findings-formatter.js';
import { generateScoreboard, writeScoreboard, writeScoreboardMarkdown, formatScoreboardMarkdown } from './output/scoreboard.js';
import { isRepoUnchanged, writeCachedResult } from './watch/cache.js';
import { getRepo } from './config/repo-registry.js';

// Map orchestrator commands to cluster IDs
const COMMAND_CLUSTER_MAP: Record<string, string[]> = {
  // Setup (one-time per repo)
  install:     ['labels', 'workflows'],
  deploy:      ['labels', 'workflows'],
  validate:    ['quality'],
  fix:         ['labels', 'workflows', 'quality', 'fix'],
  labels:      ['labels'],
  issues:      ['issues'],
  prs:         ['prs'],
  audit:       ['audit', 'visual-audit'],
  status:      ['audit'],
  checks:      ['quality'],
  prompts:     ['prompts'],
  chain:       ['chain'],
  cleanup:     ['cleanup'],
  'dry-run':   ['dry-run'],
  'generate-chain': ['generate-chain'],

  // Domain scans — individual
  security:    ['security'],
  performance: ['performance'],
  a11y:        ['a11y'],
  seo:         ['seo'],
  docs:        ['docs', 'context'],
  commerce:    ['commerce'],

  // 40x wave
  scenarios:      ['scenarios'],
  'design-system': ['design-system'],
  supabase:       ['supabase-fsd'],
  gateway:        ['ai-gateway'],

  // Comprehensive scan — all domain clusters
  scan: [
    'fsd', 'testing', 'database', 'migration', 'security', 'devops',
    'analytics', 'docs', 'context', 'commerce', 'design', 'performance',
    'seo', 'a11y', 'sovereign', 'email', 'content', 'routing', 'state',
    'auth', 'integration', 'monitoring', 'animation',
    'scenarios', 'design-system', 'supabase-fsd', 'ai-gateway',
  ],
};

/**
 * Top-level entry point — resolve clusters from the CLI command, build a
 * {@link SwarmConfig}, and delegate to {@link executeSwarm}.
 *
 * @param options - Parsed CLI options (command, repos, flags).
 * @returns The aggregated {@link SwarmResult} from all repos and clusters.
 */
export async function orchestrate(options: OrchestratorOptions): Promise<SwarmResult> {
  const logger: Logger = createLogger(options.verbose);

  logger.info('');
  logger.info('╔══════════════════════════════════════════╗');
  logger.info('║       UGWTF ORCHESTRATOR v1.0.0          ║');
  logger.info('╚══════════════════════════════════════════╝');
  logger.info('');

  if (options.dryRun) {
    logger.warn('DRY RUN MODE — no changes will be made');
    logger.info('');
  }

  // Resolve clusters from command
  const clusters = options.clusters.length > 0
    ? options.clusters
    : COMMAND_CLUSTER_MAP[options.command] ?? [];

  if (clusters.length === 0) {
    logger.error(`No clusters mapped for command: ${options.command}`);
    return {
      mode: 'sequential',
      startedAt: Date.now(),
      completedAt: Date.now(),
      results: [],
      summary: { totalAgents: 0, succeeded: 0, failed: 0, skipped: 0, duration: 0 },
    };
  }

  logger.info(`Command:     ${options.command}`);
  logger.info(`Repos:       ${options.repos.length > 0 ? options.repos.join(', ') : 'ALL'}`);
  logger.info(`Clusters:    ${clusters.join(', ')}`);
  logger.info(`Concurrency: ${options.concurrency}`);
  logger.info('');

  // Create GitHub client
  const github = createGitHubClient(logger, options.dryRun);

  // Check rate limit before proceeding
  try {
    const rateLimit = await github.getRateLimit();
    logger.info(`GitHub API: ${rateLimit.remaining}/${rateLimit.limit} requests remaining`);
    if (rateLimit.remaining < 100) {
      logger.warn(`Low rate limit! Resets at ${new Date(rateLimit.reset * 1000).toISOString()}`);
    }
    logger.info('');
  } catch {
    logger.warn('Could not check rate limit — proceeding anyway');
    logger.info('');
  }

  // Build swarm config
  const swarmConfig: SwarmConfig = {
    mode: options.concurrency > 1 ? 'parallel' : 'sequential',
    concurrency: options.concurrency,
    repos: options.repos,
    clusters,
    dryRun: options.dryRun,
    extras: options.extras ?? {},
  };

  // G53: Skip repos whose HEAD hasn't changed since last successful run
  const skippedRepos: string[] = [];
  if (swarmConfig.repos.length > 0 && !options.noCache) {
    swarmConfig.repos = swarmConfig.repos.filter(alias => {
      const repoConfig = getRepo(alias);
      const localPath = repoConfig?.localPath;
      if (!localPath) return true; // no localPath → always run
      if (isRepoUnchanged(options.command, alias, localPath)) {
        skippedRepos.push(alias);
        return false;
      }
      return true;
    });
    if (skippedRepos.length > 0) {
      logger.info(`Cache: skipping ${skippedRepos.length} unchanged repo(s): ${skippedRepos.join(', ')}`);
      logger.info('');
    }
  }

  // If all repos were cached, return empty success
  if (swarmConfig.repos.length === 0 && skippedRepos.length > 0) {
    logger.success('All repos unchanged since last successful run — nothing to do');
    return {
      mode: swarmConfig.mode,
      startedAt: Date.now(),
      completedAt: Date.now(),
      results: [],
      summary: { totalAgents: 0, succeeded: 0, failed: 0, skipped: 0, duration: 0 },
    };
  }

  // Execute
  const result = await executeSwarm(swarmConfig, github, logger);

  // Print final report
  logger.info('');
  logger.info('╔══════════════════════════════════════════╗');
  logger.info('║            EXECUTION COMPLETE            ║');
  logger.info('╚══════════════════════════════════════════╝');
  logger.info('');

  if (result.summary.failed > 0) {
    logger.error(`${result.summary.failed} agent(s) FAILED — review output above`);

    // Print failed agents
    for (const repo of result.results) {
      for (const cluster of repo.clusterResults) {
        for (const agent of cluster.agentResults) {
          if (agent.status === 'failed') {
            logger.error(`  ✗ ${repo.repo} → ${cluster.clusterId} → ${agent.agentId}: ${agent.message}`);
          }
        }
      }
    }
  } else {
    logger.success(`All ${result.summary.succeeded} agents completed successfully`);
  }

  // Print structured findings if any agents returned them
  const findings = collectFindings(result);
  if (findings.length > 0) {
    logger.info('');
    logger.info(formatFindingsTable(findings));
  }

  // Persist last-run results
  await persistLastRun(result, options.command);

  // G53: Cache per-repo results for incremental skip
  for (const repoResult of result.results) {
    const repoConfig = getRepo(repoResult.repo);
    const localPath = repoConfig?.localPath;
    if (localPath) {
      writeCachedResult(options.command, repoResult.repo, localPath, repoResult);
    }
  }

  // Generate SCOREBOARD for audit and scan commands
  if (['audit', 'scan', 'status'].includes(options.command)) {
    const scoreboard = generateScoreboard(result);
    const jsonPath = writeScoreboard(scoreboard);
    const mdPath = writeScoreboardMarkdown(scoreboard);
    logger.info('');
    logger.info(formatScoreboardMarkdown(scoreboard));
    logger.info('');
    logger.info(`Scoreboard JSON: ${jsonPath}`);
    logger.info(`Scoreboard MD:   ${mdPath}`);
  }

  // Write output if requested
  if (options.output === 'json') {
    const path = await writeJsonReport(result, options.command);
    logger.info(`JSON report written to: ${path}`);
  } else if (options.output === 'markdown') {
    const path = await writeMarkdownReport(result, options.command);
    logger.info(`Markdown report written to: ${path}`);
  }

  return result;
}
