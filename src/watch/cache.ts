/**
 * Agent Result Cache (G53)
 *
 * Caches the last SwarmResult per repo+command. On subsequent runs,
 * compares the repo's git HEAD against the cached version to decide
 * whether the repo can be skipped (unchanged since last successful run).
 *
 * Cache is stored at `.ugwtf/cache/<command>/<repoAlias>.json`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { RepoSwarmResult } from '../types.js';

const UGWTF_DIR = join(process.cwd(), '.ugwtf');
const CACHE_DIR = join(UGWTF_DIR, 'cache');

export interface CachedRepoResult {
  /** Git HEAD sha at time of caching */
  headSha: string;
  /** ISO timestamp of cache write */
  cachedAt: string;
  /** The command that produced this result */
  command: string;
  /** Whether all agents succeeded */
  allPassed: boolean;
  /** Compact summary of agent statuses */
  agents: Array<{ id: string; status: string }>;
}

/**
 * Resolve the git HEAD sha for a local repository path.
 * Returns `null` if the path is not a git repo or git is unavailable.
 */
export function getRepoHeadSha(localPath: string): string | null {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: localPath,
      encoding: 'utf-8',
      timeout: 5_000,
    }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

/**
 * Read the cached result for a repo+command, if it exists.
 */
export function readCachedResult(command: string, repoAlias: string): CachedRepoResult | null {
  const cachePath = join(CACHE_DIR, command, `${repoAlias}.json`);
  if (!existsSync(cachePath)) return null;
  try {
    const raw = readFileSync(cachePath, 'utf-8');
    return JSON.parse(raw) as CachedRepoResult;
  } catch {
    return null;
  }
}

/**
 * Write a cache entry for a repo+command.
 * Resolves HEAD sha from localPath automatically.
 */
export function writeCachedResult(
  command: string,
  repoAlias: string,
  localPath: string,
  repoResult: RepoSwarmResult,
): void {
  const headSha = getRepoHeadSha(localPath);
  if (!headSha) return; // not a git repo — skip caching

  const dir = join(CACHE_DIR, command);
  mkdirSync(dir, { recursive: true });

  const allPassed = repoResult.clusterResults.every(c =>
    c.agentResults.every(a => a.status === 'success' || a.status === 'skipped'),
  );

  const agents = repoResult.clusterResults.flatMap(c =>
    c.agentResults.map(a => ({ id: a.agentId, status: a.status })),
  );

  const entry: CachedRepoResult = {
    headSha,
    cachedAt: new Date().toISOString(),
    command,
    allPassed,
    agents,
  };

  const cachePath = join(dir, `${repoAlias}.json`);
  writeFileSync(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * Check whether a repo can be skipped because it hasn't changed since
 * the last successful run of the same command.
 *
 * @returns `true` if repo is unchanged AND previously all-passed.
 */
export function isRepoUnchanged(
  command: string,
  repoAlias: string,
  localPath: string,
): boolean {
  const cached = readCachedResult(command, repoAlias);
  if (!cached || !cached.allPassed) return false;

  const currentSha = getRepoHeadSha(localPath);
  if (!currentSha) return false;

  return currentSha === cached.headSha;
}
