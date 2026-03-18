/**
 * Swarm Executor
 *
 * Executes clusters of agents across repos with three modes:
 *   - sequential: one repo at a time, clusters in dependency order
 *   - parallel: all repos concurrently (bounded by concurrency limit)
 *   - fan-out: each cluster wave fans out across all repos
 *
 * Uses topological sort from clusters/index.ts to respect dependencies.
 */
import type {
  Agent,
  AgentContext,
  AgentResult,
  Cluster,
  ClusterResult,
  RepoSwarmResult,
  SwarmConfig,
  SwarmResult,
  SwarmSummary,
  Logger,
  GitHubClient,
} from '../types.js';
import { getRepo, allAliases } from '../config/repo-registry.js';
import { clusterExecutionOrder, getClusters, CLUSTERS } from '../clusters/index.js';

// ---------------------------------------------------------------------------
// Run a single agent with error isolation
// ---------------------------------------------------------------------------

async function runAgent(agent: Agent, ctx: AgentContext): Promise<AgentResult> {
  if (!agent.shouldRun(ctx)) {
    return {
      agentId: agent.id,
      status: 'skipped',
      repo: ctx.repoAlias,
      duration: 0,
      message: 'Skipped (shouldRun=false)',
      artifacts: [],
    };
  }

  ctx.logger.info(`  ▸ ${agent.name}`);
  const start = Date.now();

  try {
    const result = await agent.execute(ctx);
    const icon = result.status === 'success' ? '✓' : result.status === 'failed' ? '✗' : '○';
    ctx.logger.info(`  ${icon} ${agent.name} (${Date.now() - start}ms) — ${result.message}`);
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.error(`  ✗ ${agent.name} CRASHED (${duration}ms): ${message}`);
    return {
      agentId: agent.id,
      status: 'failed',
      repo: ctx.repoAlias,
      duration,
      message: `CRASH: ${message}`,
      artifacts: [],
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Run a single cluster (agents run sequentially within a cluster)
// ---------------------------------------------------------------------------

async function runCluster(cluster: Cluster, ctx: AgentContext): Promise<ClusterResult> {
  const start = Date.now();
  const agentResults: AgentResult[] = [];

  ctx.logger.group(`Cluster: ${cluster.name}`);

  for (const agent of cluster.agents) {
    const result = await runAgent(agent, ctx);
    agentResults.push(result);
  }

  ctx.logger.groupEnd();

  const hasFailure = agentResults.some(r => r.status === 'failed');
  return {
    clusterId: cluster.id,
    status: hasFailure ? 'failed' : 'success',
    agentResults,
    duration: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Run all clusters for a single repo
// ---------------------------------------------------------------------------

async function runRepo(
  repoAlias: string,
  clusters: Cluster[],
  github: GitHubClient,
  config: SwarmConfig,
  logger: Logger,
): Promise<RepoSwarmResult> {
  const repoConfig = getRepo(repoAlias);
  if (!repoConfig) {
    logger.warn(`No config found for repo: ${repoAlias}`);
    return { repo: repoAlias, clusterResults: [] };
  }

  const ctx: AgentContext = {
    repoAlias,
    repoSlug: repoConfig.slug,
    github,
    localPath: repoConfig.localPath ?? process.cwd(),
    dryRun: config.dryRun,
    logger,
  };

  logger.group(`Repository: ${repoAlias} (${repoConfig.slug})`);

  // Execute clusters in topological waves
  const waves = clusterExecutionOrder(clusters);
  const clusterResults: ClusterResult[] = [];

  for (const wave of waves) {
    // Within a wave, clusters are independent — run them in parallel
    const waveResults = await Promise.all(
      wave.map(cluster => runCluster(cluster, ctx))
    );
    clusterResults.push(...waveResults);

    // Log wave failures but continue — don't cascade-block subsequent waves
    const waveFailures = waveResults.filter(r => r.status === 'failed');
    if (waveFailures.length > 0) {
      logger.warn(`Wave had ${waveFailures.length} failure(s) for ${repoAlias} — continuing`);
    }
  }

  logger.groupEnd();
  return { repo: repoAlias, clusterResults };
}

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------

async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrent: number,
): Promise<T[]> {
  const results: T[] = [];
  const running = new Set<Promise<void>>();

  for (const task of tasks) {
    const p = (async () => {
      results.push(await task());
    })();
    running.add(p);
    p.finally(() => running.delete(p));

    if (running.size >= maxConcurrent) {
      await Promise.race(running);
    }
  }

  await Promise.all(running);
  return results;
}

// ---------------------------------------------------------------------------
// Summarize results
// ---------------------------------------------------------------------------

function summarize(repoResults: RepoSwarmResult[], startedAt: number): SwarmSummary {
  let totalAgents = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const repo of repoResults) {
    for (const cluster of repo.clusterResults) {
      for (const agent of cluster.agentResults) {
        totalAgents++;
        if (agent.status === 'success') succeeded++;
        else if (agent.status === 'failed') failed++;
        else if (agent.status === 'skipped') skipped++;
      }
    }
  }

  return {
    totalAgents,
    succeeded,
    failed,
    skipped,
    duration: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// Main swarm executor
// ---------------------------------------------------------------------------

/**
 * Execute agents across repos and clusters with concurrency control.
 *
 * @param config  - Swarm configuration (repos, clusters, mode, concurrency).
 * @param github  - Authenticated GitHub API client.
 * @param logger  - Logger for progress output.
 * @returns Aggregated {@link SwarmResult} for the entire run.
 */
export async function executeSwarm(
  config: SwarmConfig,
  github: GitHubClient,
  logger: Logger,
): Promise<SwarmResult> {
  const startedAt = Date.now();

  // Resolve repos
  const repos = config.repos.length > 0 ? config.repos : allAliases();

  // Resolve clusters
  const clusters = config.clusters.length > 0
    ? getClusters(config.clusters)
    : CLUSTERS;

  logger.group(`Swarm: ${config.mode} mode — ${repos.length} repos, ${clusters.length} clusters`);

  let results: RepoSwarmResult[];

  switch (config.mode) {
    case 'sequential':
      results = [];
      for (const repo of repos) {
        results.push(await runRepo(repo, clusters, github, config, logger));
      }
      break;

    case 'parallel':
      results = await withConcurrency(
        repos.map(repo => () => runRepo(repo, clusters, github, config, logger)),
        config.concurrency,
      );
      break;

    case 'fan-out': {
      // Each cluster wave fans out to all repos simultaneously
      const waves = clusterExecutionOrder(clusters);
      const repoResultsMap = new Map<string, ClusterResult[]>();
      for (const repo of repos) repoResultsMap.set(repo, []);

      for (const wave of waves) {
        await withConcurrency(
          repos.flatMap(repoAlias =>
            wave.map(cluster => async () => {
              const repoConfig = getRepo(repoAlias);
              if (!repoConfig) return;
              const ctx: AgentContext = {
                repoAlias,
                repoSlug: repoConfig.slug,
                github,
                localPath: repoConfig.localPath ?? process.cwd(),
                dryRun: config.dryRun,
                logger,
              };
              const result = await runCluster(cluster, ctx);
              repoResultsMap.get(repoAlias)?.push(result);
            }),
          ),
          config.concurrency,
        );
      }

      results = repos.map(repo => ({
        repo,
        clusterResults: repoResultsMap.get(repo) ?? [],
      }));
      break;
    }
  }

  logger.groupEnd();

  const summary = summarize(results, startedAt);

  logger.info('');
  logger.info('═══ Swarm Summary ═══');
  logger.info(`  Total agents: ${summary.totalAgents}`);
  logger.success(`  Succeeded:    ${summary.succeeded}`);
  if (summary.failed > 0) logger.error(`  Failed:       ${summary.failed}`);
  if (summary.skipped > 0) logger.warn(`  Skipped:      ${summary.skipped}`);
  logger.info(`  Duration:     ${summary.duration}ms`);

  return {
    mode: config.mode,
    startedAt,
    completedAt: Date.now(),
    results,
    summary,
  };
}
