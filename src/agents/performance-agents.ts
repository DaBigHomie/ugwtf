/**
 * Performance Agents
 *
 * Bundle size tracking, dependency weight analysis,
 * and build time monitoring.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Agent: Bundle Size Tracker
// ---------------------------------------------------------------------------

const bundleSizeTracker: Agent = {
  id: 'bundle-size-tracker',
  name: 'Bundle Size Tracker',
  description: 'Check build output size for bloat detection',
  clusterId: 'performance',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Bundle Size: ${ctx.repoAlias}`);

    // Check common build output directories
    const outputDirs = ['dist', '.next', 'build', 'out'];
    let totalSize = 0;
    let foundDir = '';

    for (const dir of outputDirs) {
      const dirPath = join(ctx.localPath, dir);
      try {
        await stat(dirPath);
        // Use du to get directory size
        try {
          const output = execSync(`du -sk "${dirPath}" 2>/dev/null`, { encoding: 'utf-8' });
          const sizeKb = parseInt(output.split('\t')[0] ?? '0', 10);
          if (sizeKb > totalSize) {
            totalSize = sizeKb;
            foundDir = dir;
          }
        } catch {
          // du failed
        }
      } catch {
        // Dir doesn't exist
      }
    }

    if (!foundDir) {
      ctx.logger.info('No build output directory found (not yet built?)');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No build output', artifacts: [] };
    }

    const sizeMb = (totalSize / 1024).toFixed(1);
    const isLarge = totalSize > 100_000; // > 100MB

    ctx.logger.info(`Build output: ${sizeMb}MB in ${foundDir}/`);
    if (isLarge) ctx.logger.warn('Build output exceeds 100MB');

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: isLarge ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${foundDir}/: ${sizeMb}MB`,
      artifacts: isLarge ? ['large-bundle'] : [],
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Heavy Dependency Detector
// ---------------------------------------------------------------------------

const heavyDependencyDetector: Agent = {
  id: 'heavy-dependency-detector',
  name: 'Heavy Dependency Detector',
  description: 'Identify known heavy dependencies that may bloat the bundle',
  clusterId: 'performance',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Heavy Deps: ${ctx.repoAlias}`);

    // Known heavy packages and recommended alternatives
    const heavyPackages: Record<string, string> = {
      'moment': 'Use date-fns or dayjs instead',
      'lodash': 'Use lodash-es or individual imports',
      'jquery': 'Use native DOM APIs',
      'aws-sdk': 'Use @aws-sdk/* v3 modular packages',
      'firebase': 'Consider lighter alternatives if only using 1-2 features',
    };

    try {
      const pkg = JSON.parse(await readFile(join(ctx.localPath, 'package.json'), 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const found: string[] = [];

      for (const [dep, suggestion] of Object.entries(heavyPackages)) {
        if (dep in allDeps) {
          found.push(`${dep} — ${suggestion}`);
          ctx.logger.warn(`  ⚠ ${dep}: ${suggestion}`);
        }
      }

      // Count total dependencies
      const depCount = Object.keys(allDeps).length;
      ctx.logger.info(`Total deps: ${depCount} | Heavy: ${found.length}`);

      if (depCount > 80) {
        ctx.logger.warn(`Very high dependency count (${depCount})`);
      }

      ctx.logger.groupEnd();

      return {
        agentId: this.id,
        status: found.length > 2 ? 'failed' : 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Deps: ${depCount} total, ${found.length} heavy`,
        artifacts: found,
      };
    } catch {
      ctx.logger.info('No package.json');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No package.json', artifacts: [] };
    }
  },
};

export const performanceAgents: Agent[] = [bundleSizeTracker, heavyDependencyDetector];
