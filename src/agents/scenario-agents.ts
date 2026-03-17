/**
 * Scenario & Use-Case Agents
 *
 * Inspired by maximus-ai C03 (e2e-scenario-builder), C19 (intent/goal decomposition),
 * and C21 (storyboard-generator). Creates, validates, and reports on user scenarios
 * and acceptance criteria coverage.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helper: Collect files
// ---------------------------------------------------------------------------

async function collectFiles(dir: string, exts: string[], maxDepth = 4, depth = 0): Promise<string[]> {
  if (depth > maxDepth) return [];
  const results: string[] = [];
  let entries: string[];
  try { entries = await readdir(dir); } catch { return results; }
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', '.next'].includes(entry)) continue;
    const fullPath = join(dir, entry);
    const s = await stat(fullPath).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) results.push(...await collectFiles(fullPath, exts, maxDepth, depth + 1));
    else if (exts.some(e => entry.endsWith(e))) results.push(fullPath);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Agent: E2E Scenario Discoverer
// ---------------------------------------------------------------------------

const scenarioDiscoverer: Agent = {
  id: 'scenario-discoverer',
  name: 'E2E Scenario Discoverer',
  description: 'Find pages, routes, and user flows to generate scenario inventory',
  clusterId: 'scenarios',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Scenario Discovery: ${ctx.repoAlias}`);

    const pages: string[] = [];
    const features: string[] = [];

    // Find pages (Next.js app/, React pages/)
    for (const dir of ['src/app', 'src/pages', 'app', 'pages']) {
      const fullDir = join(ctx.localPath, dir);
      const found = await collectFiles(fullDir, ['.tsx', '.ts']);
      pages.push(...found);
    }

    // Find feature modules
    for (const dir of ['src/features', 'features']) {
      const fullDir = join(ctx.localPath, dir);
      try {
        const entries = await readdir(fullDir);
        for (const e of entries) {
          const s = await stat(join(fullDir, e)).catch(() => null);
          if (s?.isDirectory()) features.push(e);
        }
      } catch { /* no features dir */ }
    }

    ctx.logger.info(`Pages: ${pages.length} | Features: ${features.length}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${pages.length} pages, ${features.length} features discovered`,
      artifacts: [
        ...pages.map(p => `page:${p}`),
        ...features.map(f => `feature:${f}`),
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Acceptance Criteria Coverage Checker
// ---------------------------------------------------------------------------

const acceptanceCoverageChecker: Agent = {
  id: 'acceptance-coverage-checker',
  name: 'Acceptance Criteria Coverage',
  description: 'Compare test specs against known routes/features to find uncovered scenarios',
  clusterId: 'scenarios',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Acceptance Coverage: ${ctx.repoAlias}`);

    const testFiles: string[] = [];
    for (const dir of ['e2e', 'tests', '__tests__', 'src/__tests__', 'test']) {
      testFiles.push(...await collectFiles(join(ctx.localPath, dir), ['.spec.ts', '.test.ts', '.spec.tsx', '.test.tsx']));
    }

    // Also check top-level test config
    let hasE2EConfig = false;
    try {
      const pkg = JSON.parse(await readFile(join(ctx.localPath, 'package.json'), 'utf-8')) as Record<string, unknown>;
      const deps = { ...pkg.dependencies as Record<string, string>, ...pkg.devDependencies as Record<string, string> };
      hasE2EConfig = '@playwright/test' in deps;
    } catch { /* no pkg */ }

    // Count scenarios (describe/test/it blocks) in test files
    let totalScenarios = 0;
    for (const f of testFiles.slice(0, 50)) {
      try {
        const content = await readFile(f, 'utf-8');
        const matches = content.match(/\b(test|it)\s*\(/g);
        if (matches) totalScenarios += matches.length;
      } catch { /* skip */ }
    }

    const status = testFiles.length > 0 ? 'success' : 'failed';
    const msg = `${testFiles.length} test files, ${totalScenarios} scenarios, E2E config: ${hasE2EConfig}`;
    ctx.logger.info(msg);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status,
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: msg,
      artifacts: testFiles.map(f => `test:${f}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Scenario Feedback Reporter
// ---------------------------------------------------------------------------

const scenarioFeedbackReporter: Agent = {
  id: 'scenario-feedback-reporter',
  name: 'Scenario Feedback Reporter',
  description: 'Generate actionable feedback: uncovered user flows, missing edge cases, risk areas',
  clusterId: 'scenarios',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Scenario Feedback: ${ctx.repoAlias}`);

    const feedback: string[] = [];

    // Check for critical user flows that should have tests
    const criticalFlows = ['checkout', 'auth', 'login', 'signup', 'payment', 'cart', 'admin'];
    const testFiles = await collectFiles(join(ctx.localPath, 'e2e'), ['.spec.ts', '.test.ts']);
    const testFileNames = testFiles.map(f => f.toLowerCase());

    for (const flow of criticalFlows) {
      // Check if flow exists in pages/features
      const pagesDir = join(ctx.localPath, 'src', 'pages');
      const featDir = join(ctx.localPath, 'src', 'features');
      let flowExists = false;

      for (const dir of [pagesDir, featDir]) {
        const files = await collectFiles(dir, ['.tsx', '.ts']);
        if (files.some(f => f.toLowerCase().includes(flow))) {
          flowExists = true;
          break;
        }
      }

      if (flowExists) {
        const hasCoverage = testFileNames.some(t => t.includes(flow));
        if (!hasCoverage) {
          feedback.push(`UNCOVERED: "${flow}" flow exists but has no E2E tests`);
        }
      }
    }

    // Check for error boundary coverage
    const srcFiles = await collectFiles(join(ctx.localPath, 'src'), ['.tsx']);
    let hasErrorBoundary = false;
    for (const f of srcFiles.slice(0, 50)) {
      try {
        const content = await readFile(f, 'utf-8');
        if (content.includes('ErrorBoundary') || content.includes('error-boundary')) {
          hasErrorBoundary = true;
          break;
        }
      } catch { /* skip */ }
    }
    if (!hasErrorBoundary) {
      feedback.push('RISK: No ErrorBoundary component detected — unhandled errors will crash the app');
    }

    const status = feedback.length === 0 ? 'success' : 'failed';
    ctx.logger.info(`${feedback.length} feedback items`);
    for (const f of feedback) ctx.logger.warn(`  ${f}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status,
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: feedback.length === 0 ? 'All critical flows have test coverage' : `${feedback.length} gaps found`,
      artifacts: feedback,
    };
  },
};

export const scenarioAgents: Agent[] = [
  scenarioDiscoverer,
  acceptanceCoverageChecker,
  scenarioFeedbackReporter,
];
