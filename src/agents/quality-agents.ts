/**
 * Quality Gate Agents
 *
 * Real execution: runs tsc, lint, build locally via child_process.
 * Validates config files exist (.github/copilot-instructions.md, tsconfig.json, etc).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { Agent, AgentResult } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { repoPath } from '../utils/fs.js';

function runCheck(cwd: string, command: string): { success: boolean; output: string } {
  try {
    const output = execSync(command, { cwd, encoding: 'utf-8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: output.trim() };
  } catch (err) {
    const output = err instanceof Error ? (err as { stdout?: string; stderr?: string }).stdout ?? (err as { stderr?: string }).stderr ?? err.message : String(err);
    return { success: false, output: typeof output === 'string' ? output.slice(0, 500) : '' };
  }
}

const typescriptCheckAgent: Agent = {
  id: 'quality-tsc',
  name: 'TypeScript Check',
  description: 'Run npx tsc --noEmit against repo',
  clusterId: 'quality',
  shouldRun(ctx) { return existsSync(repoPath(getRepo(ctx.repoAlias)!, 'tsconfig.json')); },
  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repo = getRepo(ctx.repoAlias)!;
    if (ctx.dryRun) {
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: 0, message: 'DRY RUN: tsc', artifacts: [] };
    }
    ctx.logger.info('Running tsc --noEmit...');
    const result = runCheck(repo.localPath, 'npx tsc --noEmit');
    if (result.success) {
      ctx.logger.success('TypeScript: 0 errors');
    } else {
      ctx.logger.error(`TypeScript failed:\n${result.output.slice(0, 300)}`);
    }
    return {
      agentId: this.id,
      status: result.success ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: result.success ? 'tsc: 0 errors' : 'tsc: ERRORS',
      artifacts: result.success ? [] : [result.output.slice(0, 500)],
    };
  },
};

const eslintCheckAgent: Agent = {
  id: 'quality-lint',
  name: 'ESLint Check',
  description: 'Run npm run lint against repo',
  clusterId: 'quality',
  shouldRun(ctx) { return existsSync(repoPath(getRepo(ctx.repoAlias)!, 'package.json')); },
  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repo = getRepo(ctx.repoAlias)!;
    if (ctx.dryRun) {
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: 0, message: 'DRY RUN: lint', artifacts: [] };
    }
    ctx.logger.info('Running npm run lint...');
    const result = runCheck(repo.localPath, 'npm run lint');
    return {
      agentId: this.id,
      status: result.success ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: result.success ? 'lint: 0 errors' : 'lint: ERRORS',
      artifacts: result.success ? [] : [result.output.slice(0, 500)],
    };
  },
};

const buildCheckAgent: Agent = {
  id: 'quality-build',
  name: 'Build Check',
  description: 'Run npm run build against repo',
  clusterId: 'quality',
  shouldRun(ctx) { return existsSync(repoPath(getRepo(ctx.repoAlias)!, 'package.json')); },
  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repo = getRepo(ctx.repoAlias)!;
    if (ctx.dryRun) {
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: 0, message: 'DRY RUN: build', artifacts: [] };
    }
    ctx.logger.info('Running npm run build...');
    const result = runCheck(repo.localPath, 'npm run build');
    return {
      agentId: this.id,
      status: result.success ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: result.success ? 'build: SUCCESS' : 'build: FAILED',
      artifacts: result.success ? [] : [result.output.slice(0, 500)],
    };
  },
};

const configHealthAgent: Agent = {
  id: 'quality-config',
  name: 'Config Health Check',
  description: 'Verify required config files exist (tsconfig, eslint, copilot-instructions)',
  clusterId: 'quality',
  shouldRun() { return true; },
  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repo = getRepo(ctx.repoAlias)!;

    const required: Array<{ path: string; label: string }> = [
      { path: 'package.json', label: 'package.json' },
      { path: 'tsconfig.json', label: 'tsconfig.json' },
      { path: '.github/copilot-instructions.md', label: 'copilot-instructions.md' },
    ];

    const missing: string[] = [];
    const found: string[] = [];

    for (const { path, label } of required) {
      if (existsSync(repoPath(repo, path))) {
        found.push(label);
      } else {
        missing.push(label);
      }
    }

    return {
      agentId: this.id,
      status: missing.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Found: ${found.length}, Missing: ${missing.length}`,
      artifacts: missing.map(f => `MISSING: ${f}`),
    };
  },
};

export const qualityAgents: Agent[] = [
  typescriptCheckAgent,
  eslintCheckAgent,
  buildCheckAgent,
  configHealthAgent,
];
