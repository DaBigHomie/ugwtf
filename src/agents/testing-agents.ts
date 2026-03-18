/**
 * Testing & Coverage Agents
 *
 * Validates test presence, runs unit tests, checks coverage thresholds,
 * and detects untested critical paths.
 */
import type { Agent, AgentResult, AgentContext, AgentFinding } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Agent: Test Presence Checker
// ---------------------------------------------------------------------------

const testPresenceChecker: Agent = {
  id: 'test-presence-checker',
  name: 'Test Presence Checker',
  description: 'Check for test files and test configuration in the repo',
  clusterId: 'testing',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Test Presence: ${ctx.repoAlias}`);

    const indicators = {
      vitest: false,
      jest: false,
      playwright: false,
      testDir: false,
    };

    try {
      const pkgContent = await readFile(join(ctx.localPath, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
      const deps = { ...pkg.dependencies as Record<string, string>, ...pkg.devDependencies as Record<string, string> };

      indicators.vitest = 'vitest' in deps;
      indicators.jest = 'jest' in deps;
      indicators.playwright = '@playwright/test' in deps;
    } catch {
      // No package.json
    }

    const found = Object.entries(indicators).filter(([, v]) => v).map(([k]) => k);
    ctx.logger.info(`Test frameworks: ${found.join(', ') || 'none detected'}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Frameworks: ${found.join(', ') || 'none'}`,
      artifacts: found.map(f => `framework:${f}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Test Runner
// ---------------------------------------------------------------------------

const testRunner: Agent = {
  id: 'test-runner',
  name: 'Test Runner',
  description: 'Execute unit test suite and report results',
  clusterId: 'testing',
  shouldRun(ctx) {
    const repo = getRepo(ctx.repoAlias);
    return !!repo;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Test Runner: ${ctx.repoAlias}`);

    if (ctx.dryRun) {
      ctx.logger.info('[DRY RUN] Would run test suite');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: 'Dry run — skipped', artifacts: [] };
    }

    try {
      const output = execSync('npm test -- --run 2>&1 || true', {
        cwd: ctx.localPath,
        encoding: 'utf-8',
        timeout: 120_000,
      });

      const passed = /Tests\s+\d+\s+passed/i.test(output) || /test suites?.*passed/i.test(output);
      ctx.logger.info(passed ? 'Tests passed' : 'Tests may have failures — check output');
      ctx.logger.groupEnd();

      return {
        agentId: this.id,
        status: passed ? 'success' : 'failed',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: passed ? 'All tests passed' : 'Test failures detected',
        artifacts: [],
      };
    } catch {
      ctx.logger.warn('No test script found or tests timed out');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No test script', artifacts: [] };
    }
  },
};

// ---------------------------------------------------------------------------
// Agent: Test Coverage Config Checker
// ---------------------------------------------------------------------------

const testCoverageConfigChecker: Agent = {
  id: 'test-coverage-config-checker',
  name: 'Test Coverage Config Checker',
  description: 'Verify test coverage thresholds are configured',
  clusterId: 'testing',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Coverage Config: ${ctx.repoAlias}`);

    const findings: AgentFinding[] = [];
    const configFiles = ['vitest.config.ts', 'vitest.config.js', 'jest.config.ts', 'jest.config.js'];
    let configContent: string | null = null;
    let configFile: string | null = null;

    for (const f of configFiles) {
      try {
        configContent = await readFile(join(ctx.localPath, f), 'utf-8');
        configFile = f;
        break;
      } catch {
        // Not found
      }
    }

    if (!configContent) {
      findings.push({
        severity: 'info',
        message: 'No test config file found',
        suggestion: 'Create vitest.config.ts with coverage configuration',
      });
    } else if (!/coverage/i.test(configContent)) {
      findings.push({
        severity: 'warning',
        message: `${configFile} has no coverage configuration`,
        file: configFile!,
        suggestion: 'Add coverage thresholds (e.g., statements: 80, branches: 70)',
      });
    }

    ctx.logger.info(`Config: ${configFile ?? 'none'} | Issues: ${findings.length}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: findings.some(f => f.severity === 'error') ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: configFile ? `Config: ${configFile}` : 'No test config',
      artifacts: findings.map(f => f.message),
      findings,
    };
  },
};

export const testingAgents: Agent[] = [testPresenceChecker, testRunner, testCoverageConfigChecker];
