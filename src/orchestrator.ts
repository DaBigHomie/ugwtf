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

// Map orchestrator commands to cluster IDs
const COMMAND_CLUSTER_MAP: Record<string, string[]> = {
  deploy:   ['labels', 'workflows'],
  validate: ['quality'],
  fix:      ['labels', 'workflows', 'quality'],
  labels:   ['labels'],
  issues:   ['issues'],
  prs:      ['prs'],
  audit:    ['audit', 'visual-audit'],
  status:   ['audit'],
  prompts:  ['prompts'],
};

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
  };

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

  return result;
}
