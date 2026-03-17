/**
 * Monitoring Agents
 *
 * Validate observability setup, error tracking,
 * and logging configuration.
 */
import type { Agent, AgentResult } from '../types.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Error Tracking Validator
// ---------------------------------------------------------------------------

const errorTrackingValidator: Agent = {
  id: 'error-tracking-validator',
  name: 'Error Tracking Validator',
  description: 'Verify error tracking and logging setup',
  clusterId: 'monitoring',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Error Tracking: ${ctx.repoAlias}`);

    const findings: string[] = [];
    const pkgPath = join(ctx.localPath, 'package.json');

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      const trackingLibs: Record<string, string> = {
        '@sentry/nextjs': 'Sentry (Next.js)',
        '@sentry/react': 'Sentry (React)',
        '@sentry/node': 'Sentry (Node)',
        'logrocket': 'LogRocket',
        'pino': 'Pino Logger',
        'winston': 'Winston Logger',
        'datadog-api-client': 'Datadog',
        '@datadog/browser-rum': 'Datadog RUM',
      };

      for (const [dep, label] of Object.entries(trackingLibs)) {
        if (allDeps[dep]) {
          findings.push(`✅ ${label}`);
        }
      }
    } catch {
      // skip
    }

    // Check for error boundary components
    const srcDir = join(ctx.localPath, 'src');
    const errorBoundary = await findByName(srcDir, /error.?boundary/i);
    if (errorBoundary) {
      findings.push('✅ Error Boundary component found');
    }

    // Check for global error handler (Next.js)
    const errorPages = [
      join(ctx.localPath, 'src', 'app', 'error.tsx'),
      join(ctx.localPath, 'app', 'error.tsx'),
      join(ctx.localPath, 'src', 'app', 'global-error.tsx'),
    ];
    for (const ep of errorPages) {
      if ((await stat(ep).catch(() => null))?.isFile()) {
        findings.push(`✅ Error page: ${ep.replace(ctx.localPath + '/', '')}`);
      }
    }

    if (findings.length === 0) {
      findings.push('⚠ No error tracking or logging detected');
    }

    ctx.logger.info(findings.join('\n  '));
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: findings.join('; '),
      artifacts: findings,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Console Log Detector
// ---------------------------------------------------------------------------

const consoleLogDetector: Agent = {
  id: 'console-log-detector',
  name: 'Console Log Detector',
  description: 'Detect stray console.log statements in production code',
  clusterId: 'monitoring',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Console Logs: ${ctx.repoAlias}`);

    const srcDir = join(ctx.localPath, 'src');
    let logCount = 0;
    const files: string[] = [];

    async function scan(dir: string): Promise<void> {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        const s = await stat(full).catch(() => null);
        if (!s) continue;
        if (s.isDirectory()) {
          await scan(full);
        } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.includes('.test.') && !entry.includes('.spec.')) {
          try {
            const content = await readFile(full, 'utf-8');
            const matches = (content.match(/console\.(log|debug|info)\s*\(/g) ?? []).length;
            if (matches > 0) {
              logCount += matches;
              const rel = full.replace(ctx.localPath + '/', '');
              files.push(`${rel} (${matches})`);
            }
          } catch {
            // skip
          }
        }
      }
    }

    await scan(srcDir);

    ctx.logger.info(`Console logs found: ${logCount} across ${files.length} files`);
    if (files.length > 0) {
      for (const f of files.slice(0, 5)) ctx.logger.warn(`  ⚠ ${f}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: logCount > 20 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${logCount} console.log statements in ${files.length} files`,
      artifacts: files.slice(0, 20),
    };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findByName(dir: string, pattern: RegExp, depth = 3): Promise<boolean> {
  if (depth <= 0) return false;
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (pattern.test(entry)) return true;
    const full = join(dir, entry);
    const s = await stat(full).catch(() => null);
    if (s?.isDirectory()) {
      const found = await findByName(full, pattern, depth - 1);
      if (found) return true;
    }
  }
  return false;
}

export const monitoringAgents: Agent[] = [errorTrackingValidator, consoleLogDetector];
