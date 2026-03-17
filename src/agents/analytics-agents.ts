/**
 * Analytics & Metrics Agents
 *
 * Repo health scoring, dependency staleness tracking,
 * and code complexity metrics.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Repo Health Scorer
// ---------------------------------------------------------------------------

const repoHealthScorer: Agent = {
  id: 'repo-health-scorer',
  name: 'Repo Health Scorer',
  description: 'Calculate a composite health score (0-100) for a repo',
  clusterId: 'analytics',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Health Score: ${ctx.repoAlias}`);

    let score = 0;
    const maxScore = 100;
    const checks: string[] = [];

    // +20: Has tsconfig.json
    try {
      await readFile(join(ctx.localPath, 'tsconfig.json'), 'utf-8');
      score += 20;
      checks.push('✅ tsconfig.json');
    } catch {
      checks.push('❌ tsconfig.json missing');
    }

    // +15: Has .github/copilot-instructions.md
    try {
      await readFile(join(ctx.localPath, '.github', 'copilot-instructions.md'), 'utf-8');
      score += 15;
      checks.push('✅ copilot-instructions.md');
    } catch {
      checks.push('❌ copilot-instructions.md missing');
    }

    // +15: Has AGENTS.md
    try {
      await readFile(join(ctx.localPath, 'AGENTS.md'), 'utf-8');
      score += 15;
      checks.push('✅ AGENTS.md');
    } catch {
      checks.push('❌ AGENTS.md missing');
    }

    // +15: Has build + lint scripts
    try {
      const pkg = JSON.parse(await readFile(join(ctx.localPath, 'package.json'), 'utf-8'));
      if (pkg.scripts?.build) { score += 8; checks.push('✅ build script'); } else { checks.push('❌ build script'); }
      if (pkg.scripts?.lint) { score += 7; checks.push('✅ lint script'); } else { checks.push('❌ lint script'); }
    } catch {
      checks.push('❌ package.json error');
    }

    // +15: Has .github/workflows/
    try {
      const workflows = await readdir(join(ctx.localPath, '.github', 'workflows'));
      if (workflows.length > 0) { score += 15; checks.push(`✅ ${workflows.length} workflows`); }
      else { checks.push('❌ No workflows'); }
    } catch {
      checks.push('❌ No workflows dir');
    }

    // +10: Has .github/instructions/ (path-specific rules)
    try {
      const instructions = await readdir(join(ctx.localPath, '.github', 'instructions'));
      if (instructions.length > 0) { score += 10; checks.push(`✅ ${instructions.length} instruction files`); }
      else { checks.push('❌ No instruction files'); }
    } catch {
      checks.push('❌ No instructions dir');
    }

    // +10: Has README.md
    try {
      await readFile(join(ctx.localPath, 'README.md'), 'utf-8');
      score += 10;
      checks.push('✅ README.md');
    } catch {
      checks.push('❌ README.md missing');
    }

    ctx.logger.info(`Score: ${score}/${maxScore}`);
    for (const c of checks) ctx.logger.info(`  ${c}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: score >= 60 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Health: ${score}/${maxScore}`,
      artifacts: checks,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Dependency Staleness Tracker
// ---------------------------------------------------------------------------

const dependencyStalenessTracker: Agent = {
  id: 'dependency-staleness-tracker',
  name: 'Dependency Staleness Tracker',
  description: 'Check how old package-lock.json is relative to package.json',
  clusterId: 'analytics',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Dependency Staleness: ${ctx.repoAlias}`);

    try {
      const pkgStat = await stat(join(ctx.localPath, 'package.json'));
      const lockStat = await stat(join(ctx.localPath, 'package-lock.json'));

      const daysAgo = (Date.now() - lockStat.mtime.getTime()) / (1000 * 60 * 60 * 24);
      const isStale = daysAgo > 30;

      ctx.logger.info(`Lock file age: ${Math.round(daysAgo)} days`);
      if (isStale) ctx.logger.warn('Lock file older than 30 days');

      ctx.logger.groupEnd();

      return {
        agentId: this.id,
        status: isStale ? 'failed' : 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Lock file: ${Math.round(daysAgo)} days old`,
        artifacts: isStale ? ['stale-lockfile'] : [],
      };
    } catch {
      ctx.logger.info('package-lock.json not found');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No lock file', artifacts: [] };
    }
  },
};

export const analyticsAgents: Agent[] = [repoHealthScorer, dependencyStalenessTracker];
